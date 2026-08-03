import { NextResponse } from "next/server";
import { DependencyManager } from "../../../lib/dependencyManager";
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
    try { await DependencyManager.ensureOllama(); } catch (e) { console.error(e); }
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
    try { await DependencyManager.ensureLMStudio(); } catch (e) { console.error(e); }
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

  const openRouterModels = [
    "openrouter/auto",
    "anthropic/claude-3.7-sonnet",
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "openai/o3-mini",
    "google/gemini-2.5-pro",
    "google/gemini-2.5-flash",
    "deepseek/deepseek-r1",
    "deepseek/deepseek-chat",
    "meta-llama/llama-3.3-70b-instruct",
    "qwen/qwen-2.5-72b-instruct",
    "mistralai/mistral-large",
    "x-ai/grok-2-1212",
  ];

  const openAiModels = [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4.5-preview",
    "o1",
    "o1-mini",
    "o3-mini",
  ];

  const geminiApiModels = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-pro-exp-02-05",
    "gemini-2.0-flash-001",
    "gemini-1.5-pro",
  ];

  const anthropicModels = [
    "claude-3-7-sonnet-20250219",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
  ];

  const deepSeekModels = [
    "deepseek-chat",
    "deepseek-reasoner",
  ];

  const groqModels = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
    "deepseek-r1-distill-llama-70b",
  ];

  const mistralModels = [
    "mistral-large-latest",
    "mistral-small-latest",
    "codestral-latest",
    "open-mixtral-8x22b",
  ];

  const xaiModels = [
    "grok-2-1212",
    "grok-2-vision-1212",
    "grok-beta",
  ];

  return NextResponse.json({
    antigravityModels,
    ollamaModels,
    lmStudioModels,
    openRouterModels,
    openAiModels,
    geminiApiModels,
    anthropicModels,
    deepSeekModels,
    groqModels,
    mistralModels,
    xaiModels,
  });
}

