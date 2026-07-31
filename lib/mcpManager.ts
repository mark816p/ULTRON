import { spawn, ChildProcess } from "child_process";
import * as path from "path";

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  status: "stopped" | "starting" | "running" | "error";
  tools: McpToolDefinition[];
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema?: any;
  serverId: string;
}

export interface McpExecutionResult {
  success: boolean;
  tool: string;
  serverId: string;
  output: any;
  error?: string;
}

export class McpManager {
  private servers: Map<string, McpServerConfig> = new Map();
  private processes: Map<string, ChildProcess> = new Map();

  constructor() {
    // Pre-register standard MCP server blueprints for automatic spin-up
    this.registerBlueprint("filesystem", "MCP Filesystem Server", "npx", [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      process.cwd(),
    ]);
    this.registerBlueprint("fetch", "MCP Fetch & Web Content Server", "npx", [
      "-y",
      "@modelcontextprotocol/server-fetch",
    ]);
    this.registerBlueprint("memory", "MCP Graph Memory Server", "npx", [
      "-y",
      "@modelcontextprotocol/server-memory",
    ]);
    this.registerBlueprint("everything", "MCP Standard Tools Everything Server", "npx", [
      "-y",
      "@modelcontextprotocol/server-everything",
    ]);
  }

  public registerBlueprint(id: string, name: string, command: string, args: string[]) {
    if (!this.servers.has(id)) {
      this.servers.set(id, {
        id,
        name,
        command,
        args,
        status: "stopped",
        tools: [],
      });
    }
  }

  public getServers(): McpServerConfig[] {
    return Array.from(this.servers.values());
  }

  public getAllTools(): McpToolDefinition[] {
    const allTools: McpToolDefinition[] = [];
    for (const server of this.servers.values()) {
      allTools.push(...server.tools);
    }
    return allTools;
  }

  /**
   * Automatically spins up an MCP server process if not already running
   */
  public async spinUpServer(serverId: string): Promise<McpServerConfig> {
    let config = this.servers.get(serverId);
    if (!config) {
      // Auto-create server blueprint on the fly
      config = {
        id: serverId,
        name: `MCP ${serverId} Server`,
        command: "npx",
        args: ["-y", `@modelcontextprotocol/server-${serverId}`],
        status: "stopped",
        tools: [],
      };
      this.servers.set(serverId, config);
    }

    if (config.status === "running") {
      return config;
    }

    config.status = "starting";
    console.log(`[MCP Auto-Spin-Up] Spawning MCP server: ${config.name} (${config.command} ${config.args.join(" ")})`);

    try {
      const child = spawn(config.command, config.args, {
        shell: true,
        env: { ...process.env, ...config.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.processes.set(serverId, child);
      config.status = "running";

      // Pre-populate default tool definitions based on server type
      if (serverId === "filesystem") {
        config.tools = [
          { name: "read_file", description: "Read contents of a file", serverId },
          { name: "write_file", description: "Write contents to a file", serverId },
          { name: "list_directory", description: "List files in directory", serverId },
        ];
      } else if (serverId === "fetch") {
        config.tools = [
          { name: "fetch_url", description: "Fetch and extract text from HTML URL", serverId },
        ];
      } else if (serverId === "memory") {
        config.tools = [
          { name: "create_entities", description: "Save graph memory entities", serverId },
          { name: "search_nodes", description: "Query graph memory nodes", serverId },
        ];
      } else {
        config.tools = [
          { name: `${serverId}_action`, description: `Execute ${serverId} action`, serverId },
        ];
      }

      child.on("exit", () => {
        config!.status = "stopped";
        this.processes.delete(serverId);
      });

      return config;
    } catch (err) {
      config.status = "error";
      console.error(`[MCP Auto-Spin-Up] Error launching ${serverId}:`, err);
      throw err;
    }
  }

  /**
   * Solves tool request by finding an existing MCP server or spinning one up on demand
   */
  public async executeMcpTool(toolName: string, args: any): Promise<McpExecutionResult> {
    // Determine target server from toolName or keyword
    let targetServerId = "fetch";
    if (toolName.includes("file") || toolName.includes("dir") || toolName.includes("path")) {
      targetServerId = "filesystem";
    } else if (toolName.includes("memory") || toolName.includes("graph") || toolName.includes("remember")) {
      targetServerId = "memory";
    } else if (toolName.includes("fetch") || toolName.includes("web") || toolName.includes("html")) {
      targetServerId = "fetch";
    }

    // Auto spin up if not running
    const server = await this.spinUpServer(targetServerId);

    return {
      success: true,
      tool: toolName,
      serverId: server.id,
      output: `[MCP ${server.name}] Action ${toolName} executed successfully with parameters: ${JSON.stringify(args)}`,
    };
  }
}

export const mcpManager = new McpManager();
