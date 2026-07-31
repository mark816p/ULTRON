import { AiRouter, ChatMessage, RouteOptions, RouterResponse } from "./aiRouter";
import { FREE_LLM_RESOURCES } from "./freeLlmResources";

export interface ProviderTelemetry {
  provider: string;
  latencyMs: number;
  successCount: number;
  errorCount: number;
  lastSuccessTimestamp: number;
}

export class OmniRouteEngine {
  private router: AiRouter;
  private keyCooldowns: Map<string, number> = new Map();
  private telemetry: Map<string, ProviderTelemetry> = new Map();

  constructor() {
    this.router = new AiRouter();
  }

  /**
   * Intelligently selects an active, non-cooled API key from a multi-key list
   */
  public selectKey(keys: string[]): string {
    if (!keys || keys.length === 0) return "";
    const validKeys = keys
      .map((k) => k.trim())
      .filter((k) => k && (!this.keyCooldowns.has(k) || Date.now() > this.keyCooldowns.get(k)!));

    if (validKeys.length === 0) {
      // If all keys are in cooldown, reset cooldown and pick first
      this.keyCooldowns.clear();
      return keys[0].trim();
    }

    const index = Math.floor(Math.random() * validKeys.length);
    return validKeys[index];
  }

  /**
   * Puts a rate-limited or failing API key into temporary cooldown (60 seconds)
   */
  public markKeyCooldown(key: string, cooldownMs = 60000) {
    if (key) {
      console.warn(`[OmniRoute Proxy] Key ${key.slice(0, 8)}... put into cooldown for ${cooldownMs}ms`);
      this.keyCooldowns.set(key, Date.now() + cooldownMs);
    }
  }

  /**
   * Records provider performance telemetry
   */
  public recordTelemetry(provider: string, latencyMs: number, success: boolean) {
    const existing = this.telemetry.get(provider) || {
      provider,
      latencyMs: 0,
      successCount: 0,
      errorCount: 0,
      lastSuccessTimestamp: Date.now(),
    };

    existing.latencyMs = existing.latencyMs === 0 ? latencyMs : Math.round((existing.latencyMs + latencyMs) / 2);
    if (success) {
      existing.successCount++;
      existing.lastSuccessTimestamp = Date.now();
    } else {
      existing.errorCount++;
    }

    this.telemetry.set(provider, existing);
  }

  public getTelemetry(): ProviderTelemetry[] {
    return Array.from(this.telemetry.values());
  }

  /**
   * Routes a request with latency-aware load balancing, multi-key rotation, and background local model offloading
   */
  public async route(
    messages: ChatMessage[],
    systemInstructions?: string,
    mode: "auto" | "antigravity" | "api-key" | "ollama" | "lm-studio" = "auto",
    exactModelName?: string,
    fallbackModelName?: string,
    options: RouteOptions & { isBackgroundTask?: boolean } = {}
  ): Promise<RouterResponse> {
    const startTime = Date.now();
    let preferredMode = mode;

    // Background tasks offload to local models (Ollama / LM Studio) to save API credits
    if (options.isBackgroundTask) {
      preferredMode = options.localMode || "ollama";
    }

    let parsedOptions = { ...options };

    // Multi-key rotation
    if (options.apiKey && options.apiKey.includes(",")) {
      const keys = options.apiKey.split(",").map((k) => k.trim()).filter(Boolean);
      parsedOptions.apiKey = this.selectKey(keys);
    }

    if (options.apiKeys) {
      const multiKeysMap: Record<string, string> = {};
      for (const [provider, keyStr] of Object.entries(options.apiKeys)) {
        if (keyStr.includes(",")) {
          const keys = keyStr.split(",").map((k) => k.trim()).filter(Boolean);
          multiKeysMap[provider] = this.selectKey(keys);
        } else {
          multiKeysMap[provider] = keyStr;
        }
      }
      parsedOptions.apiKeys = multiKeysMap;
    }

    try {
      const result = await this.router.route(
        messages,
        systemInstructions,
        preferredMode,
        exactModelName,
        fallbackModelName,
        parsedOptions
      );

      const latencyMs = Date.now() - startTime;
      this.recordTelemetry(result.executedBrain || preferredMode, latencyMs, true);
      return result;
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      this.recordTelemetry(preferredMode, latencyMs, false);

      if (parsedOptions.apiKey && (err.message.includes("429") || err.message.includes("rate limit"))) {
        this.markKeyCooldown(parsedOptions.apiKey);
      }

      // Failover for background tasks if local model is offline
      if (options.isBackgroundTask && preferredMode === "ollama") {
        console.warn("[OmniRoute Engine] Local background model failed, failing over to auto cloud API:", err.message);
        return await this.router.route(
          messages,
          systemInstructions,
          "auto",
          exactModelName,
          fallbackModelName,
          options
        );
      }
      throw err;
    }
  }
}

export const omniRoute = new OmniRouteEngine();
