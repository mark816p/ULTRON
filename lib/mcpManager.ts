import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema?: any;
}

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  status: "stopped" | "starting" | "running" | "error";
  tools: McpToolDefinition[];
}

export interface McpExecutionResult {
  success: boolean;
  tool: string;
  serverId: string;
  output: any;
  error?: string;
}

interface JsonRpcMessage {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

export class McpServer {
  public config: McpServerConfig;
  private process: ChildProcess | null = null;
  private messageIdCounter = 1;
  private pendingRequests = new Map<number | string, { resolve: (val: any) => void, reject: (err: any) => void, timeout: NodeJS.Timeout }>();
  private buffer = "";

  constructor(config: McpServerConfig) {
    this.config = config;
  }

  public async start(): Promise<void> {
    if (this.config.status === "running") return;
    this.config.status = "starting";

    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.config.command, this.config.args, {
          env: { ...process.env, ...this.config.env },
          stdio: ["pipe", "pipe", "pipe"],
          shell: process.platform === "win32",
        });

        if (!this.process.stdout || !this.process.stdin) {
          throw new Error("Failed to initialize stdio pipes");
        }

        this.process.stdout.on("data", (data) => this.handleData(data));
        this.process.stderr?.on("data", (data) => console.warn(`[MCP ${this.config.id} STDERR]`, data.toString()));

        this.process.on("exit", () => {
          this.config.status = "stopped";
          this.process = null;
          this.rejectAllPending(new Error("Server process exited"));
        });

        this.process.on("error", (err) => {
          this.config.status = "error";
          this.rejectAllPending(err);
          reject(err);
        });

        this.config.status = "running";
        
        // Initialize sequence
        this.initialize()
          .then(() => this.discoverTools())
          .then(() => resolve())
          .catch((err) => {
            this.config.status = "error";
            reject(err);
          });
      } catch (err) {
        this.config.status = "error";
        reject(err);
      }
    });
  }

  private handleData(data: Buffer) {
    this.buffer += data.toString("utf8");
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as JsonRpcMessage;
        if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
          const { resolve, reject, timeout } = this.pendingRequests.get(msg.id)!;
          clearTimeout(timeout);
          this.pendingRequests.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      } catch (e) {
        console.error(`[MCP ${this.config.id}] Failed to parse message:`, line);
      }
    }
  }

  public async sendRequest(method: string, params: any = {}, timeoutMs = 30000): Promise<any> {
    if (this.config.status !== "running" || !this.process?.stdin) {
      throw new Error(`Server ${this.config.id} is not running`);
    }

    const id = this.messageIdCounter++;
    const message: JsonRpcMessage = { jsonrpc: "2.0", id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      const payload = JSON.stringify(message) + "\n";
      this.process!.stdin!.write(payload);
    });
  }

  private async initialize() {
    await this.sendRequest("initialize", {
      clientInfo: { name: "ultron", version: "9.9.1" },
      protocolVersion: "2024-11-05",
      capabilities: {}
    }, 10000);
    await this.sendRequest("notifications/initialized", {});
  }

  private async discoverTools() {
    const res = await this.sendRequest("tools/list", {});
    if (res && Array.isArray(res.tools)) {
      this.config.tools = res.tools;
    }
  }

  public stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.config.status = "stopped";
  }

  private rejectAllPending(error: Error) {
    for (const [id, req] of this.pendingRequests.entries()) {
      clearTimeout(req.timeout);
      req.reject(error);
    }
    this.pendingRequests.clear();
  }
}

export class McpManager {
  private servers = new Map<string, McpServer>();
  private configPath = path.join(process.cwd(), "data", "mcp_servers.json");

  constructor() {
    this.loadConfigs();
    this.registerBlueprint("filesystem", "MCP Filesystem", "npx", ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()]);
    this.registerBlueprint("fetch", "MCP Fetch", "npx", ["-y", "@modelcontextprotocol/server-fetch"]);
    this.registerBlueprint("memory", "MCP Memory", "npx", ["-y", "@modelcontextprotocol/server-memory"]);
    this.registerBlueprint("git", "MCP Git", "npx", ["-y", "@modelcontextprotocol/server-git"]);
    this.registerBlueprint("playwright", "MCP Playwright", "npx", ["-y", "@modelcontextprotocol/server-playwright"]);
  }

  private loadConfigs() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, "utf8");
        const configs: McpServerConfig[] = JSON.parse(data);
        for (const config of configs) {
          config.status = "stopped";
          this.servers.set(config.id, new McpServer(config));
        }
      }
    } catch (e) {
      console.error("Failed to load MCP configs", e);
    }
  }

  public saveConfigs() {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const configs = Array.from(this.servers.values()).map(s => s.config);
      fs.writeFileSync(this.configPath, JSON.stringify(configs, null, 2));
    } catch (e) {
      console.error("Failed to save MCP configs", e);
    }
  }

  public registerBlueprint(id: string, name: string, command: string, args: string[], env?: Record<string, string>) {
    if (!this.servers.has(id)) {
      const config: McpServerConfig = { id, name, command, args, env, status: "stopped", tools: [] };
      this.servers.set(id, new McpServer(config));
      this.saveConfigs();
    }
  }

  public async spinUpServer(serverId: string): Promise<McpServer> {
    let server = this.servers.get(serverId);
    if (!server) {
      // Create dynamically if not found
      this.registerBlueprint(serverId, `MCP ${serverId}`, "npx", ["-y", `@modelcontextprotocol/server-${serverId}`]);
      server = this.servers.get(serverId)!;
    }
    if (server.config.status !== "running") {
      await server.start();
    }
    return server;
  }

  public getServers(): McpServerConfig[] {
    return Array.from(this.servers.values()).map(s => s.config);
  }

  public getAllTools(): (McpToolDefinition & { serverId: string })[] {
    const allTools: (McpToolDefinition & { serverId: string })[] = [];
    for (const server of this.servers.values()) {
      for (const tool of server.config.tools) {
        allTools.push({ ...tool, serverId: server.config.id });
      }
    }
    return allTools;
  }

  public async executeMcpTool(toolName: string, args: any): Promise<McpExecutionResult> {
    let targetServerId: string | null = null;
    
    // Find which server has this tool
    for (const server of this.servers.values()) {
      if (server.config.tools.some(t => t.name === toolName)) {
        targetServerId = server.config.id;
        break;
      }
    }

    if (!targetServerId) {
      // Fallback heuristics if tool not loaded yet
      if (toolName.includes("file") || toolName.includes("dir") || toolName.includes("path")) targetServerId = "filesystem";
      else if (toolName.includes("memory") || toolName.includes("graph")) targetServerId = "memory";
      else if (toolName.includes("fetch") || toolName.includes("web")) targetServerId = "fetch";
      else if (toolName.includes("git")) targetServerId = "git";
      else targetServerId = "fetch";
    }

    try {
      const server = await this.spinUpServer(targetServerId);
      const result = await server.sendRequest("tools/call", { name: toolName, arguments: args }, 30000);
      
      let outputText = result;
      if (result && Array.isArray(result.content)) {
        outputText = result.content.map((c: any) => c.text || JSON.stringify(c)).join("\n");
      }

      return {
        success: true,
        tool: toolName,
        serverId: targetServerId,
        output: outputText,
      };
    } catch (err: any) {
      return {
        success: false,
        tool: toolName,
        serverId: targetServerId,
        output: null,
        error: err?.message || String(err)
      };
    }
  }
}

export const mcpManager = new McpManager();
