import { NextResponse } from "next/server";

export async function GET() {
  const antigravityModels = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "claude-3.7-sonnet",
  ];

  let ollamaModels: string[] = ["llama3:8b", "qwen2.5:14b", "mistral:7b", "deepseek-r1:8b", "gemma2:9b"];
  let lmStudioModels: string[] = ["local-model", "qwen2.5-coder", "llama-3.1-8b-instruct"];

  // Query Ollama local server
  try {
    const res = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = await res.json();
      if (data.models && Array.isArray(data.models)) {
        ollamaModels = data.models.map((m: any) => m.name || m.model);
      }
    }
  } catch (e) {}

  // Query LM Studio local server
  try {
    const res = await fetch("http://localhost:1234/v1/models", { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        lmStudioModels = data.data.map((m: any) => m.id);
      }
    }
  } catch (e) {}

  return NextResponse.json({
    antigravityModels,
    ollamaModels,
    lmStudioModels,
  });
}
