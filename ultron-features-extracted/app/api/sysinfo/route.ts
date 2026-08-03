import { NextResponse } from "next/server";
import * as os from "os";

export async function GET() {
  try {
    const totalMemMb = Math.round(os.totalmem() / (1024 * 1024));
    const freeMemMb = Math.round(os.freemem() / (1024 * 1024));
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || "Unknown CPU";
    const cpuCores = cpus.length;
    
    let recommendedTier = "Antigravity Free Cloud / 1B Local";
    let recommendedModels = ["Llama 3.2 1B", "Mistral 7B Lite", "Antigravity Local Bridge"];
    let tierBadge = "LOW-SPEC (ULTRA-FAST)";

    if (totalMemMb > 16000) {
      recommendedTier = "High Precision Local Inference";
      recommendedModels = ["Qwen 2.5 7B / 14B", "Llama 3.1 8B", "Antigravity Pro Bridge"];
      tierBadge = "HIGH-SPEC (OPTIMAL TIER)";
    } else if (totalMemMb >= 8000) {
      recommendedTier = "Balanced Local Inference";
      recommendedModels = ["Llama 3.2 3B", "Phi-3 Mini 3.8B", "Antigravity Flash Bridge"];
      tierBadge = "MID-SPEC (BALANCED TIER)";
    }

    return NextResponse.json({
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      totalMemMb,
      freeMemMb,
      cpuModel,
      cpuCores,
      recommendedTier,
      recommendedModels,
      tierBadge,
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to retrieve sysinfo" }, { status: 500 });
  }
}
