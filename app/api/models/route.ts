import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function GET() {
  let antigravityModels = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-pro-exp-02-05",
    "gemini-2.0-flash-001",
    "claude-3.7-sonnet",
  ];

  // Auto-detect current Antigravity models dynamically
  try {
    const { stdout } = await execAsync("agy --list-models", { timeout: 2000 });
    if (stdout && stdout.trim()) {
      const parsed = stdout.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#") && !line.startsWith("===") && !line.includes("1.5"));
      if (parsed.length > 0) {
        antigravityModels = Array.from(new Set([...parsed, ...antigravityModels]));
      }
    }
  } catch (e) {
    try {
      const { stdout } = await execAsync("agy models list", { timeout: 2000 });
      if (stdout && stdout.trim()) {
        const parsed = stdout.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#") && !line.startsWith("===") && !line.includes("1.5"));
        if (parsed.length > 0) {
          antigravityModels = Array.from(new Set([...parsed, ...antigravityModels]));
        }
      }
    } catch (err) {}
  }

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
