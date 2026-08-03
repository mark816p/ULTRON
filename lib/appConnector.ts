import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface KnownApp {
  name: string;
  mcpServer?: string;
  mcpPackage?: string;
  customProtocol?: string;
  description: string;
}

export class AppConnector {
  private static instance: AppConnector;
  private connectedApps: Map<string, any> = new Map();
  
  private knownApps: KnownApp[] = [
    { name: 'VSCode', mcpPackage: '@modelcontextprotocol/server-vscode', description: 'Code Editor' },
    { name: 'Chrome', customProtocol: 'chrome-mcp', description: 'Browser' },
    { name: 'Slack', mcpPackage: '@modelcontextprotocol/server-slack', description: 'Messaging' },
    { name: 'Discord', description: 'Voice/Text Chat' },
    { name: 'Spotify', description: 'Music Player' },
    { name: 'GitHub', mcpPackage: '@modelcontextprotocol/server-github', description: 'Version Control' },
    { name: 'Figma', mcpPackage: '@modelcontextprotocol/server-figma', description: 'Design Tool' },
    { name: 'Notion', mcpPackage: '@modelcontextprotocol/server-notion', description: 'Notes & Wiki' },
    { name: 'Obsidian', description: 'Markdown Knowledge Base' },
    { name: 'Terminal', description: 'Command Line' },
    { name: 'Excel', description: 'Spreadsheets' }
  ];

  private constructor() {}

  public static getInstance(): AppConnector {
    if (!AppConnector.instance) {
      AppConnector.instance = new AppConnector();
    }
    return AppConnector.instance;
  }

  public discoverApps(): string[] {
    // Fallback naive discovery for Windows
    try {
      const output = execSync('tasklist /FI "STATUS eq RUNNING" /FO CSV').toString();
      const runningProcesses = output.split('\n').map(line => line.split(',')[0]?.replace(/"/g, ''));
      return this.knownApps.filter(app => runningProcesses.some(p => p && p.toLowerCase().includes(app.name.toLowerCase()))).map(a => a.name);
    } catch (e) {
      return ['Chrome', 'VSCode']; // mock
    }
  }

  public async connectToApp(appName: string): Promise<boolean> {
    const app = this.knownApps.find(a => a.name.toLowerCase() === appName.toLowerCase());
    if (!app) return false;

    if (app.mcpPackage) {
      try {
        // Attempt MCP connection via mock logic
        // e.g. npx -y @modelcontextprotocol/server-{appname}
        console.log(`Connecting to ${appName} via MCP...`);
        this.connectedApps.set(appName, { type: 'mcp', status: 'connected', context: {} });
        return true;
      } catch (e) {
        console.error(`Failed to connect via MCP to ${appName}`);
      }
    }
    
    // Fallback to native automation mock
    this.connectedApps.set(appName, { type: 'native', status: 'connected', context: {} });
    return true;
  }

  public async sendCommand(appName: string, command: string, args: string[]): Promise<any> {
    const connection = this.connectedApps.get(appName);
    if (!connection) throw new Error(`${appName} is not connected`);

    if (connection.type === 'mcp') {
      return { success: true, result: `Executed ${command} via MCP` };
    } else {
      // Native automation fallback (e.g. PowerShell mock)
      return { success: true, result: `Executed ${command} natively via PowerShell mock` };
    }
  }

  public async getAppContext(appName: string): Promise<any> {
    const connection = this.connectedApps.get(appName);
    if (!connection) return null;
    return {
      appName,
      status: connection.status,
      lastActive: Date.now(),
      data: 'Mock application context state'
    };
  }
}
