import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface JarvisAction {
  id: string;
  type: "open_app" | "run_script" | "system_control" | "file_operation" | "workflow";
  command: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed" | "self_healed";
  result?: string;
  timestamp: number;
}

export interface JarvisAutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
}

export class OpenJarvisEngine {
  private actionsHistory: JarvisAction[] = [];
  private rules: JarvisAutomationRule[] = [
    {
      id: "rule_1",
      name: "Auto-Summarize Active Screen Context",
      trigger: "on_screen_idle",
      action: "summarize_screenpipe",
      enabled: true,
    },
    {
      id: "rule_2",
      name: "Autonomous System Performance Diagnostic",
      trigger: "hourly",
      action: "check_sysinfo",
      enabled: true,
    },
    {
      id: "rule_3",
      name: "Proactive Memory Index Compression",
      trigger: "daily",
      action: "compress_context",
      enabled: true,
    },
  ];

  /**
   * Executes a system command with self-healing automatic fallback
   */
  public async executeComputerAction(command: string, description: string): Promise<JarvisAction> {
    const action: JarvisAction = {
      id: Math.random().toString(36).substring(2, 9),
      type: this.determineActionType(command),
      command,
      description,
      status: "running",
      timestamp: Date.now(),
    };

    this.actionsHistory.push(action);

    try {
      console.log(`[OpenJarvis Engine] Executing computer action: ${command}`);
      const { stdout, stderr } = await execAsync(command, { timeout: 15000 });
      action.status = "completed";
      action.result = stdout.trim() || stderr.trim() || "Action completed with zero exit status";
    } catch (err: any) {
      console.warn(`[OpenJarvis Engine] Command failed, attempting self-healing fallback...`);
      try {
        // Self-healing fallback attempt (e.g. wrapping with cmd.exe or echo fallback)
        const fallbackCmd = process.platform === "win32" ? `cmd.exe /c "${command}"` : `sh -c "${command}"`;
        const { stdout } = await execAsync(fallbackCmd, { timeout: 10000 });
        action.status = "self_healed";
        action.result = `[Self-Healed via ${process.platform === "win32" ? "cmd.exe" : "sh"}]: ${stdout.trim()}`;
      } catch (fallbackErr: any) {
        action.status = "failed";
        action.result = err.message || "Action execution failed";
      }
    }

    return action;
  }

  private determineActionType(command: string): JarvisAction["type"] {
    const lower = command.toLowerCase();
    if (lower.startsWith("start") || lower.includes(".exe") || lower.includes("open ")) return "open_app";
    if (lower.includes("git") || lower.includes("npm") || lower.includes("node") || lower.includes("python")) return "run_script";
    if (lower.includes("shutdown") || lower.includes("restart") || lower.includes("taskkill")) return "system_control";
    if (lower.includes("dir") || lower.includes("copy") || lower.includes("mkdir") || lower.includes("del")) return "file_operation";
    return "workflow";
  }

  public getHistory(): JarvisAction[] {
    return this.actionsHistory.slice(-50);
  }

  public getRules(): JarvisAutomationRule[] {
    return this.rules;
  }

  public toggleRule(id: string, enabled: boolean) {
    const rule = this.rules.find((r) => r.id === id);
    if (rule) rule.enabled = enabled;
  }
}

export const openJarvisEngine = new OpenJarvisEngine();
