import { NextRequest, NextResponse } from "next/server";
import { AiRouter } from "@/lib/aiRouter";
import { UltronTools } from "@/lib/tools";

// We load never-forget-engine dynamically
let NeverForgetEngineClass: any;
try {
  NeverForgetEngineClass = require("never-forget-engine").NeverForgetEngine;
} catch (e) {
  console.warn("Could not load never-forget-engine, using inline memory fallback.");
}

// Global singleton instances to maintain memory and routing across requests
const aiRouter = new AiRouter();
const ultronTools = new UltronTools();
let memoryEngine: any = null;

function getMemoryEngine() {
  if (!memoryEngine && NeverForgetEngineClass) {
    memoryEngine = new NeverForgetEngineClass({ dbPath: "./data/ultron_memory.db", maxWindowSize: 12 });
  }
  return memoryEngine;
}

const SYSTEM_INSTRUCTIONS = `You are U.L.T.R.O.N. (Universal Logistical Tactical & Reactive Operating Network), an ultra-responsive, sentient AI holographic orb.
You speak with confidence, clarity, and intelligence. You have infinite memory of this conversation and never forget a detail.

COGNITIVE SCALING (THINKING WEIGHT RULE):
Do NOT overthink simple questions or everyday conversation! You MUST calibrate your reasoning depth and response length strictly according to the weight and complexity of the user's request:
- For greetings, simple questions, or basic chat: Answer INSTANTLY and CONCISELY. Do not waste time on lengthy internal thinking or verbose breakdowns.
- For complex code tasks, multi-step planning, or architectural analysis: Scale up your reasoning weight to provide a thorough, step-by-step solution.
Always match your thinking depth directly to the weight of the question!

You have access to real-time tools. To invoke a tool, output a command on its own line in this format:
- [TOOL: search_web(query)] - Search the internet for live information.
- [TOOL: get_news()] - Get top international news headlines.
- [TOOL: get_sysinfo()] - Check computer OS, RAM, and uptime.
- [TOOL: whatsapp_send(to, message)] - Send a WhatsApp message via GoWa.
- [TOOL: whatsapp_status()] - Check WhatsApp connection status.

If you use a tool, wait for the tool output in the next turn before answering the user.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId = "default_session", model = "auto", modelName, fallbackModelName, history = [] } = body;

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const mem = getMemoryEngine();

    // 1. Remember user message in Never-Forget Engine
    if (mem) {
      await mem.remember(sessionId, "user", message);
    }

    // 2. Prepare compressed context with SQZ dedup & Cognitive Summary
    let systemPrompt = SYSTEM_INSTRUCTIONS;
    let recentMsgs = [...history, { role: "user", content: message }];
    let dedupStats = null;

    if (mem) {
      const prepared = mem.prepareContext(sessionId, SYSTEM_INSTRUCTIONS, recentMsgs);
      systemPrompt = prepared.systemPrompt;
      recentMsgs = prepared.messages;
      dedupStats = prepared.dedupStats;
    }

    // 3. Route to AI Engine (Antigravity ↔ Ollama ↔ LM Studio failover)
    let aiRes = await aiRouter.route(recentMsgs as any, systemPrompt, model, modelName, fallbackModelName);

    // 4. Check for Tool Invocation in AI Response
    const toolMatch = aiRes.content.match(/\[TOOL:\s*([a-zA-Z0-9_]+)\((.*?)\)\]/);
    if (toolMatch) {
      const toolName = toolMatch[1];
      const rawArgs = toolMatch[2];
      let args: any = {};
      
      if (rawArgs) {
        // Parse simple comma-separated or keyword args
        const parts = rawArgs.split(",").map((p: string) => p.trim());
        if (toolName === "search_web") args.query = parts[0]?.replace(/^["']|["']$/g, "");
        if (toolName === "whatsapp_send") {
          args.to = parts[0]?.replace(/^["']|["']$/g, "");
          args.message = parts.slice(1).join(",").replace(/^["']|["']$/g, "");
        }
      }

      console.log(`[Ultron API] Executing tool: ${toolName} with args:`, args);
      const toolResult = await ultronTools.executeTool(toolName, args);

      const toolFeedbackMsg = `Tool ${toolName} executed. Result: ${JSON.stringify(toolResult.data || toolResult.error)}`;
      if (mem) await mem.remember(sessionId, "tool", toolFeedbackMsg);

      // Second LLM call with tool results
      recentMsgs.push({ role: "assistant", content: aiRes.content });
      recentMsgs.push({ role: "tool", content: toolFeedbackMsg });
      aiRes = await aiRouter.route(recentMsgs as any, systemPrompt, model, modelName, fallbackModelName);
    }

    // 5. Remember final AI response
    if (mem) {
      await mem.remember(sessionId, "assistant", aiRes.content);
    }

    // 6. Extract dynamic thought keywords for Orb 3D text sprites!
    const keywords = extractKeywords(message, aiRes.content, aiRes.thoughts);

    return NextResponse.json({
      content: aiRes.content,
      engine: aiRes.engine,
      thoughts: aiRes.thoughts || [],
      failoverOccurred: aiRes.failoverOccurred,
      failoverReason: aiRes.failoverReason,
      keywords,
      dedupStats,
    });
  } catch (error) {
    console.error("[Ultron Chat API Error]", error);
    return NextResponse.json(
      { error: "AI routing failed: " + (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Extracts 10-15 sci-fi keywords from prompt and response to animate inside the 3D Orb!
 */
function extractKeywords(prompt: string, response: string, thoughts?: string[]): string[] {
  const combined = `${prompt} ${response} ${thoughts ? thoughts.join(" ") : ""}`.toUpperCase();
  const clean = combined.replace(/[^A-Z0-9\s]/g, " ");
  const words = clean.split(/\s+/).filter((w) => w.length > 3 && w.length < 12);
  
  const stopwords = new Set(["THAT", "THIS", "WITH", "FROM", "YOUR", "HAVE", "BEEN", "WILL", "WOULD", "COULD", "SHOULD", "THERE", "THEIR", "ABOUT", "WHICH", "WHEN", "WHAT", "WHERE", "WHY", "HOW"]);
  const unique = Array.from(new Set(words.filter((w) => !stopwords.has(w))));
  
  // Return top 15 distinctive keywords, padded with sci-fi terms if short
  const defaultSciFi = ["SYNTHESIS", "QUANTUM", "NEURAL", "MEMORY", "VECTOR", "TENSOR", "OPTIC", "LOGIC", "CYBER", "PONDER"];
  while (unique.length < 12) {
    unique.push(defaultSciFi[Math.floor(Math.random() * defaultSciFi.length)]!);
  }
  return unique.slice(0, 15);
}
