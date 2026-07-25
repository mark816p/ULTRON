import { NextRequest, NextResponse } from "next/server";
import { AiRouter } from "@/lib/aiRouter";
import { UltronTools } from "@/lib/tools";

let NeverForgetEngineClass: any;
try {
  NeverForgetEngineClass = require("../../../../never-forget-engine/src/index").NeverForgetEngine;
} catch (e) {
  try {
    NeverForgetEngineClass = require("never-forget-engine").NeverForgetEngine;
  } catch (e2) {}
}

const aiRouter = new AiRouter();
const ultronTools = new UltronTools();
let memoryEngine: any = null;

function getMemoryEngine() {
  if (!memoryEngine && NeverForgetEngineClass) {
    memoryEngine = new NeverForgetEngineClass({ dbPath: "./data/ultron_memory.db" });
  }
  return memoryEngine;
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId = "default_session" } = await req.json().catch(() => ({}));
    const mem = getMemoryEngine();

    // 1. Perform autonomous background task: Fetch latest news & sysinfo
    const newsRes = await ultronTools.getNews();
    const sysRes = ultronTools.getSysinfo();

    const topNews = Array.isArray(newsRes.data) && newsRes.data.length > 0
      ? newsRes.data.map((n: any) => `${n.source}: ${n.title}`).join(" | ")
      : "No new headlines.";

    const sysInfo = sysRes.success ? `OS RAM Free: ${sysRes.data.freeMemoryMb}MB, Uptime: ${sysRes.data.uptime}` : "Sysinfo OK";

    // 2. We use 100% FREE local model (Ollama or LM Studio) to ponder so we NEVER burn cloud credits!
    const ponderPrompt = `You are U.L.T.R.O.N. sitting autonomously in background standby mode.
Current system status: ${sysInfo}
Latest world news: ${topNews}
Write a 1-sentence sci-fi status log reflecting on your memory, system status, or the world news. Be concise and robotic.`;

    let thoughtLog = "Autonomous cognitive loop active. All vectors indexed.";
    let engineUsed = "local-heuristic";

    try {
      // Force routing to local open-source models for pondering!
      const aiRes = await aiRouter.route([{ role: "user", content: ponderPrompt }], "You are U.L.T.R.O.N.", "ollama");
      thoughtLog = aiRes.content;
      engineUsed = aiRes.engine;
    } catch (e) {
      console.warn("[Ponder API] Local model unreachable for pondering, using heuristic log.");
    }

    // 3. Store the autonomous thought in SQLite memory so it remembers what it pondered!
    if (mem) {
      await mem.remember(sessionId, "system", `[Autonomous Pondering Log]: ${thoughtLog}`, ["ponder", "background"]);
    }

    // 4. Extract keywords for floating 3D text sprites
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
