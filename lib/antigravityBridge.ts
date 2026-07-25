import { spawn, exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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
   * Attempts to execute inference using 100% FREE local Antigravity methods (CLI or Python SDK)
   * without requiring any cloud API key or credit billing.
   */
  public async execute(prompt: string, systemInstructions?: string, modelName?: string): Promise<AntigravityResponse> {
    // Attempt 1: agy CLI binary
    try {
      return await this.executeCli(prompt, systemInstructions, modelName);
    } catch (cliErr) {
      console.warn("[AntigravityBridge] agy CLI execution failed or not found, attempting Python SDK bridge...", cliErr);
      // Attempt 2: Python SDK bridge
      try {
        return await this.executePythonSdk(prompt, systemInstructions, modelName);
      } catch (sdkErr) {
        console.error("[AntigravityBridge] Both local Antigravity methods failed. Need fallback to Ollama/LM Studio.", sdkErr);
        throw new Error("Antigravity Local Bridge unavailable: " + (sdkErr as Error).message);
      }
    }
  }

  private async executeCli(prompt: string, systemInstructions?: string, modelName?: string): Promise<AntigravityResponse> {
    return new Promise((resolve, reject) => {
      const fullPrompt = systemInstructions ? `${systemInstructions}\n\nUser: ${prompt}` : prompt;
      
      const args = ["--prompt", fullPrompt, "--non-interactive"];
      if (modelName) {
        args.push("--model", modelName);
      }

      // Spawn agy CLI in non-interactive / one-shot mode
      const child = spawn("agy", args, {
        shell: true,
        timeout: this.timeoutMs,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0 && stdout.trim().length > 0) {
          resolve({
            content: stdout.trim(),
            engine: "antigravity-cli",
          });
        } else {
          reject(new Error(`agy CLI exited with code ${code}: ${stderr || stdout}`));
        }
      });

      child.on("error", (err) => {
        reject(err);
      });
    });
  }

  private async executePythonSdk(prompt: string, systemInstructions?: string, modelName?: string): Promise<AntigravityResponse> {
    // Write a short inline Python script to invoke the google-antigravity async SDK
    const pyScript = `
import asyncio, sys, json
from google.antigravity import Agent, LocalAgentConfig, CapabilitiesConfig

async def main():
    config = LocalAgentConfig(
        system_instructions=${JSON.stringify(systemInstructions || "You are Ultron, an AI assistant.")},
        model_name=${JSON.stringify(modelName || "gemini-2.5-pro")},
        capabilities=CapabilitiesConfig()
    )
    async with Agent(config) as agent:
        res = await agent.chat(${JSON.stringify(prompt)})
        out = ""
        async for token in res:
            out += token
        print(json.dumps({"content": out}))

if __name__ == '__main__':
    asyncio.run(main())
`;

    // Base64 encode script to avoid shell quotation issues on Windows PowerShell/cmd
    const b64Script = Buffer.from(pyScript, "utf-8").toString("base64");
    const cmd = `python -c "import base64; exec(base64.b64decode('${b64Script}').decode('utf-8'))"`;

    const { stdout, stderr } = await execAsync(cmd, { timeout: this.timeoutMs });
    if (stdout && stdout.trim()) {
      try {
        const parsed = JSON.parse(stdout.trim());
        return {
          content: parsed.content || stdout.trim(),
          engine: "antigravity-sdk",
        };
      } catch (e) {
        return {
          content: stdout.trim(),
          engine: "antigravity-sdk",
        };
      }
    }
    throw new Error("Python SDK returned empty output. " + stderr);
  }
}
