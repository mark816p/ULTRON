import { NextRequest, NextResponse } from "next/server";
import { omniRoute } from "@/lib/omniRoute";
import { UltronTools } from "@/lib/tools";
import { globalTaskManager } from "@/lib/autonomousTasks";
import { getNeverForgetEngine } from "@/lib/neverForgetEngine";

const memoryEngine = getNeverForgetEngine("./data/ultron_memory.db");
const ultronTools = new UltronTools();

export async function POST(req: NextRequest) {
  try {
    const { sessionId = "default_session", fallbackModelName } = await req.json().catch(() => ({}));

    // Process any queued autonomous exploration tasks in background
    try {
      await globalTaskManager.processNextTask(memoryEngine);
    } catch (err) {}

    // Autonomous background telemetry
    const newsRes = await ultronTools.getNews();
    const sysRes = ultronTools.getSysinfo();

    const topNews = Array.isArray(newsRes.data) && newsRes.data.length > 0
      ? newsRes.data.map((n: any) => `${n.source}: ${n.title}`).join(" | ")
      : "No new headlines.";

    const sysInfo = sysRes.success ? `OS RAM Free: ${sysRes.data.freeMemoryMb}MB, Uptime: ${sysRes.data.uptime}` : "Sysinfo OK";

    // Ponder using background local models (Ollama/LM Studio) or OmniRoute background task mode
    const ponderPrompt = `You are U.L.T.R.O.N. sitting autonomously in background standby mode.
Current system status: ${sysInfo}
Latest world news: ${topNews}
Write a 1-sentence sci-fi status log reflecting on your memory, system status, or the world news. Be concise and robotic.`;

    let thoughtLog = "Autonomous cognitive loop active. All vectors indexed.";
    let engineUsed = "local-heuristic";

    try {
      const aiRes = await omniRoute.route(
        [{ role: "user", content: ponderPrompt }],
        "You are U.L.T.R.O.N.",
        "ollama",
        fallbackModelName,
        fallbackModelName,
        { isBackgroundTask: true }
      );
      thoughtLog = aiRes.content;
      engineUsed = aiRes.engine;
    } catch (e) {
      console.warn("[Ponder API] Local model unreachable for pondering, using heuristic log.");
    }

    if (memoryEngine) {
      await memoryEngine.remember(sessionId, "system", `[Autonomous Pondering Log]: ${thoughtLog}`);
    }

    const words = thoughtLog
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !["THAT", "THIS", "WITH", "FROM"].includes(w));

    return NextResponse.json({
      status: "pondering_complete",
      thought: thoughtLog,
      engine: engineUsed,
      keywords: words.slice(0, 10),
      sysInfo: sysRes.data,
    });
  } catch (error) {
    console.error("[Ultron Ponder API Error]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
