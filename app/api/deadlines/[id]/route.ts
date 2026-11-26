import { NextRequest, NextResponse } from "next/server";
import { toggleDeadlineCompleted } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    let completed: boolean | undefined;

    try {
      const body = (await req.json()) as { completed?: unknown };
      if (typeof body.completed === "boolean") {
        completed = body.completed;
      }
    } catch {
      // Allow empty body to toggle current state
    }

    const updated = await toggleDeadlineCompleted(id, completed);
    if (!updated) {
      return NextResponse.json(
        { error: `Deadline "${id}" not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ deadline: updated });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update deadline.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
