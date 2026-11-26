import { NextResponse } from "next/server";
import { getEngineStatus } from "@/lib/ai";
import { getDbState, isUsingInMemoryFallback } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await getDbState();
    return NextResponse.json({
      notices: state.notices,
      deadlines: state.deadlines,
      alert_logs: state.alert_logs,
      engine_status: getEngineStatus(),
      storage_mode: isUsingInMemoryFallback() ? "in-memory" : "file-json",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load campus state.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
