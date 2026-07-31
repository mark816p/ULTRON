import { NextRequest, NextResponse } from "next/server";
import { screenpipeEngine } from "@/lib/screenpipe";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q");
    const history = screenpipeEngine.searchHistory(query || "");
    const isCapturing = screenpipeEngine.isCaptureEnabled();
    const latestContext = screenpipeEngine.getLatestScreenContext();

    return NextResponse.json({ history, isCapturing, latestContext });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, windowTitle, appName, ocrText, enabled } = body;

    if (action === "capture") {
      const frame = await screenpipeEngine.captureCurrentFrame(windowTitle, appName, ocrText);
      return NextResponse.json({ success: true, frame });
    }

    if (action === "toggle_capture") {
      screenpipeEngine.setCapturing(enabled);
      return NextResponse.json({ success: true, isCapturing: enabled });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
