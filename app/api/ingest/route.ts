import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { extractNoticeFromDocument, type EngineName } from "@/lib/ai";
import {
  createTextDocumentInput,
  parseUploadedFile,
  type ParsedDocumentInput,
} from "@/lib/file-parser";
import { getDbState, mutateDbState } from "@/lib/store";
import type {
  AlertLog,
  Deadline,
  IngestFileResult,
  Notice,
  PipelineLogEntry,
} from "@/types/campus";

export const dynamic = "force-dynamic";

function nowIso(): string {
  return new Date().toISOString();
}

async function dispatchWebhookNonBlocking(
  webhookUrl: string,
  notice: Notice,
  deadlines: Deadline[],
  supersededCircularNos: string[]
): Promise<boolean> {
  try {
    const url = new URL(webhookUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    const summaryText = [
      `[UniBrief Alert] ${notice.circular_no}: ${notice.title}`,
      `Effective: ${notice.effective_date} | Topic: ${notice.topic_tag}`,
      notice.summary,
      supersededCircularNos.length > 0
        ? `Superseded: ${supersededCircularNos.join(", ")}`
        : null,
      deadlines.length > 0
        ? `Deadlines: ${deadlines
            .map((d) => `${d.title} (${d.due_date} ${d.due_time})`)
            .join("; ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        event: "unibrief_notice_ingested",
        text: summaryText, // Slack / n8n compatible
        content: summaryText, // Discord compatible
        circular_no: notice.circular_no,
        title: notice.title,
        summary: notice.summary,
        effective_date: notice.effective_date,
        superseded_circulars: supersededCircularNos,
        deadlines,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const globalLogs: PipelineLogEntry[] = [];

  try {
    const contentType = req.headers.get("content-type") ?? "";
    const parsedDocs: ParsedDocumentInput[] = [];
    let webhookUrl = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const files = formData.getAll("files");
      for (const item of files) {
        if (item instanceof File && item.size > 0) {
          parsedDocs.push(await parseUploadedFile(item));
        }
      }

      const pastedText = formData.get("pastedText");
      const titleHint = formData.get("titleHint");
      if (typeof pastedText === "string" && pastedText.trim()) {
        parsedDocs.push(
          createTextDocumentInput(
            pastedText,
            typeof titleHint === "string" ? titleHint : undefined
          )
        );
      }

      const rawWebhook = formData.get("webhookUrl");
      if (typeof rawWebhook === "string") {
        webhookUrl = rawWebhook.trim();
      }
    } else {
      const body = (await req.json()) as {
        pastedText?: string;
        titleHint?: string;
        webhookUrl?: string;
      };
      if (typeof body.pastedText === "string" && body.pastedText.trim()) {
        parsedDocs.push(
          createTextDocumentInput(body.pastedText, body.titleHint)
        );
      }
      if (typeof body.webhookUrl === "string") {
        webhookUrl = body.webhookUrl.trim();
      }
    }

    if (parsedDocs.length === 0) {
      return NextResponse.json(
        {
          error:
            "Please upload at least one PDF, DOCX, TXT, or notice image, or paste circular text.",
        },
        { status: 400 }
      );
    }

    const initialState = await getDbState();
    const existingTopics = Array.from(
      new Set(initialState.notices.map((n) => n.topic_tag))
    );

    const results: IngestFileResult[] = [];
    let lastEngine: EngineName = "unibrief-local";

    // Loop 2: Batch File Loop — process each uploaded document sequentially
    for (const doc of parsedDocs) {
      const fileLogs: PipelineLogEntry[] = [];

      // Retry loop across configured AI providers with local fallback inside extractNoticeFromDocument
      const { payload, engineUsed } = await extractNoticeFromDocument(
        doc,
        existingTopics
      );
      lastEngine = engineUsed;

      if (!existingTopics.includes(payload.topic_tag)) {
        existingTopics.push(payload.topic_tag);
      }

      fileLogs.push({
        step: "Extracting Multimodal JSON",
        status: "completed",
        detail: `Extracted ${payload.circular_no} (${payload.topic_tag}) via ${engineUsed} from ${doc.fileName}.`,
        timestamp: nowIso(),
      });

      const noticeId = `notice-${crypto.randomUUID().slice(0, 8)}`;
      const newNotice: Notice = {
        id: noticeId,
        circular_no: payload.circular_no,
        title: payload.title,
        summary: payload.summary,
        extracted_text: payload.extracted_text,
        page_references: payload.page_references,
        topic_tag: payload.topic_tag,
        effective_date: payload.effective_date,
        status: "active",
        superseded_by_id: null,
        target_branches: payload.target_branches,
        target_semesters: payload.target_semesters,
        audience_type: payload.audience_type,
        policy_rules: payload.policy_rules,
        file_name: doc.fileName,
        file_mime: doc.mimeType,
        file_data_url: doc.dataUrl,
        created_at: nowIso(),
      };

      const mutationResult = await mutateDbState((draft) => {
        // Loop 3: Conflict Resolution Loop — check existing active notices on same topic
        const matchingActive = draft.notices.filter(
          (existing) =>
            existing.status === "active" &&
            existing.topic_tag === newNotice.topic_tag
        );

        const supersededIds: string[] = [];
        const supersededCircularNos: string[] = [];

        fileLogs.push({
          step: "Checking Topic Conflicts",
          status: "completed",
          detail:
            matchingActive.length > 0
              ? `Found ${matchingActive.length} active notice(s) under topic "${newNotice.topic_tag}".`
              : `No conflicting active notices under topic "${newNotice.topic_tag}".`,
          timestamp: nowIso(),
        });

        for (const oldNotice of matchingActive) {
          const isNewerOrEqual =
            newNotice.effective_date >= oldNotice.effective_date;
          if (isNewerOrEqual || payload.supersedes_previous) {
            oldNotice.status = "superseded";
            oldNotice.superseded_by_id = newNotice.id;
            supersededIds.push(oldNotice.id);
            supersededCircularNos.push(oldNotice.circular_no);

            for (const dl of draft.deadlines) {
              if (dl.notice_id === oldNotice.id && dl.status === "active") {
                dl.status = "superseded";
              }
            }
          }
        }

        fileLogs.push({
          step: "Auto-Superseding Old Circulars",
          status: supersededIds.length > 0 ? "completed" : "skipped",
          detail:
            supersededCircularNos.length > 0
              ? `Superseded ${supersededCircularNos.join(", ")} and retired their linked deadlines in favor of ${newNotice.circular_no}.`
              : "No older circulars required superseding.",
          timestamp: nowIso(),
        });

        draft.notices.unshift(newNotice);

        // Loop 4: Deadline & Proactive Alert Loop
        const createdDeadlines: Deadline[] = [];
        for (const item of payload.deadlines) {
          const dl: Deadline = {
            id: `deadline-${crypto.randomUUID().slice(0, 8)}`,
            notice_id: newNotice.id,
            circular_no: newNotice.circular_no,
            title: item.title,
            due_date: item.due_date,
            due_time: item.due_time,
            penalty_impact: item.penalty_impact,
            urgency: item.urgency,
            action_url: item.action_url,
            target_branches: newNotice.target_branches,
            target_semesters: newNotice.target_semesters,
            audience_type: newNotice.audience_type,
            status: "active",
            completed: false,
          };
          draft.deadlines.push(dl);
          createdDeadlines.push(dl);
        }

        fileLogs.push({
          step: "Creating Deadlines",
          status: createdDeadlines.length > 0 ? "completed" : "skipped",
          detail:
            createdDeadlines.length > 0
              ? `Created ${createdDeadlines.length} deadline radar item(s) for ${newNotice.circular_no}.`
              : "No explicit due dates extracted from this notice.",
          timestamp: nowIso(),
        });

        const alertMsg =
          supersededCircularNos.length > 0
            ? `${newNotice.circular_no} ingested & superseded ${supersededCircularNos.join(", ")}: ${newNotice.title}`
            : `New official notice ${newNotice.circular_no}: ${newNotice.title} (${createdDeadlines.length} deadline${createdDeadlines.length === 1 ? "" : "s"}).`;

        const inAppAlert: AlertLog = {
          id: `alert-${crypto.randomUUID().slice(0, 8)}`,
          notice_id: newNotice.id,
          circular_no: newNotice.circular_no,
          channel: "in_app",
          message: alertMsg,
          sent_at: nowIso(),
        };
        draft.alert_logs.unshift(inAppAlert);

        return {
          supersededIds,
          supersededCircularNos,
          createdDeadlines,
          alertsDispatched: [inAppAlert],
        };
      });

      // Fire optional external webhook non-blockingly and record log
      if (webhookUrl) {
        const delivered = await dispatchWebhookNonBlocking(
          webhookUrl,
          newNotice,
          mutationResult.createdDeadlines,
          mutationResult.supersededCircularNos
        );
        const webhookAlert: AlertLog = {
          id: `alert-${crypto.randomUUID().slice(0, 8)}`,
          notice_id: newNotice.id,
          circular_no: newNotice.circular_no,
          channel: "webhook",
          message: delivered
            ? `Webhook notification delivered for ${newNotice.circular_no}.`
            : `Webhook attempted for ${newNotice.circular_no} (endpoint returned non-2xx or timed out).`,
          sent_at: nowIso(),
        };
        await mutateDbState((draft) => {
          draft.alert_logs.unshift(webhookAlert);
        });
        mutationResult.alertsDispatched.push(webhookAlert);
      }

      fileLogs.push({
        step: "Dispatching Alerts",
        status: "completed",
        detail: webhookUrl
          ? `Dispatched ${mutationResult.alertsDispatched.length} alert(s) (in-app + webhook).`
          : "Logged in-app alert to Live Alert Feed.",
        timestamp: nowIso(),
      });

      globalLogs.push(...fileLogs);
      results.push({
        file_name: doc.fileName,
        notice: newNotice,
        superseded_notice_ids: mutationResult.supersededIds,
        created_deadlines: mutationResult.createdDeadlines,
        alerts_dispatched: mutationResult.alertsDispatched,
        logs: fileLogs,
      });
    }

    return NextResponse.json({
      results,
      logs: globalLogs,
      engine_used: lastEngine,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to ingest circulars.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
