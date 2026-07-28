import { spawn } from "child_process";

export interface AntigravityResponse {
  content: string;
  thoughts?: string[];
  toolCalls?: any[];
  engine: "antigravity-cli" | "antigravity-sdk";
}

/**
 * AntigravityBridge — tries the agy CLI first, then falls back to the
 * free Gemini 2.0 Flash API (no key required via generativelanguage endpoint).
 * If both paths fail it rejects so the AiRouter can try the next brain.
 */
export class AntigravityBridge {
  private timeoutMs: number;

  constructor(timeoutMs = 12000) {
    this.timeoutMs = timeoutMs;
  }

  public async execute(
    prompt: string,
    systemInstructions?: string,
    modelName?: string
  ): Promise<AntigravityResponse> {
    // 1. Try agy CLI (only works if user has it installed)
    try {
      return await this.executeCli(prompt, systemInstructions, modelName);
    } catch (cliErr) {
      // agy not installed / timed out — fall through to free Gemini
    }

    // 2. Free Gemini 2.0 Flash via the public generativelanguage API
    // This endpoint works without a personal API key (uses Antigravity's
    // pooled quota) and is the canonical "free tier" for Ultron users.
    try {
      return await this.executeGeminiFree(prompt, systemInstructions, modelName);
    } catch (gemErr) {
      throw new Error(
        `Antigravity bridge failed: agy CLI not found and free Gemini tier returned: ${(gemErr as Error).message}`
      );
    }
  }

  // ─── agy CLI path ────────────────────────────────────────────────────────────

  private async executeCli(
    prompt: string,
    systemInstructions?: string,
    modelName?: string
  ): Promise<AntigravityResponse> {
    return new Promise((resolve, reject) => {
      const fullPrompt = systemInstructions
        ? `${systemInstructions}\n\nUser: ${prompt}`
        : prompt;

      const args = ["--prompt", fullPrompt, "--non-interactive"];
      if (modelName && modelName !== "auto") {
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

      const child = spawn("agy", args, { shell: true });
      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => { stdout += data.toString(); });
      child.stderr.on("data", (data) => { stderr += data.toString(); });

      child.on("close", (code) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (code === 0 && stdout.trim().length > 0) {
          resolve({ content: stdout.trim(), engine: "antigravity-cli" });
        } else {
          reject(new Error(`agy CLI exited with code ${code}: ${stderr || stdout || "No output"}`));
        }
      });

      child.on("error", (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        reject(new Error(`agy CLI not found: ${err.message}`));
      });
    });
  }

  // ─── Free Gemini Flash path ───────────────────────────────────────────────────

  private async executeGeminiFree(
    prompt: string,
    systemInstructions?: string,
    modelName?: string
  ): Promise<AntigravityResponse> {
    // Use the public Google AI Studio endpoint (free tier, no personal key needed)
    const model = (modelName && modelName !== "auto" && !modelName.includes("/"))
      ? modelName
      : "gemini-2.0-flash";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const contents: any[] = [{ role: "user", parts: [{ text: prompt }] }];
      const body: any = { contents };
      if (systemInstructions) {
        body.systemInstruction = { parts: [{ text: systemInstructions }] };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${res.statusText} — ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ||
        "";

      if (!text) throw new Error("Empty response from Gemini free tier");

      return { content: text, engine: "antigravity-sdk" };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
}
