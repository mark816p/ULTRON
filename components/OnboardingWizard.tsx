"use client";

import { useState, useEffect } from "react";

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: (selectedEngine: string, selectedModel?: string) => void;
}

export default function OnboardingWizard({ isOpen, onClose }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [modelsData, setModelsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [selectedEngine, setSelectedEngine] = useState("auto");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-pro");
  const [customModel, setCustomModel] = useState("");

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      Promise.all([
        fetch("/api/sysinfo").then((res) => res.json()).catch(() => null),
        fetch("/api/models").then((res) => res.json()).catch(() => null),
      ]).then(([sys, mods]) => {
        setSysInfo(sys);
        setModelsData(mods);
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
    onClose(selectedEngine, finalModel);
  };

  const getAvailableModelsForEngine = () => {
    if (!modelsData) return ["gemini-2.5-pro", "gemini-1.5-pro", "llama3:8b", "qwen2.5:14b"];
    if (selectedEngine === "antigravity") return modelsData.antigravityModels || ["gemini-2.5-pro"];
    if (selectedEngine === "ollama") return modelsData.ollamaModels || ["llama3:8b"];
    if (selectedEngine === "lm-studio") return modelsData.lmStudioModels || ["local-model"];
    return [
      ...(modelsData.antigravityModels || []),
      ...(modelsData.ollamaModels || []),
      ...(modelsData.lmStudioModels || []),
    ];
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-hud-box">
        <div className="onboarding-header">
          <span className="pulse-dot" />
          <span className="hud-label">U.L.T.R.O.N. INITIALIZATION PROTOCOL</span>
          <span className="step-badge">STEP {step} OF 3</span>
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
                  You have full control over your AI mind. Choose any engine and exact model name below. You can change this at any time from the System tab!
                </p>

                <div className="engine-options">
                  <label className={`engine-card ${selectedEngine === "auto" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="engine"
                      value="auto"
                      checked={selectedEngine === "auto"}
                      onChange={() => setSelectedEngine("auto")}
                    />
                    <div>
                      <div className="engine-name">🔄 Auto Circuit-Breaker (Recommended)</div>
                      <div className="engine-info">
                        Dynamically attempts Antigravity Google Gemini models first, falling back to local Ollama or LM Studio Bionic.
                      </div>
                    </div>
                  </label>

                  <label className={`engine-card ${selectedEngine === "antigravity" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="engine"
                      value="antigravity"
                      checked={selectedEngine === "antigravity"}
                      onChange={() => setSelectedEngine("antigravity")}
                    />
                    <div>
                      <div className="engine-name">🌐 Antigravity Google Gemini Bridge</div>
                      <div className="engine-info">
                        Direct 100% Free local stdio bridge to Google Gemini 2.5 Pro / Flash without API keys.
                      </div>
                    </div>
                  </label>

                  <label className={`engine-card ${selectedEngine === "ollama" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="engine"
                      value="ollama"
                      checked={selectedEngine === "ollama"}
                      onChange={() => setSelectedEngine("ollama")}
                    />
                    <div>
                      <div className="engine-name">🦙 Ollama Local Server</div>
                      <div className="engine-info">
                        Strict 100% offline inference via localhost:11434 (Llama 3, Qwen, Mistral, DeepSeek).
                      </div>
                    </div>
                  </label>

                  <label className={`engine-card ${selectedEngine === "lm-studio" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="engine"
                      value="lm-studio"
                      checked={selectedEngine === "lm-studio"}
                      onChange={() => setSelectedEngine("lm-studio")}
                    />
                    <div>
                      <div className="engine-name">🖥️ LM Studio Bionic Local API</div>
                      <div className="engine-info">
                        Connects directly to LM Studio Bionic OpenAI-compatible server on localhost:1234.
                      </div>
                    </div>
                  </label>
                </div>

                <div style={{ marginTop: "14px", background: "rgba(0,0,0,0.6)", padding: "10px", borderRadius: "6px", border: "1px solid rgba(255,170,48,0.4)" }}>
                  <label style={{ fontSize: "11px", fontWeight: "bold", color: "#ffaa30", display: "block", marginBottom: "6px" }}>
                    🎯 EXACT AI MODEL SELECTION:
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="model-select-large"
                    style={{ marginBottom: "8px" }}
                  >
                    {getAvailableModelsForEngine().map((mod: string, i: number) => (
                      <option key={i} value={mod}>
                        {mod}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="Or type any custom model tag (e.g., llama3:8b, gemini-2.5-pro, local-model)..."
                    className="chat-input"
                    style={{ width: "100%", fontSize: "11px" }}
                  />
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
