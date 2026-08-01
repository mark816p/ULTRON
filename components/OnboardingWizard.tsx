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
  const [activeBrains, setActiveBrains] = useState<string[]>(["antigravity", "ollama"]);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  
  const [depth3dEnabled, setDepth3dEnabled] = useState(false);
  const [voiceTestText, setVoiceTestText] = useState("");
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      const savedBrains = localStorage.getItem("ultron_active_brains");
      if (savedBrains) {
        try {
          const parsed = JSON.parse(savedBrains);
          if (Array.isArray(parsed) && parsed.length > 0) setActiveBrains(parsed);
        } catch (e) {}
      }
      const savedKeys = localStorage.getItem("ultron_api_keys");
      if (savedKeys) {
        try { setApiKeys(JSON.parse(savedKeys)); } catch (e) {}
      }
      
      const saved3d = localStorage.getItem("ultron_3d_awareness");
      if (saved3d) {
        setDepth3dEnabled(saved3d === "true");
      }
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
    localStorage.setItem("ultron_active_brains", JSON.stringify(activeBrains));
    localStorage.setItem("ultron_api_keys", JSON.stringify(apiKeys));
    localStorage.setItem("ultron_3d_awareness", depth3dEnabled ? "true" : "false");
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
                <h3 className="step-title">🌐 SELECT YOUR AI MIND & OMNIROUTE BACKEND</h3>
                <p className="step-desc">
                  U.L.T.R.O.N. v9.4.6.1 features <strong>OmniRoute Multi-Brain Failover</strong>. Tick active cloud and local LLM backends to cascade inference automatically if a provider rate-limits or goes offline!
                </p>

                {/* OMNIROUTE FEATURE BANNER & PRESETS */}
                <div style={{ background: "rgba(0, 240, 255, 0.08)", border: "1px solid rgba(0, 240, 255, 0.3)", padding: "12px 14px", borderRadius: "10px", marginBottom: "14px" }}>
                  <div style={{ fontSize: "11px", color: "#00f0ff", fontWeight: "bold", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>⚡ OMNIROUTE 1-CLICK ROUTING PRESETS:</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEngine("auto");
                        setActiveBrains(["antigravity", "ollama"]);
                      }}
                      style={{ background: "rgba(0, 255, 102, 0.15)", border: "1px solid #00ff66", color: "#00ff66", fontSize: "11px", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 1 }}
                    >
                      🔄 Auto-Duo (Cloud ➔ Local)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEngine("auto");
                        setActiveBrains(["groq", "gemini", "deepseek", "antigravity", "ollama"]);
                      }}
                      style={{ background: "rgba(255, 170, 48, 0.15)", border: "1px solid #ffaa30", color: "#ffaa30", fontSize: "11px", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 1 }}
                    >
                      🚀 High Performance Turbo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEngine("ollama");
                        setActiveBrains(["ollama", "lm-studio"]);
                      }}
                      style={{ background: "rgba(168, 85, 247, 0.15)", border: "1px solid #a855f7", color: "#a855f7", fontSize: "11px", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 1 }}
                    >
                      🔒 100% Offline Local
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "bold", color: "#00ff66", display: "block", marginBottom: "6px" }}>
                    ⚡ PRIMARY ROUTING STRATEGY:
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

                {/* DYNAMIC MULTI-BRAIN TICK MATRIX */}
                <div style={{ background: "rgba(0, 255, 102, 0.05)", border: "1px solid rgba(0, 255, 102, 0.3)", padding: "12px", borderRadius: "6px", marginBottom: "14px", maxHeight: "400px", overflowY: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <div style={{ fontSize: "11px", color: "#00ff66", fontWeight: "bold" }}>
                      🧠 TICK ACTIVE AI BRAINS ({activeBrains.length} SELECTED)
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => setActiveBrains(["antigravity", "gemini", "anthropic", "openai", "openrouter", "deepseek", "groq", "mistral", "xai", "ollama", "lm-studio"])}
                        style={{ background: "rgba(0, 255, 102, 0.2)", border: "1px solid #00ff66", color: "#00ff66", fontSize: "10px", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                      >
                        ⚡ Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveBrains(["antigravity", "ollama"])}
                        style={{ background: "rgba(255, 255, 255, 0.1)", border: "1px solid #666", color: "#ccc", fontSize: "10px", padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }}
                      >
                        🔄 Reset Default
                      </button>
                    </div>
                  </div>
                  <p style={{ fontSize: "11px", color: "#ccc", marginBottom: "12px", lineHeight: "1.4" }}>
                    U.L.T.R.O.N. dynamically cascades inference across all ticked brains in priority order. If one rate limits or goes offline, it automatically fails over to the next ticked brain!
                  </p>

                  <div style={{ fontSize: "10px", color: "#00e5ff", fontWeight: "bold", marginBottom: "6px" }}>
                    1️⃣ CLOUD APIs & FREE BRIDGE (ONLINE & PROXY):
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "14px" }}>
                    {[
                      { id: "antigravity", label: "🤖 Antigravity Bridge (Free)" },
                      { id: "openrouter", label: "🌐 OpenRouter API" },
                      { id: "gemini", label: "🔮 Google Gemini API" },
                      { id: "openai", label: "🧠 OpenAI GPT-4o API" },
                      { id: "anthropic", label: "🎭 Anthropic Claude API" },
                      { id: "deepseek", label: "🐳 DeepSeek API" },
                      { id: "groq", label: "⚡ Groq LPU API" },
                      { id: "mistral", label: "🌪️ Mistral AI API" },
                      { id: "xai", label: "✖️ xAI Grok API" },
                    ].map((brain) => (
                      <label key={brain.id} style={{ display: "flex", alignItems: "center", gap: "6px", background: activeBrains.includes(brain.id) ? "rgba(0, 255, 102, 0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${activeBrains.includes(brain.id) ? "#00ff66" : "rgba(255,255,255,0.15)"}`, padding: "8px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: activeBrains.includes(brain.id) ? "bold" : "normal", color: activeBrains.includes(brain.id) ? "#00ff66" : "#ccc" }}>
                        <input
                          type="checkbox"
                          checked={activeBrains.includes(brain.id)}
                          onChange={() => {
                            if (activeBrains.includes(brain.id)) {
                              if (activeBrains.length > 1) setActiveBrains(activeBrains.filter(b => b !== brain.id));
                            } else {
                              setActiveBrains([...activeBrains, brain.id]);
                            }
                          }}
                          style={{ accentColor: "#00ff66", cursor: "pointer", width: "14px", height: "14px" }}
                        />
                        <span>{brain.label}</span>
                      </label>
                    ))}
                  </div>

                  <div style={{ fontSize: "10px", color: "#00e5ff", fontWeight: "bold", marginBottom: "6px" }}>
                    2️⃣ LOCAL BIONIC HARDWARE ENGINES (OFFLINE FAILOVER):
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "14px" }}>
                    {[
                      { id: "ollama", label: "🦙 Ollama Hardware Engine" },
                      { id: "lm-studio", label: "🧪 LM Studio Bionic Engine" },
                    ].map((brain) => (
                      <label key={brain.id} style={{ display: "flex", alignItems: "center", gap: "6px", background: activeBrains.includes(brain.id) ? "rgba(0, 229, 255, 0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${activeBrains.includes(brain.id) ? "#00e5ff" : "rgba(255,255,255,0.15)"}`, padding: "8px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: activeBrains.includes(brain.id) ? "bold" : "normal", color: activeBrains.includes(brain.id) ? "#00e5ff" : "#ccc" }}>
                        <input
                          type="checkbox"
                          checked={activeBrains.includes(brain.id)}
                          onChange={() => {
                            if (activeBrains.includes(brain.id)) {
                              if (activeBrains.length > 1) setActiveBrains(activeBrains.filter(b => b !== brain.id));
                            } else {
                              setActiveBrains([...activeBrains, brain.id]);
                            }
                          }}
                          style={{ accentColor: "#00e5ff", cursor: "pointer", width: "14px", height: "14px" }}
                        />
                        <span>{brain.label}</span>
                      </label>
                    ))}
                  </div>

                  {/* CONFIGURATION FOR TICKED CLOUD APIs & LOCAL ENGINES */}
                  <div style={{ background: "rgba(0,0,0,0.5)", padding: "10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.2)" }}>
                    <div style={{ fontSize: "10px", color: "#ffcc00", fontWeight: "bold", marginBottom: "8px" }}>
                      ⚙️ CONFIGURATION FOR TICKED BRAINS:
                    </div>

                    {activeBrains.some(b => ["openrouter", "gemini", "openai", "anthropic", "deepseek", "groq", "mistral", "xai"].includes(b)) && (
                      <div style={{ marginBottom: "10px" }}>
                        {activeBrains.filter(b => ["openrouter", "gemini", "openai", "anthropic", "deepseek", "groq", "mistral", "xai"].includes(b)).map(prov => (
                          <div key={prov} style={{ marginBottom: "8px" }}>
                            <label style={{ fontSize: "10px", color: "#aaa", display: "block", marginBottom: "2px" }}>
                              🔑 {prov.toUpperCase()} API KEY:
                            </label>
                            <input
                              type="password"
                              value={apiKeys[prov] || ""}
                              onChange={(e) => {
                                const newKeys = { ...apiKeys, [prov]: e.target.value };
                                setApiKeys(newKeys);
                                if (prov === apiProvider) setApiKey(e.target.value);
                              }}
                              placeholder={`Paste your ${prov.toUpperCase()} API Key here...`}
                              className="chat-input"
                              style={{ width: "100%", padding: "6px", fontSize: "11px" }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {activeBrains.includes("ollama") && (
                      <div style={{ marginBottom: "8px" }}>
                        <label style={{ fontSize: "10px", color: "#aaa", display: "block", marginBottom: "2px" }}>
                          🦙 OLLAMA ON-DEVICE MODEL:
                        </label>
                        <select
                          value={selectedLocalModel}
                          onChange={(e) => setSelectedLocalModel(e.target.value)}
                          className="model-select-large"
                          style={{ width: "100%", padding: "6px", fontSize: "11px" }}
                        >
                          {(modelsData?.ollamaModels || ["llama3:8b", "qwen2.5:14b", "mistral:7b"]).map((mod: string, i: number) => (
                            <option key={i} value={mod}>{mod} (Local Ollama)</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {activeBrains.includes("lm-studio") && (
                      <div style={{ marginBottom: "8px" }}>
                        <label style={{ fontSize: "10px", color: "#aaa", display: "block", marginBottom: "2px" }}>
                          🧪 LM STUDIO BIONIC MODEL:
                        </label>
                        <select
                          value={selectedLocalModel}
                          onChange={(e) => setSelectedLocalModel(e.target.value)}
                          className="model-select-large"
                          style={{ width: "100%", padding: "6px", fontSize: "11px" }}
                        >
                          {(modelsData?.lmStudioModels || ["local-model"]).map((mod: string, i: number) => (
                            <option key={i} value={mod}>{mod} (LM Studio Bionic)</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
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
                  
                  <div className="tool-item">
                    <span className="tool-icon">🌐</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <strong>3D Spatial Awareness:</strong>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input 
                          type="checkbox" 
                          checked={depth3dEnabled}
                          onChange={(e) => setDepth3dEnabled(e.target.checked)}
                          style={{ accentColor: "#00ff66" }}
                        />
                        <span style={{ fontSize: "12px", color: "#ccc" }}>
                          Enable depth-reactive rendering (orb responds to how close your hand is to the camera)
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="tool-item" style={{ border: "1px solid rgba(0, 255, 102, 0.3)", padding: "10px", borderRadius: "6px", background: "rgba(0, 255, 102, 0.05)" }}>
                    <span className="tool-icon">🎤</span>
                    <div style={{ width: "100%" }}>
                      <strong>Microphone Test:</strong>
                      <p style={{ fontSize: "11px", color: "#aaa", margin: "4px 0 8px 0" }}>Test your voice input now before launching.</p>
                      
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (isListening) return;
                            setIsListening(true);
                            setVoiceTestText("");
                            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                            if (SpeechRecognition) {
                              const recognition = new SpeechRecognition();
                              recognition.continuous = false;
                              recognition.interimResults = true;
                              
                              recognition.onresult = (event: any) => {
                                let finalTranscript = "";
                                for (let i = event.resultIndex; i < event.results.length; ++i) {
                                  if (event.results[i].isFinal) {
                                    finalTranscript += event.results[i][0].transcript;
                                  }
                                }
                                if (finalTranscript) {
                                  setVoiceTestText(finalTranscript);
                                  setIsListening(false);
                                }
                              };
                              
                              recognition.onerror = () => setIsListening(false);
                              recognition.onend = () => setIsListening(false);
                              
                              try {
                                recognition.start();
                              } catch(e) {
                                setIsListening(false);
                              }
                            } else {
                              setVoiceTestText("Voice input not supported in this browser.");
                              setIsListening(false);
                            }
                          }}
                          className={`hud-btn ${isListening ? "active pulse" : ""}`}
                          style={{ minWidth: "120px" }}
                        >
                          {isListening ? "🔴 LISTENING..." : "🎙️ START TEST"}
                        </button>
                        
                        <div style={{ 
                          flex: 1, 
                          background: "rgba(0,0,0,0.4)", 
                          border: "1px solid rgba(255,255,255,0.1)", 
                          padding: "8px", 
                          borderRadius: "4px",
                          minHeight: "34px",
                          fontSize: "12px",
                          color: voiceTestText ? "#00ff66" : "#666"
                        }}>
                          {voiceTestText || "Say something..."}
                        </div>
                      </div>
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
