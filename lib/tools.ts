import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface ToolResult {
  tool: string;
  success: boolean;
  data: any;
  error?: string;
}

export class UltronTools {
  private gowaUrl: string;

  constructor(gowaBaseUrl = "http://localhost:3001") {
    this.gowaUrl = gowaBaseUrl;
  }

  /**
   * Performs instant web search using DuckDuckGo HTML Lite (no API key required)
   */
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

      // Extract titles and snippets from DuckDuckGo lite HTML results
      const results: { title: string; snippet: string }[] = [];
      const snippetRegex = /<a class="result__snippet[^>]*>(.*?)<\/a>/gi;
      const titleRegex = /<a class="result__url[^>]*>(.*?)<\/a>/gi;

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

  /**
   * Fetches latest world news from major RSS feeds (BBC, Al Jazeera, NYT)
   */
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
      } catch (e) {
        console.warn(`Failed to fetch RSS from ${feed.name}`);
      }
    }

    return {
      tool: "get_news",
      success: true,
      data: headlines.length > 0 ? headlines : [{ source: "System", title: "All news feeds currently unreachable or timed out." }],
    };
  }

  /**
   * Reports system diagnostics, uptime, and host OS specs
   */
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

  /**
   * Sends a WhatsApp message via local GoWa REST container
   */
  public async sendWhatsapp(to: string, message: string): Promise<ToolResult> {
    try {
      // Clean phone number (remove spaces, +, hyphens)
      const cleanPhone = to.replace(/[^0-9]/g, "");
      const jid = cleanPhone.includes("@s.whatsapp.net") ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;

      const res = await fetch(`${this.gowaUrl}/send/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: jid, message }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`GoWa HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      return {
        tool: "whatsapp_send",
        success: true,
        data: { recipient: to, status: "sent", details: data },
      };
    } catch (err) {
      return {
        tool: "whatsapp_send",
        success: false,
        data: null,
        error: `WhatsApp sending failed: ${(err as Error).message}. Make sure GoWa Docker container is running on port 3001 and QR is scanned.`,
      };
    }
  }

  /**
   * Checks WhatsApp GoWa connection status
   */
  public async getWhatsappStatus(): Promise<ToolResult> {
    try {
      const res = await fetch(`${this.gowaUrl}/user/me`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        tool: "whatsapp_status",
        success: true,
        data: { connected: true, user: data },
      };
    } catch (err) {
      return {
        tool: "whatsapp_status",
        success: false,
        data: { connected: false },
        error: "GoWa WhatsApp container offline or not authenticated.",
      };
    }
  }

  /**
   * Executes a terminal/shell command on demand (unlimited, free local access)
   */
  public async executeCommand(command: string): Promise<ToolResult> {
    try {
      if (!command || !command.trim()) {
        throw new Error("No command string provided");
      }
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

  /**
   * Scrapes and extracts clean text content from a web page URL (unlimited on-demand web access)
   */
  public async scrapeUrl(url: string): Promise<ToolResult> {
    try {
      if (!url || !url.startsWith("http")) {
        throw new Error("Invalid URL provided. Must start with http:// or https://");
      }
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();

      // Remove scripts, styles, and comments, then strip HTML tags
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

  /**
   * Dispatches a tool by name and arguments
   */
  public async executeTool(name: string, args: any = {}): Promise<ToolResult> {
    switch (name) {
      case "search_web":
        return this.searchWeb(args.query || args.q || "");
      case "get_news":
        return this.getNews();
      case "get_sysinfo":
        return this.getSysinfo();
      case "whatsapp_send":
        return this.sendWhatsapp(args.to || args.phone || "", args.message || args.msg || "");
      case "whatsapp_status":
        return this.getWhatsappStatus();
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
