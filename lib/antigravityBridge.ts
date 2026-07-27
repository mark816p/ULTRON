import { spawn } from "child_process";

export interface AntigravityResponse {
  content: string;
  thoughts?: string[];
  toolCalls?: any[];
  engine: "antigravity-cli" | "antigravity-sdk";
}

export class AntigravityBridge {
  private timeoutMs: number;

  constructor(timeoutMs = 12000) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Attempts to execute inference using the local Antigravity agy CLI binary.
   * The Python SDK path (google.antigravity) has been removed — it requires
   * a non-public internal package and will always throw ModuleNotFoundError.
   */
  public async execute(prompt: string, systemInstructions?: string, modelName?: string): Promise<AntigravityResponse> {
    return await this.executeCli(prompt, systemInstructions, modelName);
  }

  private async executeCli(prompt: string, systemInstructions?: string, modelName?: string): Promise<AntigravityResponse> {
    return new Promise((resolve, reject) => {
      const fullPrompt = systemInstructions ? `${systemInstructions}\n\nUser: ${prompt}` : prompt;

      const args = ["--prompt", fullPrompt, "--non-interactive"];
      if (modelName) {
        args.push("--model", modelName);
      }

      let finished = false;
      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          child.kill("SIGKILL");
          reject(new Error(`agy CLI timed out after ${this.timeoutMs}ms`));
        }
      }, this.timeoutMs);

      // Spawn agy CLI in non-interactive / one-shot mode
      const child = spawn("agy", args, { shell: true });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (code === 0 && stdout.trim().length > 0) {
          resolve({
            content: stdout.trim(),
            engine: "antigravity-cli",
          });
        } else {
          reject(new Error(`agy CLI exited with code ${code}: ${stderr || stdout || "No output"}`));
        }
      });

      child.on("error", (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        reject(new Error(`agy CLI not found or failed to start: ${err.message}. Install the Antigravity CLI or set an API key.`));
      });
    });
  }
}
