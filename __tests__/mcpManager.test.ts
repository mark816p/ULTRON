import { McpManager, mcpManager } from "../lib/mcpManager";

describe("McpManager Blueprint & Auto-Spin-Up Engine", () => {
  test("should register standard server blueprints on initialization", () => {
    const manager = new McpManager();
    const servers = manager.getServers();
    expect(servers.length).toBeGreaterThanOrEqual(4);
    const ids = servers.map(s => s.id);
    expect(ids).toContain("filesystem");
    expect(ids).toContain("fetch");
    expect(ids).toContain("memory");
    expect(ids).toContain("everything");
  });

  test("should spin up server and populate tools", async () => {
    const manager = new McpManager();
    const config = await manager.spinUpServer("fetch");
    expect(config.status).toBe("running");
    expect(config.tools.length).toBeGreaterThan(0);
    expect(config.tools[0].name).toBe("fetch_url");
  });

  test("should execute tool and return structured execution result", async () => {
    const manager = new McpManager();
    const result = await manager.executeMcpTool("fetch_url", { url: "https://example.com" });
    expect(result.success).toBe(true);
    expect(result.serverId).toBe("fetch");
    expect(result.tool).toBe("fetch_url");
  });
});
