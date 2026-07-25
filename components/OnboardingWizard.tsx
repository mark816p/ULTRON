"use client";

import { useState, useEffect } from "react";

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: (selectedEngine: string) => void;
}

export default function OnboardingWizard({ isOpen, onClose }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEngine, setSelectedEngine] = useState("auto");

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch("/api/sysinfo")
        .then((res) => res.json())
        .then((data) => {
          setSysInfo(data);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFinish = () => {
    localStorage.setItem("ultron_onboarded", "true");
    onClose(selectedEngine);
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
            <p>DIAGNOSING NEURAL HARDWARE VECTORS...</p>
          </div>
        ) : (
          <div className="onboarding-body">
            {step === 1 && (
              <div className="step-content">
                <h3 className="step-title">💻 SYSTEM SPECIFICATION BENCHMARK</h3>
                <p className="step-desc">
                  U.L.T.R.O.N. has analyzed your hardware to determine the optimal local LLM inference tier.
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
                  <span className="rec-title">OPTIMAL LOCAL MODELS:</span>
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
                <h3 className="step-title">🌐 AI BACKEND ENGINE SELECTION</h3>
                <p className="step-desc">
                  Choose how U.L.T.R.O.N. routes your cognitive prompts and autonomous research.
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
                        Dynamically attempts 100% Free Antigravity first, falling back to local Ollama or LM Studio if offline.
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
                      <div className="engine-name">🌐 Antigravity 100% Free Bridge</div>
                      <div className="engine-info">
                        Direct local stdio bridge to Google Antigravity models without cloud billing or API keys.
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
                        Strict 100% offline inference via localhost:11434 (Llama 3, Qwen, Mistral).
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
                      <div className="engine-name">🖥️ LM Studio Local API</div>
                      <div className="engine-info">
                        Connects to LM Studio OpenAI-compatible local server on localhost:1234.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="step-content">
                <h3 className="step-title">⚡ UNLIMITED ON-DEMAND TOOLS & MEMORY</h3>
                <p className="step-desc">
                  U.L.T.R.O.N. is equipped with full real-world autonomy and Never-Forget cognitive storage.
                </p>

                <div className="tools-list">
                  <div className="tool-item">
                    <span className="tool-icon">🧠</span>
                    <div>
                      <strong>Never-Forget Memory Engine:</strong> SQZ 13-token deduplication with SQLite FTS5 vector recall.
                    </div>
                  </div>
                  <div className="tool-item">
                    <span className="tool-icon">💻</span>
                    <div>
                      <strong>Terminal Execution Access:</strong> Unlimited local PowerShell/CMD access on demand.
                    </div>
                  </div>
                  <div className="tool-item">
                    <span className="tool-icon">🌐</span>
                    <div>
                      <strong>Web Scraper & DuckDuckGo:</strong> Live HTML scraping and RSS news aggregation.
                    </div>
                  </div>
                  <div className="tool-item">
                    <span className="tool-icon">📱</span>
                    <div>
                      <strong>WhatsApp GoWa Proxy:</strong> Send messages automatically via local Docker container (port 3001).
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
