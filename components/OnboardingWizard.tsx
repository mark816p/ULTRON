"use client";

import { useState, useEffect } from "react";
import { voiceEngine, VoiceProfile } from "@/lib/voiceEngine";

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: (selectedEngine: string, selectedModel?: string, selectedVoice?: string) => void;
}

export default function OnboardingWizard({ isOpen, onClose }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [modelsData, setModelsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [selectedEngine, setSelectedEngine] = useState("auto");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-pro");
  const [selectedLocalModel, setSelectedLocalModel] = useState("llama3:8b");
  const [customModel, setCustomModel] = useState("");
  const [onlineMode, setOnlineMode] = useState<"antigravity" | "api-key">("antigravity");
  const [localMode, setLocalMode] = useState<"ollama" | "lm-studio">("ollama");
  const [apiProvider, setApiProvider] = useState<string>("openrouter");
  const [apiKey, setApiKey] = useState<string>("");
  const [apiBaseUrl, setApiBaseUrl] = useState<string>("");
  const [selectedVoice, setSelectedVoice] = useState<VoiceProfile>("jarvis");

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      Promise.all([
        fetch("/api/sysinfo").then((res) => res.json()).catch(() => null),
        fetch("/api/models").then((res) => res.json()).catch(() => null),
      ]).then(([sys, mods]) => {
        setSysInfo(sys);
        setModelsData(mods);
        if (mods?.ollamaModels?.[0]) setSelectedLocalModel(mods.ollamaModels[0]);
        else if (mods?.lmStudioModels?.[0]) setSelectedLocalModel(mods.lmStudioModels[0]);
        setLoading(false);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFinish = () => {
    const finalModel = customModel.trim() || selectedModel;
    localStorage.setItem("ultron_onboarded", "true");
    localStorage.setItem("ultron_engine", selectedEngine);
    localStorage.setItem("ultron_model", finalModel);
    localStorage.setItem("ultron_local_model", selectedLocalModel);
    localStorage.setItem("ultron_online_mode", onlineMode);
    localStorage.setItem("ultron_local_mode", localMode);
    localStorage.setItem("ultron_api_provider", apiProvider);
    localStorage.setItem("ultron_api_key", apiKey);
    localStorage.setItem("ultron_api_base_url", apiBaseUrl);
    localStorage.setItem("ultron_voice_profile", selectedVoice);
    onClose(selectedEngine, finalModel, selectedVoice);
  };

  const getAntigravityModels = () => {
    return modelsData?.antigravityModels || [
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.0-pro-exp-02-05",
      "gemini-2.0-flash-001",
      "claude-3.7-sonnet",
    ];
  };

  const getLocalModels = () => {
    return [
      ...(modelsData?.ollamaModels || ["llama3:8b", "qwen2.5:14b", "mistral:7b"]),
      ...(modelsData?.lmStudioModels || ["local-model"]),
    ];
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-hud-box">
        <div className="onboarding-header">
          <span className="pulse-dot" />
          <span className="hud-label">U.L.T.R.O.N. INITIALIZATION PROTOCOL</span>
          <span className="step-badge">STEP {step} OF 3</span>
          <button
            type="button"
            onClick={handleFinish}
            className="collapse-btn"
            style={{ marginLeft: "10px", borderColor: "#fff", color: "#fff", fontWeight: "bold" }}
            title="Exit / Skip Onboarding"
          >
            ✕ EXIT
          </button>
        </div>

        {loading ? (
          <div className="onboarding-body loading-box">
            <div className="spinner-ring" />
            <p>DIAGNOSING HARDWARE & SCANNING LOCAL AI MODELS...</p>
          </div>
        ) : (
          <div className="onboarding-body">
            {step === 1 && (
              <div className="step-content">
                <h3 className="step-title">💻 SYSTEM SPECIFICATION BENCHMARK</h3>
                <p className="step-desc">
                  U.L.T.R.O.N. has analyzed your machine to determine optimal inference capabilities.
                </p>

                {sysInfo && (
                  <div className="specs-grid">
                    <div className="spec-card">
                      <span className="spec-label">HOST PROCESSOR</span>
                      <span className="spec-val">{sysInfo.cpuModel} ({sysInfo.cpuCores} CORES)</span>
                    </div>
                    <div className="spec-card">
                      <span className="spec-label">SYSTEM MEMORY (RAM)</span>
                      <span className="spec-val">
                        {sysInfo.freeMemMb} MB FREE / {sysInfo.totalMemMb} MB TOTAL
                      </span>
                    </div>
                    <div className="spec-card highlight">
                      <span className="spec-label">RECOMMENDED AI TIER</span>
                      <span className="spec-val tier-badge">{sysInfo.tierBadge}</span>
                    </div>
                  </div>
                )}

                <div className="recommendation-box">
                  <span className="rec-title">OPTIMAL LOCAL & CLOUD MODELS FOR YOUR HARDWARE:</span>
                  <ul>
                    {sysInfo?.recommendedModels?.map((m: string, idx: number) => (
                      <li key={idx}>⚡ {m}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="step-content">
                <h3 className="step-title">🌐 SELECT YOUR AI MIND & BACKEND</h3>
                <p className="step-desc">
                  Choose your primary cloud bridge AND your pre-installed local on-device model for offline failover!
                </p>

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "bold", color: "#00ff66", display: "block", marginBottom: "6px" }}>
                    ⚡ ROUTING STRATEGY (DUO MODE):
                  </label>
                  <select
                    value={selectedEngine}
                    onChange={(e) => setSelectedEngine(e.target.value)}
                    className="model-select-large"
                    style={{ border: "1px solid #00ff66" }}
                  >
                    <option value="auto">🔄 Auto Duo Mode (Try Online 1st ➔ Fallback to Local)</option>
                    <option value="antigravity">🌐 Strict Antigravity Free Bridge Only</option>
                    <option value="api-key">🔑 Strict Cloud API Key Only</option>
                    <option value="ollama">🦙 Strict Ollama Local Only</option>
                    <option value="lm-studio">🖥️ Strict LM Studio Bionic Only</option>
                  </select>
                </div>

                {/* SECTION 1: ONLINE ENGINE */}
                <div style={{ background: "rgba(0, 255, 102, 0.05)", border: "1px solid rgba(0, 255, 102, 0.3)", padding: "12px", borderRadius: "6px", marginBottom: "14px" }}>
                  <div style={{ fontSize: "11px", color: "#00ff66", fontWeight: "bold", marginBottom: "8px" }}>
                    1️⃣ ONLINE ENGINE (CLOUD INFERENCE)
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                    <button
                      type="button"
                      onClick={() => setOnlineMode("antigravity")}
                      className={`hud-tab-btn ${onlineMode === "antigravity" && selectedEngine !== "api-key" ? "active" : ""}`}
                      style={{ flex: 1, padding: "8px", fontSize: "11px", fontWeight: "bold" }}
                    >
                      🌐 Antigravity (Free)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOnlineMode("api-key");
                        if (selectedEngine === "antigravity") setSelectedEngine("api-key");
                      }}
                      className={`hud-tab-btn ${onlineMode === "api-key" || selectedEngine === "api-key" ? "active" : ""}`}
                      style={{ flex: 1, padding: "8px", fontSize: "11px", fontWeight: "bold" }}
                    >
                      🔑 API Key Provider
                    </button>
                  </div>

                  {(onlineMode === "api-key" || selectedEngine === "api-key") ? (
                    <>
                      <label style={{ fontSize: "10px", color: "#aaa", display: "block", marginBottom: "4px" }}>
                        CLOUD PROVIDER:
                      </label>
                      <select
                        value={apiProvider}
                        onChange={(e) => {
                          const prov = e.target.value;
                          setApiProvider(prov);
                          if (modelsData) {
                            const list =
                              prov === "openrouter" ? modelsData.openRouterModels :
                              prov === "openai" ? modelsData.openAiModels :
                              prov === "gemini" ? modelsData.geminiApiModels :
                              prov === "anthropic" ? modelsData.anthropicModels :
                              prov === "deepseek" ? modelsData.deepSeekModels :
                              prov === "groq" ? modelsData.groqModels :
                              prov === "mistral" ? modelsData.mistralModels :
                              prov === "xai" ? modelsData.xAiModels : [];
                            if (list && list[0]) setSelectedModel(list[0]);
                          }
                        }}
                        className="model-select-large"
                        style={{ marginBottom: "10px", fontSize: "12px" }}
                      >
                        <option value="openrouter">OpenRouter (Multi-Model Router)</option>
                        <option value="gemini">Google Gemini Native API</option>
                        <option value="openai">OpenAI Official API</option>
                        <option value="anthropic">Anthropic Claude Official API</option>
                        <option value="deepseek">DeepSeek Native API</option>
                        <option value="groq">Groq Ultra-Fast LPU API</option>
                        <option value="mistral">Mistral AI Official API</option>
                        <option value="xai">xAI Grok API</option>
                        <option value="custom">Custom OpenAI-Compatible Endpoint</option>
                      </select>

                      <label style={{ fontSize: "10px", color: "#aaa", display: "block", marginBottom: "4px" }}>
                        API KEY ({apiProvider.toUpperCase()}):
                      </label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={`Paste your ${apiProvider.toUpperCase()} API Key...`}
                        className="chat-input"
                        style={{ marginBottom: "10px", width: "100%", padding: "8px", fontSize: "12px" }}
                      />

                      {apiProvider === "custom" && (
                        <>
                          <label style={{ fontSize: "10px", color: "#aaa", display: "block", marginBottom: "4px" }}>
                            CUSTOM BASE URL:
                          </label>
                          <input
                            type="text"
                            value={apiBaseUrl}
                            onChange={(e) => setApiBaseUrl(e.target.value)}
                            placeholder="https://your-api.com/v1/chat/completions"
                            className="chat-input"
                            style={{ marginBottom: "10px", width: "100%", padding: "8px", fontSize: "12px" }}
                          />
                        </>
                      )}

                      <label style={{ fontSize: "10px", color: "#aaa", display: "block", marginBottom: "4px" }}>
                        MODEL NAME:
                      </label>
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="model-select-large"
                        style={{ marginBottom: "4px", fontSize: "12px" }}
                      >
                        {(
                          apiProvider === "openrouter" ? (modelsData?.openRouterModels || ["openrouter/auto", "anthropic/claude-3.7-sonnet", "openai/gpt-4o"]) :
                          apiProvider === "openai" ? (modelsData?.openAiModels || ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"]) :
                          apiProvider === "gemini" ? (modelsData?.geminiApiModels || ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-pro-exp-02-05"]) :
                          apiProvider === "anthropic" ? (modelsData?.anthropicModels || ["claude-3-7-sonnet-20250219", "claude-3-5-sonnet-20241022"]) :
                          apiProvider === "deepseek" ? (modelsData?.deepSeekModels || ["deepseek-r1", "deepseek-chat"]) :
                          apiProvider === "groq" ? (modelsData?.groqModels || ["llama-3.3-70b-versatile", "deepseek-r1-distill-llama-70b"]) :
                          apiProvider === "mistral" ? (modelsData?.mistralModels || ["mistral-large-latest", "codestral-latest"]) :
                          apiProvider === "xai" ? (modelsData?.xAiModels || ["grok-2-1212", "grok-beta"]) : ["custom-model"]
                        ).map((mod: string, i: number) => (
                          <option key={i} value={mod}>
                            {mod}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <label style={{ fontSize: "10px", color: "#aaa", display: "block", marginBottom: "4px" }}>
                        ANTIGRAVITY MODEL (100% FREE BRIDGE):
                      </label>
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="model-select-large"
                        style={{ marginBottom: "4px", fontSize: "12px" }}
                      >
                        {getAntigravityModels().map((mod: string, i: number) => (
                          <option key={i} value={mod}>
                            {mod}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>

                {/* SECTION 2: LOCAL ENGINE */}
                <div style={{ background: "rgba(0, 229, 255, 0.05)", border: "1px solid rgba(0, 229, 255, 0.3)", padding: "12px", borderRadius: "6px", marginBottom: "14px" }}>
                  <div style={{ fontSize: "11px", color: "#00e5ff", fontWeight: "bold", marginBottom: "8px" }}>
                    2️⃣ LOCAL ENGINE (OFFLINE ON-DEVICE FAILOVER)
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                    <button
                      type="button"
                      onClick={() => setLocalMode("ollama")}
                      className={`hud-tab-btn ${localMode === "ollama" ? "active" : ""}`}
                      style={{ flex: 1, padding: "8px", fontSize: "11px", fontWeight: "bold" }}
                    >
                      🦙 Ollama
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocalMode("lm-studio")}
                      className={`hud-tab-btn ${localMode === "lm-studio" ? "active" : ""}`}
                      style={{ flex: 1, padding: "8px", fontSize: "11px", fontWeight: "bold" }}
                    >
                      🖥️ LM Studio Bionic
                    </button>
                  </div>

                  <label style={{ fontSize: "10px", color: "#aaa", display: "block", marginBottom: "4px" }}>
                    SELECT LOCAL MODEL ({localMode.toUpperCase()}):
                  </label>
                  <select
                    value={selectedLocalModel}
                    onChange={(e) => setSelectedLocalModel(e.target.value)}
                    className="model-select-large"
                    style={{ marginBottom: "4px", fontSize: "12px" }}
                  >
                    {(localMode === "lm-studio" ? (modelsData?.lmStudioModels || ["local-model"]) : (modelsData?.ollamaModels || ["llama3:8b", "qwen2.5:14b", "mistral:7b"])).map((mod: string, i: number) => (
                      <option key={i} value={mod}>
                        {mod} (On-Device)
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: "14px", background: "rgba(0,0,0,0.6)", padding: "12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.25)" }}>
                  <label style={{ fontSize: "11px", fontWeight: "bold", color: "#fff", display: "block", marginBottom: "8px" }}>
                    🗣️ AI VOICE PERSONA (WITH TELEMETRY CHIRPS):
                  </label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {(["jarvis", "friday", "edith"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setSelectedVoice(v);
                          voiceEngine?.setProfile(v);
                          voiceEngine?.speak(`Greetings. I am ${v.toUpperCase()}, your automated AI assistant.`);
                        }}
                        className={`hud-tab-btn ${selectedVoice === v ? "active" : ""}`}
                        style={{ flex: 1, textAlign: "center", padding: "8px", fontWeight: "bold" }}
                      >
                        {v === "jarvis" && "👔 J.A.R.V.I.S."}
                        {v === "friday" && "👩‍🦰 F.R.I.D.A.Y."}
                        {v === "edith" && "👓 E.D.I.T.H."}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="step-content">
                <h3 className="step-title">⚡ ALWAYS-ACTIVE WAKE WORD & AUTONOMY</h3>
                <p className="step-desc">
                  U.L.T.R.O.N. is equipped with continuous voice listening and Never-Forget cognitive storage.
                </p>

                <div className="tools-list">
                  <div className="tool-item">
                    <span className="tool-icon">🎙️</span>
                    <div>
                      <strong>Always-Active Wake Word:</strong> Say <em>&quot;Ultron&quot;</em> anytime to wake up the neural link and speak your command hands-free.
                    </div>
                  </div>
                  <div className="tool-item">
                    <span className="tool-icon">🧠</span>
                    <div>
                      <strong>Never-Forget Memory Engine:</strong> SQZ 13-token deduplication with SQLite FTS5 vector recall.
                    </div>
                  </div>
                  <div className="tool-item">
                    <span className="tool-icon">💻</span>
                    <div>
                      <strong>Unlimited Autonomous Tasks:</strong> Zero task cap! Queue unlimited background explorations and terminal commands.
                    </div>
                  </div>
                  <div className="tool-item">
                    <span className="tool-icon">🔄</span>
                    <div>
                      <strong>Change AI Mind Anytime:</strong> You can switch your backend engine or specific model from the System tab whenever you want.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="onboarding-footer">
          {step > 1 && (
            <button type="button" onClick={() => setStep(step - 1)} className="hud-btn">
              ◀ PREVIOUS
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 3 ? (
            <button type="button" onClick={() => setStep(step + 1)} className="send-btn">
              NEXT STEP ▶
            </button>
          ) : (
            <button type="button" onClick={handleFinish} className="send-btn launch-btn">
              ⚡ INITIALIZE U.L.T.R.O.N.
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
