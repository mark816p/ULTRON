// Local, offline speech-to-text - conceptually modeled on cjpais/Handy
// (press a shortcut, speak, get text back, entirely on-device) but built on
// transformers.js/ONNX rather than Handy's Tauri+whisper.cpp stack, since
// that's what actually fits into this Next.js/Electron app without adding a
// Rust toolchain.
//
// Model: Xenova/whisper-tiny.en (~40-75MB quantized) - small enough to ship
// inside the installer. See scripts/fetch-models.mjs: it downloads this into
// models/whisper-tiny.en/ at build time, so end users never fetch anything
// themselves. Swap MODEL_ID below for whisper-base.en (~145MB) for better
// accuracy at a larger install size, matching Handy's size/quality tradeoff.

import path from "path";
import fs from "fs";

const MODEL_ID = "Xenova/whisper-tiny.en";
const LOCAL_MODEL_DIR = path.join(process.cwd(), "models", "whisper-tiny.en");

let transcriberPromise: Promise<any> | null = null;

async function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      // If the model was pre-fetched by scripts/fetch-models.mjs, load it
      // straight from disk - no network call at all, even on first run.
      const useLocal = fs.existsSync(path.join(LOCAL_MODEL_DIR, "config.json"));
      if (useLocal) {
        env.localModelPath = path.join(process.cwd(), "models");
        env.allowRemoteModels = false;
      }
      return pipeline("automatic-speech-recognition", useLocal ? "whisper-tiny.en" : MODEL_ID, {
        dtype: "q8", // 8-bit quantized - the ~40-75MB size tier
      });
    })();
  }
  return transcriberPromise;
}

export interface TranscribeResult {
  text: string;
}

/**
 * Transcribe raw PCM audio (Float32Array, 16kHz mono - the format the
 * Web Audio API / MediaRecorder pipeline in the client hands us) to text.
 */
export async function transcribeAudio(audio: Float32Array): Promise<TranscribeResult> {
  const transcriber = await getTranscriber();
  const result = await transcriber(audio, { chunk_length_s: 30, stride_length_s: 5 });
  const text = Array.isArray(result) ? result.map((r: any) => r.text).join(" ") : result.text;
  return { text: (text || "").trim() };
}

export function isModelBundled(): boolean {
  return fs.existsSync(path.join(LOCAL_MODEL_DIR, "config.json"));
}
