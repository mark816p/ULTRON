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
  engine: "antigravity-cli" | "antigravity-sdk" | "api-key" | "ollama" | "lm-studio";
  thoughts?: string[];
  failoverOccurred: boolean;
  failoverReason?: string;
}

export interface RouteOptions {
  onlineMode?: "antigravity" | "api-key";
  localMode?: "ollama" | "lm-studio";
  apiProvider?: string;
  apiKey?: string;
  apiBaseUrl?: string;
}

export class AiRouter {
  private antigravity: AntigravityBridge;
  private ollamaUrl: string;
  private ollamaModel: string;
  private lmStudioUrl: string;
  private lmStudioModel: string;

  constructor(options: RouterOptions = {}) {
    this.antigravity = new AntigravityBridge(options.antigravityTimeoutMs || 8000);
    this.ollamaUrl = options.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1/chat/completions";
    this.ollamaModel = options.ollamaModel || process.env.OLLAMA_MODEL || "llama3";
    this.lmStudioUrl = options.lmStudioBaseUrl || process.env.LM_STUDIO_BASE_URL || "http://127.0.0.1:1234/v1/chat/completions";
    this.lmStudioModel = options.lmStudioModel || process.env.LM_STUDIO_MODEL || "local-model";
  }

  /**
   * Executes inference with automatic circuit-breaker failover from Online (API Key / Antigravity) to Local (Ollama / LM Studio Bionic)!
   */
  public async route(
    messages: ChatMessage[],
    systemInstructions?: string,
    preferredEngine: "auto" | "antigravity" | "api-key" | "ollama" | "lm-studio" = "auto",
    exactModelName?: string,
    fallbackModelName?: string,
    options: RouteOptions = {}
  ): Promise<RouterResponse> {
    const latestPrompt = messages[messages.length - 1]?.content || "";
    let failoverOccurred = false;
    let failoverReason = "";

    const onlineMode = options.onlineMode || (preferredEngine === "api-key" ? "api-key" : "antigravity");
    const localMode = options.localMode || (preferredEngine === "lm-studio" ? "lm-studio" : "ollama");

    // 1. If preferred is auto, antigravity, or api-key, try Online Engine first
    if (preferredEngine === "auto" || preferredEngine === "antigravity" || preferredEngine === "api-key") {
      if (onlineMode === "api-key" || preferredEngine === "api-key") {
        try {
          const content = await this.callCloudApi(
            options.apiProvider || "openrouter",
            options.apiKey || "",
            options.apiBaseUrl,
            exactModelName || "openrouter/auto",
            messages,
            systemInstructions
          );
          return {
            content,
            engine: "api-key",
            thoughts: [],
            failoverOccurred: false,
          };
        } catch (apiErr) {
          const msg = `Cloud API (${options.apiProvider || "openrouter"}) failed: ${(apiErr as Error).message}`;
          console.warn("[AiRouter] " + msg);
          if (preferredEngine === "api-key") {
            throw new Error(`Cloud API Key execution failed. Error: ${(apiErr as Error).message}`);
          }
          failoverOccurred = true;
          failoverReason = `${msg}. Auto-switching to Local (${localMode.toUpperCase()})...`;
        }
      } else {
        // Antigravity Free Bridge
        try {
          const res = await this.antigravity.execute(latestPrompt, systemInstructions, exactModelName);
          return {
            content: res.content,
            engine: res.engine,
            thoughts: res.thoughts,
            failoverOccurred: false,
          };
        } catch (err) {
          const msg = `Antigravity local bridge failed (${(err as Error).message})`;
          console.warn("[AiRouter] " + msg);
          if (preferredEngine === "antigravity") {
            throw new Error(`Antigravity Bridge failed: ${(err as Error).message}`);
          }
          failoverOccurred = true;
          failoverReason = `${msg}. Auto-switching to Local (${localMode.toUpperCase()})...`;
        }
      }
    }

    // 2. Try Local Engine (Ollama or LM Studio Bionic)
    if (preferredEngine === "auto" || preferredEngine === "ollama" || preferredEngine === "lm-studio" || failoverOccurred) {
      if (localMode === "lm-studio" || preferredEngine === "lm-studio") {
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
          const msg = `LM Studio Bionic failed (${(lmErr as Error).message}).`;
          console.warn("[AiRouter] " + msg);
          if (preferredEngine === "lm-studio") {
            throw new Error(`LM Studio Bionic is unreachable. Is LM Studio running? Error: ${(lmErr as Error).message}`);
          }
          failoverOccurred = true;
          failoverReason = failoverReason ? `${failoverReason} -> ${msg}` : msg;
          // Try Ollama as secondary backup if in auto mode
          try {
            const res = await this.callOpenAiCompatible(
              this.ollamaUrl,
              fallbackModelName || this.ollamaModel,
              messages,
              systemInstructions
            );
            return {
              content: res,
              engine: "ollama",
              failoverOccurred,
              failoverReason: failoverReason + " Auto-switched to Ollama.",
            };
          } catch (ollamaErr) {
            throw new Error(`All local AI engines unreachable. Last error: ${(ollamaErr as Error).message}`);
          }
        }
      } else {
        // Ollama local server
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
          const msg = `Ollama connection failed (${(ollamaErr as Error).message}).`;
          console.warn("[AiRouter] " + msg);
          if (preferredEngine === "ollama") {
            throw new Error(`Ollama is unreachable. Is Ollama running? Error: ${(ollamaErr as Error).message}`);
          }
          failoverOccurred = true;
          failoverReason = failoverReason ? `${failoverReason} -> ${msg}` : msg;
          // Try LM Studio as secondary backup if in auto mode
          try {
            const res = await this.callOpenAiCompatible(
              this.lmStudioUrl,
              fallbackModelName || this.lmStudioModel,
              messages,
              systemInstructions
            );
            return {
              content: res,
              engine: "lm-studio",
              failoverOccurred,
              failoverReason: failoverReason + " Auto-switched to LM Studio Bionic.",
            };
          } catch (lmErr) {
            throw new Error(`All local AI engines unreachable. Last error: ${(lmErr as Error).message}`);
          }
        }
      }
    }

    throw new Error("All configured AI engines are unreachable. Check your local AI server is running.");
  }

  private async callCloudApi(
    provider: string,
    apiKey: string,
    baseUrl?: string,
    model?: string,
    messages: ChatMessage[] = [],
    systemInstructions?: string
  ): Promise<string> {
    const key = apiKey ||
      (provider === "openrouter" ? process.env.OPENROUTER_API_KEY :
       provider === "openai" ? process.env.OPENAI_API_KEY :
       provider === "gemini" ? process.env.GEMINI_API_KEY :
       provider === "anthropic" ? process.env.ANTHROPIC_API_KEY :
       provider === "deepseek" ? process.env.DEEPSEEK_API_KEY :
       provider === "groq" ? process.env.GROQ_API_KEY :
       provider === "mistral" ? process.env.MISTRAL_API_KEY :
       provider === "xai" ? process.env.XAI_API_KEY : undefined);

    if (!key && provider !== "custom") {
      throw new Error(`API Key is missing for ${provider.toUpperCase()}. Please provide your API Key in UI model selection or env variables.`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout for cloud inference

    try {
      // 1. Google Gemini Native REST API
      if (provider === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || "gemini-2.5-pro"}:generateContent?key=${key}`;
        const contents = messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
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
          throw new Error(`HTTP ${res.status}: ${res.statusText} (${errText})`);
        }
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated by Gemini API.";
      }

      // 2. Anthropic Claude Native REST API
      if (provider === "anthropic") {
        const url = "https://api.anthropic.com/v1/messages";
        const anthropicMessages = messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          }));
        const body: any = {
          model: model || "claude-3-7-sonnet-20250219",
          max_tokens: 4096,
          messages: anthropicMessages,
        };
        if (systemInstructions) {
          body.system = systemInstructions;
        }
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "x-api-key": key || "",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}: ${res.statusText} (${errText})`);
        }
        const data = await res.json();
        return data.content?.[0]?.text || "No response generated by Anthropic API.";
      }

      // 3. OpenAI-Compatible Providers (OpenRouter, OpenAI, DeepSeek, Groq, Mistral, xAI, Custom)
      let url = baseUrl;
      if (!url) {
        if (provider === "openrouter") url = "https://openrouter.ai/api/v1/chat/completions";
        else if (provider === "openai") url = "https://api.openai.com/v1/chat/completions";
        else if (provider === "deepseek") url = "https://api.deepseek.com/chat/completions";
        else if (provider === "groq") url = "https://api.groq.com/openai/v1/chat/completions";
        else if (provider === "mistral") url = "https://api.mistral.ai/v1/chat/completions";
        else if (provider === "xai") url = "https://api.x.ai/v1/chat/completions";
        else url = "https://api.openai.com/v1/chat/completions";
      }

      const headers: any = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key || "local-no-key"}`,
      };
      if (provider === "openrouter") {
        headers["HTTP-Referer"] = "https://ultron.ai";
        headers["X-Title"] = "U.L.T.R.O.N.";
      }

      const fullMessages = systemInstructions
        ? [{ role: "system", content: systemInstructions }, ...messages]
        : messages;

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: model || (provider === "openrouter" ? "openrouter/auto" : "gpt-4o"),
          messages: fullMessages,
          temperature: 0.7,
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${res.statusText} (${errText})`);
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || `No response generated by ${provider.toUpperCase()}.`;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
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
