import { AntigravityBridge, AntigravityResponse } from "./antigravityBridge";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface RouterOptions {
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  lmStudioBaseUrl?: string;
  lmStudioModel?: string;
  antigravityTimeoutMs?: number;
}

export interface RouterResponse {
  content: string;
  engine: "antigravity-cli" | "antigravity-sdk" | "ollama" | "lm-studio";
  thoughts?: string[];
  failoverOccurred: boolean;
  failoverReason?: string;
}

export class AiRouter {
  private antigravity: AntigravityBridge;
  private ollamaUrl: string;
  private ollamaModel: string;
  private lmStudioUrl: string;
  private lmStudioModel: string;

  constructor(options: RouterOptions = {}) {
    this.antigravity = new AntigravityBridge(options.antigravityTimeoutMs || 8000);
    this.ollamaUrl = options.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1/chat/completions";
    this.ollamaModel = options.ollamaModel || process.env.OLLAMA_MODEL || "llama3";
    this.lmStudioUrl = options.lmStudioBaseUrl || process.env.LM_STUDIO_BASE_URL || "http://localhost:1234/v1/chat/completions";
    this.lmStudioModel = options.lmStudioModel || process.env.LM_STUDIO_MODEL || "local-model";
  }

  /**
   * Executes inference with automatic circuit-breaker failover from Antigravity to local open-source models!
   */
  public async route(
    messages: ChatMessage[],
    systemInstructions?: string,
    preferredEngine: "auto" | "antigravity" | "ollama" | "lm-studio" = "auto",
    exactModelName?: string,
    fallbackModelName?: string
  ): Promise<RouterResponse> {
    const latestPrompt = messages[messages.length - 1]?.content || "";
    let failoverOccurred = false;
    let failoverReason = "";

    // 1. If preferred is antigravity or auto, try Antigravity Local Bridge first (100% Free)
    if (preferredEngine === "auto" || preferredEngine === "antigravity") {
      try {
        const res = await this.antigravity.execute(latestPrompt, systemInstructions, exactModelName);
        return {
          content: res.content,
          engine: res.engine,
          thoughts: res.thoughts,
          failoverOccurred: false,
        };
      } catch (err) {
        failoverOccurred = true;
        failoverReason = `Antigravity local bridge failed (${(err as Error).message}). Auto-switching to Ollama...`;
        console.warn("[AiRouter] " + failoverReason);
      }
    }

    // 2. Try Ollama (Local open source model)
    if (preferredEngine === "auto" || preferredEngine === "ollama" || failoverOccurred) {
      try {
        const res = await this.callOpenAiCompatible(
          this.ollamaUrl,
          fallbackModelName || (preferredEngine === "ollama" ? exactModelName : undefined) || this.ollamaModel,
          messages,
          systemInstructions
        );
        return {
          content: res,
          engine: "ollama",
          failoverOccurred,
          failoverReason: failoverOccurred ? failoverReason : undefined,
        };
      } catch (ollamaErr) {
        const msg = `Ollama connection failed (${(ollamaErr as Error).message}). Auto-switching to LM Studio...`;
        console.warn("[AiRouter] " + msg);
        failoverOccurred = true;
        failoverReason = failoverReason ? `${failoverReason} -> ${msg}` : msg;
      }
    }

    // 3. Try LM Studio (Local open source model)
    try {
      const res = await this.callOpenAiCompatible(
        this.lmStudioUrl,
        fallbackModelName || (preferredEngine === "lm-studio" ? exactModelName : undefined) || this.lmStudioModel,
        messages,
        systemInstructions
      );
      return {
        content: res,
        engine: "lm-studio",
        failoverOccurred,
        failoverReason: failoverOccurred ? failoverReason : undefined,
      };
    } catch (lmErr) {
      console.error("[AiRouter] All inference engines failed (Antigravity, Ollama, and LM Studio).", lmErr);
      throw new Error(`All local AI engines unreachable. Last error from LM Studio: ${(lmErr as Error).message}`);
    }
  }

  private async callOpenAiCompatible(
    url: string,
    model: string,
    messages: ChatMessage[],
    systemInstructions?: string
  ): Promise<string> {
    const fullMessages = systemInstructions
      ? [{ role: "system", content: systemInstructions }, ...messages]
      : messages;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for local models

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer local-no-key-required",
        },
        body: JSON.stringify({
          model,
          messages: fullMessages,
          temperature: 0.7,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "No response generated by local model.";
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
}
