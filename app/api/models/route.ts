import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Canonical list of confirmed current Antigravity / Google Cloud models
// Ordered by capability tier (latest first)
const KNOWN_ANTIGRAVITY_MODELS = [
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-pro-exp-02-05",
  "gemini-2.0-flash-001",
  "gemini-2.0-flash-lite",
  "claude-sonnet-4-5",
  "claude-3-7-sonnet",
  "claude-3-5-haiku",
];

export async function GET() {
  let antigravityModels = [...KNOWN_ANTIGRAVITY_MODELS];

  // Auto-detect current Antigravity models dynamically via agy CLI
  try {
    const { stdout } = await execAsync("agy --list-models", { timeout: 3000 });
    if (stdout && stdout.trim()) {
      const parsed = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(
          (line) =>
            line &&
            !line.startsWith("#") &&
            !line.startsWith("===") &&
            !line.includes("1.5") &&
            !line.includes("legacy") &&
            (line.includes("gemini") || line.includes("claude") || line.includes("gpt"))
        );
      if (parsed.length > 0) {
        antigravityModels = Array.from(new Set([...parsed, ...KNOWN_ANTIGRAVITY_MODELS]));
      }
    }
  } catch (e) {
    try {
      const { stdout } = await execAsync("agy models list", { timeout: 3000 });
      if (stdout && stdout.trim()) {
        const parsed = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(
            (line) =>
              line &&
              !line.startsWith("#") &&
              !line.startsWith("===") &&
              !line.includes("1.5") &&
              !line.includes("legacy")
          );
        if (parsed.length > 0) {
          antigravityModels = Array.from(new Set([...parsed, ...KNOWN_ANTIGRAVITY_MODELS]));
        }
      }
    } catch (err) {
      // Fall through to use KNOWN_ANTIGRAVITY_MODELS
    }
  }

  let ollamaModels: string[] = [];
  let lmStudioModels: string[] = [];

  // Query Ollama local server
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.models && Array.isArray(data.models) && data.models.length > 0) {
        ollamaModels = data.models.map((m: any) => m.name || m.model).filter(Boolean);
      }
    }
  } catch (e) {}

  // Query LM Studio local server
  try {
    const res = await fetch("http://127.0.0.1:1234/v1/models", {
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        lmStudioModels = data.data.map((m: any) => m.id).filter(Boolean);
      }
    }
  } catch (e) {}

  return NextResponse.json({
    antigravityModels,
    ollamaModels,
    lmStudioModels,
  });
}

