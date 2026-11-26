import { NextRequest, NextResponse } from "next/server";
import { verifyCampusRumor } from "@/lib/ai";
import { getDbState } from "@/lib/store";
import type { Notice } from "@/types/campus";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { claim?: string };
    const claim = typeof body.claim === "string" ? body.claim.trim() : "";

    if (!claim) {
      return NextResponse.json(
        { error: "Please paste a forwarded message or rumor to fact-check." },
        { status: 400 }
      );
    }

    const state = await getDbState();

    // Loop through all active + superseded circulars for comprehensive claim checking
    const allNotices: Notice[] = [];
    for (const notice of state.notices) {
      allNotices.push(notice);
    }

    const verification = await verifyCampusRumor({
      claim,
      notices: allNotices,
    });

    return NextResponse.json(verification);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to verify rumor.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
