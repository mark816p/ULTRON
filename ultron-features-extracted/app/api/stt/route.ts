import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio, isModelBundled } from "@/lib/speechToText";

// Expects { audio: number[] } - a Float32Array (16kHz mono PCM) serialized as
// a plain array by the client (see ChatPanel's mic capture pipeline).
export async function POST(req: NextRequest) {
  try {
    const { audio } = await req.json();
    if (!Array.isArray(audio) || audio.length === 0) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }
    const { text } = await transcribeAudio(Float32Array.from(audio));
    return NextResponse.json({ text });
  } catch (error) {
    console.error("[STT API]", error);
    return NextResponse.json(
      {
        error: (error as Error).message,
        hint: isModelBundled()
          ? undefined
          : "Whisper model not found in models/whisper-tiny.en - run scripts/setup-local-ai.sh once before building the installer.",
      },
      { status: 500 }
    );
  }
}
