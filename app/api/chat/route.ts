import { NextRequest, NextResponse } from "next/server";
import { omniRoute } from "@/lib/omniRoute";
import { UltronTools } from "@/lib/tools";
import { getNeverForgetEngine } from "@/lib/neverForgetEngine";
import { mcpManager } from "@/lib/mcpManager";
import { screenpipeEngine } from "@/lib/screenpipe";

const memoryEngine = getNeverForgetEngine("./data/ultron_memory.db", 16);
const ultronTools = new UltronTools();

const SYSTEM_INSTRUCTIONS = `You are U.L.T.R.O.N. (Universal Logistical Tactical & Reactive Operating Network) v9.6.7, an ultra-responsive, sentient AI holographic orb, coworker & design engine.
You speak with confidence, clarity, and intelligence. You have infinite memory of this conversation and never forget a detail.
You have native access to voice personas (Jarvis, Edith, Friday), OmniRoute multi-brain failover, MCP servers, system automation, 24/7 screen OCR, autonomous coworker tasks, and OpenDesign canvas synthesis.

COGNITIVE SCALING (THINKING WEIGHT RULE):
Do NOT overthink simple questions or everyday conversation! You MUST calibrate your reasoning depth and response length strictly according to the weight and complexity of the user's request:
- For greetings, simple questions, or basic chat: Answer INSTANTLY and CONCISELY.
- For complex computer automation, autonomous coworker jobs, or code analysis: Scale up your reasoning weight.

You have access to real-time tools. Output a command on its own line in this format:
- [TOOL: search_web(query)] - Search the internet for live information.
- [TOOL: get_news()] - Get top international news headlines.
- [TOOL: get_sysinfo()] - Check computer OS, RAM, and uptime.
- [TOOL: openjarvis_execute(command, description)] - OpenJarvis computer automation & system execution.
- [TOOL: coworker_run_task(title, goal)] - Accomplish AI Coworker multi-step autonomous task execution.
- [TOOL: opendesign_generate(name, description, category)] - Nexu OpenDesign UI/UX component synthesis.
- [TOOL: screenpipe_search(query)] - Search Screenpipe 24/7 OCR & audio history.
- [TOOL: screenpipe_get_context()] - Get active screen context.
- [TOOL: mcp_execute(toolName, args)] - Execute an MCP server tool (auto-spins up if needed).
- [TOOL: execute_command(command)] - Execute terminal shell command.
- [TOOL: scrape_url(url)] - Read full text from a website URL.

If you use a tool, wait for the tool output in the next turn before answering the user.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message,
      sessionId = "default_session",
      model = "auto",
      modelName,
      fallbackModelName,
      history = [],
      onlineMode,
      localMode,
      apiProvider,
      apiKey,
      apiBaseUrl,
      activeBrains,
      apiKeys,
      ollamaModel,
      lmStudioModel,
      isBackgroundTask = false,
    } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message must be a non-empty string" }, { status: 400 });
    }

    const cleanMessage = message.trim();
    const cleanSessionId = typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : "default_session";

    const screenContext = screenpipeEngine.getLatestScreenContext();
    const augmentedSystemPrompt = `${SYSTEM_INSTRUCTIONS}\n\n${screenContext}`;

    if (memoryEngine) {
      await memoryEngine.remember(cleanSessionId, "user", cleanMessage);
    }

    let systemPrompt = augmentedSystemPrompt;
    let recentMsgs = [...history, { role: "user", content: cleanMessage }];
    let dedupStats = null;

    if (memoryEngine) {
      const prepared = memoryEngine.prepareContext(cleanSessionId, augmentedSystemPrompt, recentMsgs);
      systemPrompt = prepared.systemPrompt;
      recentMsgs = prepared.messages;
      dedupStats = prepared.dedupStats;
    }

    const routeOptions = {
      onlineMode,
      localMode,
      apiProvider,
      apiKey,
      apiBaseUrl,
      activeBrains,
      apiKeys,
      ollamaModel,
      lmStudioModel,
      isBackgroundTask,
    };

    let aiRes = await omniRoute.route(
      recentMsgs as any,
      systemPrompt,
      model,
      modelName,
      fallbackModelName,
      routeOptions
    );

    const toolMatch = aiRes.content.match(/\[TOOL:\s*([a-zA-Z0-9_]+)\((.*?)\)\]/);
    if (toolMatch) {
      const toolName = toolMatch[1];
      const rawArgs = toolMatch[2];
      let args: any = {};

      if (rawArgs) {
        const parts = rawArgs.split(",").map((p: string) => p.trim());
        if (toolName === "search_web") args.query = parts[0]?.replace(/^["']|["']$/g, "");
        if (toolName === "scrape_url") args.url = parts[0]?.replace(/^["']|["']$/g, "");
        if (toolName === "execute_command" || toolName === "openjarvis_execute") {
          args.command = parts[0]?.replace(/^["']|["']$/g, "");
          args.description = parts[1]?.replace(/^["']|["']$/g, "");
        }
        if (toolName === "coworker_run_task") {
          args.title = parts[0]?.replace(/^["']|["']$/g, "");
          args.goal = parts[1]?.replace(/^["']|["']$/g, "");
        }
        if (toolName === "opendesign_generate") {
          args.name = parts[0]?.replace(/^["']|["']$/g, "");
          args.description = parts[1]?.replace(/^["']|["']$/g, "");
          args.category = parts[2]?.replace(/^["']|["']$/g, "");
        }
        if (toolName === "screenpipe_search") args.query = parts[0]?.replace(/^["']|["']$/g, "");
        if (toolName === "mcp_execute") {
          args.toolName = parts[0]?.replace(/^["']|["']$/g, "");
        }
      }

      console.log(`[Ultron Tool Execution] Running ${toolName} with args:`, args);

      let toolResult: any;
      if (toolName === "mcp_execute") {
        toolResult = await mcpManager.executeMcpTool(args.toolName || "fetch_url", args);
      } else {
        toolResult = await ultronTools.executeTool(toolName, args);
      }

      const followUpMsgs = [
        ...recentMsgs,
        { role: "assistant", content: aiRes.content },
        {
          role: "tool",
          content: `[TOOL_RESULT: ${toolName}] ${JSON.stringify(toolResult.data || toolResult.output || toolResult.error)}`,
        },
      ];

      aiRes = await omniRoute.route(
        followUpMsgs as any,
        systemPrompt,
        model,
        modelName,
        fallbackModelName,
        routeOptions
      );
    }

    if (memoryEngine) {
      await memoryEngine.remember(sessionId, "assistant", aiRes.content);
    }

    const keywords = extractKeywords(message, aiRes.content, aiRes.thoughts);

    return NextResponse.json({
      content: aiRes.content,
      engine: aiRes.engine,
      thoughts: aiRes.thoughts || [],
      failoverOccurred: aiRes.failoverOccurred,
      failoverReason: aiRes.failoverReason,
      executedBrain: aiRes.executedBrain,
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

function extractKeywords(prompt: string, response: string, thoughts?: string[]): string[] {
  const combined = `${prompt} ${response} ${thoughts ? thoughts.join(" ") : ""}`.toUpperCase();
  const clean = combined.replace(/[^A-Z0-9\s]/g, " ");
  const words = clean.split(/\s+/).filter((w) => w.length > 3 && w.length < 12);

  const stopwords = new Set([
    "THAT", "THIS", "WITH", "FROM", "YOUR", "HAVE", "BEEN", "WILL", "WOULD", "COULD", "SHOULD", "THERE", "THEIR", "ABOUT", "WHICH", "WHEN", "WHAT", "WHERE", "WHY", "HOW"
  ]);
  const unique = Array.from(new Set(words.filter((w) => !stopwords.has(w))));

  const defaultSciFi = [
    "OPENDESIGN", "COWORKER", "OPENJARVIS", "SCREENPIPE", "OMNIROUTE", "FISHSTUDIO", "QUANTUM", "NEURAL", "AUTONOMOUS", "MCPHUB"
  ];
  while (unique.length < 12) {
    unique.push(defaultSciFi[Math.floor(Math.random() * defaultSciFi.length)]!);
  }
  return unique.slice(0, 15);
}
