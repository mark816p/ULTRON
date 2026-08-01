import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { openJarvisEngine } from "./openJarvis";
import { screenpipeEngine } from "./screenpipe";
import { accomplishCoworkerEngine } from "./accomplishCoworker";
import { openDesignEngine } from "./openDesign";
import { getNeverForgetEngine } from "./neverForgetEngine";

const execAsync = promisify(exec);

export interface ToolResult {
  tool: string;
  success: boolean;
  data: any;
  error?: string;
}

/**
 * Central tool execution registry for U.L.T.R.O.N. v9.4.5.
 * Provides web search, system diagnostics, OpenJarvis OS control,
 * Screenpipe timeline OCR, Accomplish Coworker, OpenDesign, and NeverForget memory engine integration.
 */
export class UltronTools {
  private gowaUrl: string;

  constructor(gowaBaseUrl = "http://127.0.0.1:3001") {
    this.gowaUrl = gowaBaseUrl;
  }

  public async searchWeb(query: string): Promise<ToolResult> {
    try {
      const encoded = encodeURIComponent(query);
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();

      const results: { title: string; snippet: string }[] = [];
      const snippetRegex = /<a class="result__snippet[^>]*>(.*?)<\/a>/gi;

      let sMatch;
      while ((sMatch = snippetRegex.exec(html)) !== null && results.length < 5) {
        const cleanSnippet = sMatch[1].replace(/<[^>]+>/g, "").trim();
        if (cleanSnippet) {
          results.push({ title: `Result ${results.length + 1}`, snippet: cleanSnippet });
        }
      }

      return {
        tool: "search_web",
        success: true,
        data: results.length > 0 ? results : [{ title: "Search", snippet: "No direct text snippets found for query." }],
      };
    } catch (err) {
      return {
        tool: "search_web",
        success: false,
        data: null,
        error: (err as Error).message,
      };
    }
  }

  public async getNews(): Promise<ToolResult> {
    const feeds = [
      { name: "BBC World", url: "http://feeds.bbci.co.uk/news/world/rss.xml" },
      { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
    ];

    const headlines: { source: string; title: string }[] = [];

    for (const feed of feeds) {
      try {
        const res = await fetch(feed.url, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const xml = await res.text();
          const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/gi;
          let match;
          let count = 0;
          while ((match = titleRegex.exec(xml)) !== null && count < 3) {
            const title = (match[1] || match[2] || "").replace(/<[^>]+>/g, "").trim();
            if (title && !title.toLowerCase().includes("bbc news") && !title.toLowerCase().includes("al jazeera")) {
              headlines.push({ source: feed.name, title });
              count++;
            }
          }
        }
      } catch (e) {}
    }

    return {
      tool: "get_news",
      success: true,
      data: headlines.length > 0 ? headlines : [{ source: "System", title: "All news feeds currently unreachable." }],
    };
  }

  public getSysinfo(): ToolResult {
    const uptimeSec = os.uptime();
    const hours = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);

    return {
      tool: "get_sysinfo",
      success: true,
      data: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: `${hours}h ${mins}m`,
        freeMemoryMb: Math.round(os.freemem() / (1024 * 1024)),
        totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024)),
        nodeVersion: process.version,
      },
    };
  }

  public async executeOpenJarvis(command: string, description?: string): Promise<ToolResult> {
    const res = await openJarvisEngine.executeComputerAction(command, description || "OpenJarvis computer control");
    return {
      tool: "openjarvis_execute",
      success: res.status === "completed" || res.status === "self_healed",
      data: res,
      error: res.status === "failed" ? res.result : undefined,
    };
  }

  public async runCoworkerTask(title: string, goal: string): Promise<ToolResult> {
    const task = await accomplishCoworkerEngine.createCoworkerTask(title, goal);
    return {
      tool: "coworker_run_task",
      success: true,
      data: task,
    };
  }

  public generateOpenDesign(name: string, description: string, category: any): ToolResult {
    const comp = openDesignEngine.generateDesignComponent(name, description, category || "card");
    return {
      tool: "opendesign_generate",
      success: true,
      data: comp,
    };
  }

  public searchScreenpipe(query: string): ToolResult {
    const results = screenpipeEngine.searchHistory(query);
    return {
      tool: "screenpipe_search",
      success: true,
      data: results,
    };
  }

  public getScreenpipeContext(): ToolResult {
    const context = screenpipeEngine.getLatestScreenContext();
    return {
      tool: "screenpipe_get_context",
      success: true,
      data: { context },
    };
  }

  public async executeCommand(command: string): Promise<ToolResult> {
    try {
      if (!command || !command.trim()) throw new Error("No command string provided");
      const { stdout, stderr } = await execAsync(command, { timeout: 20000 });
      return {
        tool: "execute_command",
        success: true,
        data: {
          command,
          stdout: stdout.trim() || "(no output)",
          stderr: stderr.trim() || undefined,
        },
      };
    } catch (err: any) {
      return {
        tool: "execute_command",
        success: false,
        data: { command, stdout: err.stdout?.trim(), stderr: err.stderr?.trim() },
        error: err.message || "Command execution failed",
      };
    }
  }

  public async scrapeUrl(url: string): Promise<ToolResult> {
    try {
      if (!url || !url.startsWith("http")) throw new Error("Invalid URL. Must start with http:// or https://");
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();

      const noScript = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "");

      const text = noScript.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const summaryText = text.length > 3000 ? text.substring(0, 3000) + "... (truncated)" : text;

      return {
        tool: "scrape_url",
        success: true,
        data: { url, length: text.length, content: summaryText },
      };
    } catch (err) {
      return {
        tool: "scrape_url",
        success: false,
        data: null,
        error: (err as Error).message,
      };
    }
  }

  public async executeTool(name: string, args: any = {}): Promise<ToolResult> {
    switch (name) {
      case "search_web":
        return this.searchWeb(args.query || args.q || "");
      case "get_news":
        return this.getNews();
      case "get_sysinfo":
        return this.getSysinfo();
      case "openjarvis_execute":
        return this.executeOpenJarvis(args.command || args.cmd || "", args.description);
      case "coworker_run_task":
        return this.runCoworkerTask(args.title || "Autonomous Coworker Job", args.goal || args.description || "");
      case "opendesign_generate":
        return this.generateOpenDesign(args.name || "UI Component", args.description || "Glass component", args.category);
      case "screenpipe_search":
        return this.searchScreenpipe(args.query || args.q || "");
      case "screenpipe_get_context":
        return this.getScreenpipeContext();
      case "neverforget_compact":
      case "compact_database": {
        const engine = getNeverForgetEngine();
        const stats = engine.compactDatabase();
        return { tool: "neverforget_compact", success: true, data: stats };
      }
      case "neverforget_search":
      case "search_memory": {
        const engine = getNeverForgetEngine();
        const results = engine.searchMemories(args.query || args.q || "", args.limit || 10);
        return { tool: "neverforget_search", success: true, data: results };
      }
      case "execute_command":
      case "run_command":
        return this.executeCommand(args.command || args.cmd || "");
      case "scrape_url":
      case "read_web":
        return this.scrapeUrl(args.url || "");
      default:
        return { tool: name, success: false, data: null, error: `Unknown tool: ${name}` };
    }
  }
}
