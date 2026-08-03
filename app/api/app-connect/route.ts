import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

declare global {
  var connectedMcpApps: Set<string>;
}

if (!globalThis.connectedMcpApps) {
  globalThis.connectedMcpApps = new Set();
}

const MCP_PACKAGES = [
  { name: 'github', pkg: '@modelcontextprotocol/server-github', desc: 'GitHub integration' },
  { name: 'filesystem', pkg: '@modelcontextprotocol/server-filesystem', desc: 'Local file system access' },
  { name: 'memory', pkg: '@modelcontextprotocol/server-memory', desc: 'Memory tools' },
  { name: 'fetch', pkg: '@modelcontextprotocol/server-fetch', desc: 'Web fetching' },
  { name: 'brave-search', pkg: '@modelcontextprotocol/server-brave-search', desc: 'Brave Search API' },
  { name: 'slack', pkg: '@modelcontextprotocol/server-slack', desc: 'Slack integration' },
  { name: 'postgres', pkg: '@modelcontextprotocol/server-postgres', desc: 'PostgreSQL access' },
  { name: 'playwright', pkg: '@modelcontextprotocol/server-playwright', desc: 'Playwright browser automation' },
  { name: 'puppeteer', pkg: '@modelcontextprotocol/server-puppeteer', desc: 'Puppeteer automation' }
];

export async function GET(request: Request) {
  return NextResponse.json({
    connectedApps: Array.from(globalThis.connectedMcpApps),
    availableMcpApps: MCP_PACKAGES,
    discoveredApps: []
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, appName, command, args } = body;

    switch (action) {
      case 'discover': {
        const cmd = process.platform === 'win32' ? 'tasklist' : 'ps aux';
        const { stdout } = await execAsync(cmd);
        const processes = stdout.split('\n').slice(0, 20); // Just mock top 20
        return NextResponse.json({ success: true, processes });
      }

      case 'list-mcp': {
        return NextResponse.json({ success: true, mcpPackages: MCP_PACKAGES });
      }

      case 'connect': {
        const mcp = MCP_PACKAGES.find(m => m.name === appName || m.pkg === appName);
        if (mcp) {
          globalThis.connectedMcpApps.add(mcp.name);
          return NextResponse.json({ 
            success: true, 
            message: `Connected to ${mcp.name}`,
            startCommand: `npx -y ${mcp.pkg}` 
          });
        }
        return NextResponse.json({ error: 'App not found in MCP registry' }, { status: 404 });
      }

      case 'disconnect': {
        if (appName && globalThis.connectedMcpApps.has(appName)) {
          globalThis.connectedMcpApps.delete(appName);
          return NextResponse.json({ success: true, message: `Disconnected ${appName}` });
        }
        return NextResponse.json({ error: 'App not connected' }, { status: 400 });
      }

      case 'send-command': {
        if (appName && globalThis.connectedMcpApps.has(appName)) {
          return NextResponse.json({ 
            success: true, 
            message: `Mock sending MCP command ${command} to ${appName}`,
            result: 'Mock result'
          });
        }
        // Fallback to OS command (unsafe in real prod, but mock here)
        return NextResponse.json({ success: true, message: 'OS Automation fallback not implemented' });
      }

      case 'get-context': {
        return NextResponse.json({ success: true, context: `Context for ${appName}` });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
