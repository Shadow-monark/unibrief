import fs from "node:fs/promises";
import path from "node:path";
import { createSeedData } from "@/lib/seed";
import type { AlertLog, CampusDbState, Deadline, Notice } from "@/types/campus";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "campus-db.json");

declare global {
  var __askcampusDbState: CampusDbState | undefined;
  var __askcampusReadOnlyMode: boolean | undefined;
  var __askcampusWriteQueue: Promise<unknown> | undefined;
}

function cloneState(state: CampusDbState): CampusDbState {
  return structuredClone(state);
}

async function persistToDisk(state: CampusDbState): Promise<void> {
  if (globalThis.__askcampusReadOnlyMode) return;
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";
    if (
      code === "EROFS" ||
      code === "EACCES" ||
      code === "EPERM" ||
      code === "ENOENT"
    ) {
      globalThis.__askcampusReadOnlyMode = true;
      return;
    }
    globalThis.__askcampusReadOnlyMode = true;
  }
}

async function loadStateInternal(): Promise<CampusDbState> {
  if (globalThis.__askcampusDbState) {
    return globalThis.__askcampusDbState;
  }

  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<CampusDbState>;
    if (
      Array.isArray(parsed.notices) &&
      Array.isArray(parsed.deadlines) &&
      Array.isArray(parsed.alert_logs)
    ) {
      globalThis.__askcampusDbState = {
        notices: parsed.notices,
        deadlines: parsed.deadlines,
        alert_logs: parsed.alert_logs,
      };
      return globalThis.__askcampusDbState;
    }
  } catch {
    // Seed fresh state on first run or unreadable disk
  }

  const seeded = createSeedData();
  globalThis.__askcampusDbState = seeded;
  await persistToDisk(seeded);
  return globalThis.__askcampusDbState;
}

function enqueueMutation<T>(task: () => Promise<T>): Promise<T> {
  const prev = globalThis.__askcampusWriteQueue ?? Promise.resolve();
  const next = prev.then(task, task);
  globalThis.__askcampusWriteQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export async function getDbState(): Promise<CampusDbState> {
  const state = await loadStateInternal();
  return cloneState(state);
}

export async function mutateDbState<T>(
  mutator: (draft: CampusDbState) => Promise<T> | T
): Promise<T> {
  return enqueueMutation(async () => {
    const current = await loadStateInternal();
    const draft = cloneState(current);
    const result = await mutator(draft);
    globalThis.__askcampusDbState = draft;
    await persistToDisk(draft);
    return result;
  });
}

export async function toggleDeadlineCompleted(
  deadlineId: string,
  completed?: boolean
): Promise<Deadline | null> {
  return mutateDbState((draft) => {
    const target = draft.deadlines.find((d) => d.id === deadlineId);
    if (!target) return null;
    target.completed =
      typeof completed === "boolean" ? completed : !target.completed;
    return structuredClone(target);
  });
}

export async function appendAlertLog(alert: AlertLog): Promise<void> {
  await mutateDbState((draft) => {
    draft.alert_logs.unshift(alert);
  });
}

export async function getNoticeById(noticeId: string): Promise<Notice | null> {
  const state = await loadStateInternal();
  const found = state.notices.find((n) => n.id === noticeId);
  return found ? structuredClone(found) : null;
}

export function isUsingInMemoryFallback(): boolean {
  return Boolean(globalThis.__askcampusReadOnlyMode);
}
