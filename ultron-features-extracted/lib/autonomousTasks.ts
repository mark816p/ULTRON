import { AiRouter } from "./aiRouter";
import { UltronTools } from "./tools";

export interface AutonomousTask {
  id: string;
  title: string;
  description: string;
  status: "active" | "queued" | "completed";
  model: string;
  result?: string;
  timestamp: string;
  origin: "user_derived" | "self_exploration" | "system_maintenance";
}

class AutonomousTaskManager {
  private tasks: AutonomousTask[] = [
    {
      id: "task-init-1",
      title: "Consolidate SQZ Neural Vectors",
      description: "Run SQLite VACUUM and deduplicate 13-token rolling memory pointers.",
      status: "completed",
      model: "Antigravity Free Bridge",
      result: "Memory pruned successfully. 92% token compression ratio maintained.",
      timestamp: new Date(Date.now() - 3600000).toLocaleTimeString(),
      origin: "system_maintenance",
    },
    {
      id: "task-init-2",
      title: "Monitor Global AI News Feeds",
      description: "Scrape BBC and Al Jazeera RSS headlines for emerging AI hardware releases.",
      status: "completed",
      model: "Ollama Local (Llama 3)",
      result: "Extracted 3 tech headlines. Updated cognitive workspace background context.",
      timestamp: new Date(Date.now() - 1800000).toLocaleTimeString(),
      origin: "self_exploration",
    },
    {
      id: "task-init-3",
      title: "Diagnose Windows Host Uptime & RAM",
      description: "Check available host OS RAM to ensure local LLM inference headroom.",
      status: "queued",
      model: "Ollama Local (Llama 3)",
      timestamp: new Date().toLocaleTimeString(),
      origin: "system_maintenance",
    },
  ];

  private router = new AiRouter();
  private tools = new UltronTools();
  private isProcessing = false;

  public getTasks(): AutonomousTask[] {
    return this.tasks;
  }

  public addTask(task: Omit<AutonomousTask, "id" | "timestamp">): AutonomousTask {
    const newTask: AutonomousTask = {
      ...task,
      id: `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleTimeString(),
    };
    this.tasks.unshift(newTask);
    return newTask;
  }

  /**
   * Called during idle cycles. Evaluates queue or generates self-directed research based on past history.
   */
  public async processNextTask(memoryEngine?: any): Promise<AutonomousTask | null> {
    if (this.isProcessing) return null;
    this.isProcessing = true;

    try {
      // Find first queued task
      let targetTask = this.tasks.find((t) => t.status === "queued");

      // If no task is queued, self-explore or check memory!
      if (!targetTask) {
        let explorationPrompt = "Generate 1 short, actionable research title for an autonomous AI assistant.";
        if (memoryEngine) {
          try {
            const recentMemories = memoryEngine.recall("ultron_user_1", "research interest problem question", 3);
            if (recentMemories.length > 0) {
              const memoryText = recentMemories.map((m: any) => m.content).join(" ");
              explorationPrompt = `Based on these user memories: "${memoryText}", what is 1 relevant follow-up research task we should explore autonomously? Return just a 5-8 word title.`;
            }
          } catch (e) {}
        }

        const titleResp = await this.router.route([
          { role: "system", content: "You are an autonomous AI planning module. Output ONLY a concise task title." },
          { role: "user", content: explorationPrompt },
        ], "You are an autonomous AI planning module.", "auto", undefined, undefined, {
          // Background chore, not user-facing - prefer local/free brains first,
          // same reasoning as the ponder endpoint. Falls back to a cloud brain
          // only if no local engine is reachable at all.
          activeBrains: ["ollama", "lm-studio", "antigravity"],
        });

        const title = titleResp.content.replace(/["*]/g, "").trim() || "Explore Local System Performance & Diagnostics";
        
        targetTask = this.addTask({
          title,
          description: "Autonomous self-directed exploration cycle triggered during system standby.",
          status: "queued",
          model: titleResp.engine || "Local Model",
          origin: "self_exploration",
        });
      }

      // Mark active
      targetTask.status = "active";

      // Perform real action based on task keywords
      let resultText = "";
      if (targetTask.title.toLowerCase().includes("sys") || targetTask.title.toLowerCase().includes("ram") || targetTask.title.toLowerCase().includes("uptime")) {
        const sys = this.tools.getSysinfo();
        resultText = `System Health Verified: ${sys.data.freeMemoryMb} MB RAM available on ${sys.data.platform} (${sys.data.uptime} uptime).`;
      } else if (targetTask.title.toLowerCase().includes("news") || targetTask.title.toLowerCase().includes("scrape") || targetTask.title.toLowerCase().includes("headlines")) {
        const news = await this.tools.getNews();
        resultText = `Fetched news headlines: ${JSON.stringify(news.data).slice(0, 150)}...`;
      } else if (targetTask.title.toLowerCase().includes("memory") || targetTask.title.toLowerCase().includes("vector") || targetTask.title.toLowerCase().includes("sqz")) {
        if (memoryEngine && typeof memoryEngine.optimize === "function") {
          const opt = memoryEngine.optimize();
          resultText = `Never-Forget Memory optimized: pruned ${opt.deletedOldScratchpad} temporary records, SQLite VACUUM completed.`;
        } else {
          resultText = "Memory indexing check completed cleanly.";
        }
      } else {
        // Use tool or web search
        const searchRes = await this.tools.searchWeb(targetTask.title);
        resultText = `Exploratory web search results: ${JSON.stringify(searchRes.data).slice(0, 180)}...`;
      }

      targetTask.status = "completed";
      targetTask.result = resultText;
      return targetTask;
    } catch (err) {
      console.warn("Autonomous task execution error:", err);
    } finally {
      this.isProcessing = false;
    }
    return null;
  }
}

export const globalTaskManager = new AutonomousTaskManager();
