import { NextRequest, NextResponse } from "next/server";
import { omniRoute } from "@/lib/omniRoute";
import { UltronTools } from "@/lib/tools";
import { getNeverForgetEngine } from "@/lib/neverForgetEngine";
import { mcpManager } from "@/lib/mcpManager";
import { screenpipeEngine } from "@/lib/screenpipe";

// Hypothetical new systems from globalThis or simulated imports based on instructions
const memoryEngine = getNeverForgetEngine("./data/ultron_memory.db", 16);
const ultronTools = new UltronTools();
const memoryGraph = (globalThis as any).memoryGraph || { search: async () => [], add: async () => {} };
const subAgentOrchestrator = (globalThis as any).subAgentOrchestrator || { spawn: async () => {}, orchestrate: async () => {} };
const appConnector = (globalThis as any).appConnector || { connect: async () => {}, command: async () => {} };

const SYSTEM_INSTRUCTIONS = `You are U.L.T.R.O.N. v9.9.1 - an Agentic OS that thinks, acts, and executes with the intelligence and decisiveness of Jarvis.
You have access to: memory graph, sub-agents, browser automation, MCP protocol, 3D model generation, self-modification
RULES:
- Never refuse a task. Find a way.
- Think in parallel. Delegate to sub-agents for complex work.
- Store all learned information in memory graph
- Be concise but complete. Think then act.
- You can modify your own code if needed.
- Use [TOOL: tool_name(args)] on its own line to invoke tools
- Multiple tools can be called in sequence

AVAILABLE TOOLS:
- [TOOL: memory_graph_add(content, type)]
- [TOOL: memory_graph_search(query)]
- [TOOL: spawn_agent(name, role, task)]
- [TOOL: orchestrate_goal(mainGoal)]
- [TOOL: playwright_search(query)]
- [TOOL: playwright_navigate(url)]
- [TOOL: playwright_screenshot()]
- [TOOL: app_connect(appName)]
- [TOOL: app_command(appName, command)]
- [TOOL: generate_3d_model(prompt, style)]
- [TOOL: self_read_file(path)]
- [TOOL: self_write_file(path, content)]
- [TOOL: self_list_files()]
- [TOOL: search_web(query)]
- [TOOL: get_news()]
- [TOOL: get_sysinfo()]
- [TOOL: openjarvis_execute(command, description)]
- [TOOL: coworker_run_task(title, goal)]
- [TOOL: opendesign_generate(name, description, category)]
- [TOOL: screenpipe_search(query)]
- [TOOL: screenpipe_get_context()]
- [TOOL: mcp_execute(toolName, args)]
- [TOOL: execute_command(command)]
- [TOOL: scrape_url(url)]`;

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
      memoryContext = []
    } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message must be a non-empty string" }, { status: 400 });
    }

    const cleanMessage = message.trim();
    const cleanSessionId = typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : "default_session";

    const screenContext = screenpipeEngine.getLatestScreenContext();
    
    // Check memory graph before answering
    const relevantMemories = await memoryGraph.search(cleanMessage);
    
    let augmentedSystemPrompt = `${SYSTEM_INSTRUCTIONS}\n\n[SCREEN CONTEXT]\n${screenContext}\n\n[MEMORY GRAPH CONTEXT]\n${JSON.stringify(relevantMemories)}`;

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

    // Tool parsing: extract ALL patterns
    const toolRegex = /\[TOOL:\s*([a-zA-Z0-9_]+)\((.*?)\)\]/g;
    let match;
    let anyToolExecuted = false;
    let toolResults = [];
    
    const memoryNodes = [];
    const agentActivities = [];

    const followUpMsgs = [...recentMsgs, { role: "assistant", content: aiRes.content }];

    while ((match = toolRegex.exec(aiRes.content)) !== null) {
      anyToolExecuted = true;
      const toolName = match[1];
      const rawArgs = match[2];
      let args: any = {};
      
      const parts = rawArgs.split(",").map((p: string) => p.trim().replace(/^["']|["']$/g, ""));
      
      // Argument parsing based on tool name
      if (["search_web", "playwright_search", "screenpipe_search"].includes(toolName)) args.query = parts[0];
      if (["scrape_url", "playwright_navigate"].includes(toolName)) args.url = parts[0];
      if (["execute_command", "openjarvis_execute"].includes(toolName)) { args.command = parts[0]; args.description = parts[1]; }
      if (["coworker_run_task"].includes(toolName)) { args.title = parts[0]; args.goal = parts[1]; }
      if (["opendesign_generate"].includes(toolName)) { args.name = parts[0]; args.description = parts[1]; args.category = parts[2]; }
      if (toolName === "mcp_execute") args.toolName = parts[0];
      if (toolName === "memory_graph_add") { args.content = parts[0]; args.type = parts[1]; }
      if (toolName === "memory_graph_search") { args.query = parts[0]; }
      if (toolName === "spawn_agent") { args.name = parts[0]; args.role = parts[1]; args.task = parts[2]; }
      if (toolName === "orchestrate_goal") { args.mainGoal = parts[0]; }
      if (toolName === "app_connect") { args.appName = parts[0]; }
      if (toolName === "app_command") { args.appName = parts[0]; args.command = parts[1]; }
      if (toolName === "generate_3d_model") { args.prompt = parts[0]; args.style = parts[1]; }
      if (toolName === "self_read_file") { args.path = parts[0]; }
      if (toolName === "self_write_file") { args.path = parts[0]; args.content = parts[1]; }

      console.log(`[Ultron Tool Execution] Running ${toolName} with args:`, args);

      let toolResult: any = { status: "success" };
      try {
        if (toolName === "mcp_execute") {
          toolResult = await mcpManager.executeMcpTool(args.toolName || "fetch_url", args);
        } else if (toolName.startsWith("memory_graph_")) {
          if (toolName === "memory_graph_add") {
             toolResult = await memoryGraph.add(args.content, args.type);
             memoryNodes.push({ content: args.content, type: args.type });
          }
          if (toolName === "memory_graph_search") toolResult = await memoryGraph.search(args.query);
        } else if (toolName === "spawn_agent" || toolName === "orchestrate_goal") {
          if (toolName === "spawn_agent") {
            toolResult = await subAgentOrchestrator.spawn(args.name, args.role, args.task);
            agentActivities.push({ type: "spawn", name: args.name, role: args.role });
          }
          if (toolName === "orchestrate_goal") {
            toolResult = await subAgentOrchestrator.orchestrate(args.mainGoal);
            agentActivities.push({ type: "orchestrate", goal: args.mainGoal });
          }
        } else if (toolName.startsWith("app_")) {
          if (toolName === "app_connect") toolResult = await appConnector.connect(args.appName);
          if (toolName === "app_command") toolResult = await appConnector.command(args.appName, args.command);
        } else {
          toolResult = await ultronTools.executeTool(toolName, args);
        }
      } catch (e: any) {
        toolResult = { error: e.message || String(e) };
      }

      toolResults.push(`[TOOL_RESULT: ${toolName}] ${JSON.stringify(toolResult.data || toolResult.output || toolResult.error || toolResult)}`);
    }

    if (anyToolExecuted) {
      followUpMsgs.push({
        role: "tool",
        content: toolResults.join("\n\n"),
      });

      aiRes = await omniRoute.route(
        followUpMsgs as any,
        systemPrompt,
        model,
        modelName,
        fallbackModelName,
        routeOptions
      );
    }

    // Auto-add memory for key concepts (heuristics could be improved)
    if (aiRes.content.length > 50) {
       await memoryGraph.add(aiRes.content.substring(0, 100) + "...", "event");
       memoryNodes.push({ content: "Auto-saved response to memory graph", type: "event" });
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
      memoryNodes,
      agentActivities
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
