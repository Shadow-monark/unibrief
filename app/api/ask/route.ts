import { NextRequest, NextResponse } from "next/server";
import { answerCampusQuestion } from "@/lib/ai";
import { parseUploadedFile, type ParsedDocumentInput } from "@/lib/file-parser";
import { matchesStudentProfile } from "@/lib/profile";
import { getDbState } from "@/lib/store";
import type { Notice, StudentProfile } from "@/types/campus";

export const dynamic = "force-dynamic";

const DEFAULT_PROFILE: StudentProfile = {
  branch: "CSE",
  semester: 3,
  residence: "Hosteller",
};

function sanitizeProfile(raw: unknown): StudentProfile {
  if (!raw || typeof raw !== "object") return DEFAULT_PROFILE;
  const obj = raw as Record<string, unknown>;
  const branch =
    obj.branch === "All" ||
    obj.branch === "CSE" ||
    obj.branch === "AIML" ||
    obj.branch === "ECE" ||
    obj.branch === "ME"
      ? obj.branch
      : "CSE";
  const semester =
    typeof obj.semester === "number" &&
    Number.isInteger(obj.semester) &&
    obj.semester >= 1 &&
    obj.semester <= 8
      ? obj.semester
      : 3;
  const residence =
    obj.residence === "Day Scholar" ? "Day Scholar" : "Hosteller";
  return { branch, semester, residence };
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let question = "";
    let profile: StudentProfile = DEFAULT_PROFILE;
    let attachment: ParsedDocumentInput | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const q = formData.get("question");
      question = typeof q === "string" ? q.trim() : "";

      const rawProfile = formData.get("profile");
      if (typeof rawProfile === "string") {
        try {
          profile = sanitizeProfile(JSON.parse(rawProfile));
        } catch {
          profile = DEFAULT_PROFILE;
        }
      }

      const file = formData.get("attachment");
      if (file instanceof File && file.size > 0) {
        attachment = await parseUploadedFile(file);
      }
    } else {
      const body = (await req.json()) as {
        question?: string;
        profile?: unknown;
      };
      question = typeof body.question === "string" ? body.question.trim() : "";
      profile = sanitizeProfile(body.profile);
    }

    if (!question) {
      return NextResponse.json(
        { error: "Please enter a question to ask UniBrief." },
        { status: 400 }
      );
    }

    const state = await getDbState();

    // Profile-aware retrieval loop: collect matching active notices + superseded notices on matching topics
    const matchedActive: Notice[] = [];
    const matchedTopics = new Set<string>();

    for (const notice of state.notices) {
      if (notice.status === "active" && matchesStudentProfile(notice, profile)) {
        matchedActive.push(notice);
        matchedTopics.add(notice.topic_tag);
      }
    }

    const relevantNotices: Notice[] = [...matchedActive];
    for (const notice of state.notices) {
      if (
        notice.status === "superseded" &&
        (matchesStudentProfile(notice, profile) ||
          matchedTopics.has(notice.topic_tag))
      ) {
        relevantNotices.push(notice);
      }
    }

    const result = await answerCampusQuestion({
      question,
      profile,
      notices: relevantNotices,
      attachment,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to process UniBrief query.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
