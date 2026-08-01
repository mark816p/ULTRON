"use client";

import { useState, useEffect } from "react";
import { FREE_LLM_RESOURCES } from "@/lib/freeLlmResources";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Engine settings
  modelMode: "auto" | "antigravity" | "api-key" | "ollama" | "lm-studio";
  onlineMode: "antigravity" | "api-key";
  localMode: "ollama" | "lm-studio";
  apiProvider: string;
  apiKey: string;
  apiBaseUrl: string;
  selectedModelName: string;
  selectedLocalModelName: string;
  modelsData: any;
  voiceProfile: any;
  speakOnTyping: boolean;
  // Callbacks
  onEngineChange: (v: "auto" | "antigravity" | "api-key" | "ollama" | "lm-studio") => void;
  onOnlineModeChange: (v: "antigravity" | "api-key") => void;
  onLocalModeChange: (v: "ollama" | "lm-studio") => void;
  onApiProviderChange: (v: string) => void;
  onApiKeyChange: (v: string) => void;
  onApiBaseUrlChange: (v: string) => void;
  onModelChange: (v: string) => void;
  onLocalModelChange: (v: string) => void;
  onVoiceProfileChange: (v: any) => void;
  onSpeakOnTypingChange: (v: boolean) => void;
  onOptimizeMemory: () => void;
  onOpenBenchmark: () => void;
  sysInfo: any;
  memOptResult: string | null;
}

const PROVIDERS = [
  { id: "openrouter", label: "OpenRouter", hint: "300+ models via one key" },
  { id: "gemini", label: "Gemini", hint: "Google Gemini API" },
  { id: "openai", label: "OpenAI", hint: "GPT-4o, o3, etc." },
  { id: "anthropic", label: "Claude", hint: "Anthropic Claude API" },
  { id: "groq", label: "Groq", hint: "Ultra-fast LPU inference" },
  { id: "deepseek", label: "DeepSeek", hint: "Cheap + powerful" },
  { id: "mistral", label: "Mistral", hint: "Mistral AI" },
  { id: "xai", label: "Grok (xAI)", hint: "xAI Grok models" },
  { id: "custom", label: "Custom", hint: "Any OpenAI-compatible endpoint" },
];

export default function SettingsModal(props: SettingsModalProps) {
  const {
    isOpen,
    onClose,
    modelMode,
    apiProvider,
    apiKey,
    voiceProfile,
    onEngineChange,
    onApiProviderChange,
    onApiKeyChange,
    onVoiceProfileChange,
    onOptimizeMemory,
    onOpenBenchmark,
    memOptResult,
  } = props;

  const [activeTab, setActiveTab] = useState<"engine" | "omniroute" | "opendesign" | "coworker" | "openjarvis" | "screenpipe" | "freellm" | "mcp" | "voice" | "system">("engine");
  const [showKey, setShowKey] = useState(false);
  const [useFishStudio, setUseFishStudio] = useState(true);
  const [fishApiKey, setFishApiKey] = useState("");
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  const [jarvisHistory, setJarvisHistory] = useState<any[]>([]);
  const [screenpipeHistory, setScreenpipeHistory] = useState<any[]>([]);
  const [screenpipeQuery, setScreenpipeQuery] = useState("");
  const [coworkerTasks, setCoworkerTasks] = useState<any[]>([]);
  const [openDesignComponents, setOpenDesignComponents] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUseFishStudio(localStorage.getItem("ultron_use_fish_studio") !== "false");
      setFishApiKey(localStorage.getItem("ultron_fish_api_key") || "");
    }
  }, []);

  const handleToggleFish = (val: boolean) => {
    setUseFishStudio(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("ultron_use_fish_studio", String(val));
    }
  };

  const handleSaveFishKey = (val: string) => {
    setFishApiKey(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("ultron_fish_api_key", val);
    }
  };

  const fetchMcpServers = async () => {
    try {
      const res = await fetch("/api/mcp");
      const data = await res.json();
      if (data.servers) setMcpServers(data.servers);
    } catch (e) {}
  };

  const fetchOpenDesignData = async () => {
    try {
      const res = await fetch("/api/opendesign");
      const data = await res.json();
      if (data.components) setOpenDesignComponents(data.components);
    } catch (e) {}
  };

  const fetchCoworkerTasks = async () => {
    try {
      const res = await fetch("/api/coworker");
      const data = await res.json();
      if (data.tasks) setCoworkerTasks(data.tasks);
    } catch (e) {}
  };

  const fetchOpenJarvisData = async () => {
    try {
      const res = await fetch("/api/openjarvis");
      const data = await res.json();
      if (data.history) setJarvisHistory(data.history);
    } catch (e) {}
  };

  const fetchScreenpipeData = async (query = "") => {
    try {
      const res = await fetch(`/api/screenpipe?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.history) setScreenpipeHistory(data.history);
    } catch (e) {}
  };

  useEffect(() => {
    if (activeTab === "mcp") fetchMcpServers();
    if (activeTab === "opendesign") fetchOpenDesignData();
    if (activeTab === "coworker") fetchCoworkerTasks();
    if (activeTab === "openjarvis") fetchOpenJarvisData();
    if (activeTab === "screenpipe") fetchScreenpipeData(screenpipeQuery);
  }, [activeTab, screenpipeQuery]);

  const handleSpinUpMcp = async (serverId: string) => {
    try {
      await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "spin_up", serverId }),
      });
      fetchMcpServers();
    } catch (e) {}
  };

  if (!isOpen) return null;

  return (
    <div className="glass-modal-overlay">
      <div className="glass-modal-container">
        {/* Header */}
        <div className="glass-modal-header">
          <div className="modal-title">
            <span className="glow-text">U.L.T.R.O.N. ARCHITECTURE CONFIG</span>
            <span className="version-badge">v9.6.7</span>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="tab-nav">
          {[
            { id: "engine", label: "AI Brain" },
            { id: "omniroute", label: "OmniRoute" },
            { id: "opendesign", label: "Nexu OpenDesign" },
            { id: "coworker", label: "Accomplish Coworker" },
            { id: "openjarvis", label: "OpenJarvis" },
            { id: "screenpipe", label: "Screenpipe 24/7" },
            { id: "freellm", label: "Free APIs" },
            { id: "mcp", label: "MCP Hub" },
            { id: "voice", label: "Fish Voices" },
            { id: "system", label: "System" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="modal-body">
          {activeTab === "engine" && (
            <div className="config-section">
              <label className="section-title">ACTIVE AI ENGINE MODE</label>
              <div className="chip-grid">
                {[
                  { id: "auto", label: "⚡ AUTO (OmniRoute)" },
                  { id: "antigravity", label: "🚀 ANTIGRAVITY" },
                  { id: "api-key", label: "🔑 API KEYS" },
                  { id: "ollama", label: "🦙 OLLAMA" },
                  { id: "lm-studio", label: "💻 LM STUDIO" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`chip-btn ${modelMode === m.id ? "active" : ""}`}
                    onClick={() => onEngineChange(m.id as any)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {modelMode === "api-key" && (
                <div className="input-group mt-4">
                  <label className="input-label">CLOUD API PROVIDER</label>
                  <select
                    className="glass-input"
                    value={apiProvider}
                    onChange={(e) => onApiProviderChange(e.target.value)}
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} - {p.hint}
                      </option>
                    ))}
                  </select>

                  <label className="input-label mt-3">API KEY(S) (Comma-separated for multi-key load balancing)</label>
                  <div className="key-input-wrapper">
                    <input
                      type={showKey ? "text" : "password"}
                      className="glass-input"
                      placeholder="sk-... (enter multiple keys separated by commas)"
                      value={apiKey}
                      onChange={(e) => onApiKeyChange(e.target.value)}
                    />
                    <button type="button" className="eye-btn" onClick={() => setShowKey(!showKey)}>
                      {showKey ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "omniroute" && (
            <div className="config-section">
              <label className="section-title">OMNIROUTE INTELLIGENT AI PROXY & ROUTER</label>
              <p className="section-desc">
                OmniRoute load balances multiple paid API keys and free endpoints while routing fast quick responses to cloud APIs and background heavy tasks to local Ollama / LM Studio models.
              </p>
              <div className="glass-card">
                <div className="card-header">⚡ QUICK CHAT RESPONSES</div>
                <div className="card-sub">Uses Cloud APIs & Antigravity Bridge for sub-second responses.</div>
              </div>
              <div className="glass-card mt-3">
                <div className="card-header">🦙 BACKGROUND AUTONOMOUS TASKS</div>
                <div className="card-sub">Routes pondering and memory indexing to local models (Ollama/LM Studio) to save credits.</div>
              </div>
            </div>
          )}

          {activeTab === "opendesign" && (
            <div className="config-section">
              <label className="section-title">NEXU OPENDESIGN UI/UX CANVAS ENGINE</label>
              <p className="section-desc">
                Generates liquid glassmorphism design tokens, wireframe component cards, and HUD elements on demand.
              </p>
              <div className="resource-list">
                {openDesignComponents.map((c) => (
                  <div key={c.id} className="resource-item">
                    <div className="res-title">
                      {c.name} <span className="speed-tag">{c.category.toUpperCase()}</span>
                    </div>
                    <div className="res-desc">{c.description}</div>
                    <div className="res-meta">JSX: {c.jsxCode}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "coworker" && (
            <div className="config-section">
              <label className="section-title">ACCOMPLISH AI AUTONOMOUS COWORKER JOBS</label>
              <p className="section-desc">
                End-to-end multi-step task decomposition, autonomous worker loops, and artifact generation.
              </p>
              <div className="resource-list">
                {coworkerTasks.map((t) => (
                  <div key={t.id} className="resource-item">
                    <div className="res-title">
                      {t.title} <span className="speed-tag">{t.status.toUpperCase()}</span>
                    </div>
                    <div className="res-desc">Goal: {t.goal}</div>
                    <div className="res-meta">Steps Completed: {t.steps.filter((s: any) => s.status === "completed").length} / {t.steps.length}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "openjarvis" && (
            <div className="config-section">
              <label className="section-title">OPENJARVIS COMPUTER AUTOMATION & SYSTEM CONTROL</label>
              <p className="section-desc">
                Autonomous system execution, desktop automation, app control, and self-healing workflow loops.
              </p>
              <div className="resource-list">
                {jarvisHistory.length === 0 ? (
                  <div className="glass-card">No recent computer actions logged.</div>
                ) : (
                  jarvisHistory.map((item) => (
                    <div key={item.id} className="resource-item">
                      <div className="res-title">
                        {item.description} <span className="speed-tag">{item.status.toUpperCase()}</span>
                      </div>
                      <div className="res-desc">Command: {item.command}</div>
                      {item.result && <div className="res-meta">Result: {item.result}</div>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "screenpipe" && (
            <div className="config-section">
              <label className="section-title">SCREENPIPE 24/7 CONTINUOUS SCREEN & AUDIO OCR MEMORY</label>
              <p className="section-desc">
                Screenpipe continuously indexes screen text (OCR) and audio transcripts locally so Jarvis always knows what you are working on.
              </p>
              <input
                type="text"
                className="glass-input mb-3"
                placeholder="Search screen OCR history & transcripts..."
                value={screenpipeQuery}
                onChange={(e) => setScreenpipeQuery(e.target.value)}
              />
              <div className="resource-list">
                {screenpipeHistory.map((frame) => (
                  <div key={frame.id} className="resource-item">
                    <div className="res-title">
                      {frame.appName} — {frame.windowTitle}
                    </div>
                    <div className="res-desc">OCR: {frame.ocrText}</div>
                    {frame.audioTranscript && <div className="res-meta">Audio: {frame.audioTranscript}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "freellm" && (
            <div className="config-section">
              <label className="section-title">FREE LLM API RESOURCES DIRECTORY</label>
              <p className="section-desc">Zero-cost LLM API resources powered by free tier endpoints.</p>
              <div className="resource-list">
                {FREE_LLM_RESOURCES.map((r) => (
                  <div key={r.id} className="resource-item">
                    <div className="res-title">
                      {r.name} <span className="speed-tag">{r.speed}</span>
                    </div>
                    <div className="res-desc">{r.description}</div>
                    <div className="res-meta">
                      Limit: {r.rateLimit} | Requires Key: {r.requiresKey ? "Yes" : "No (Bundled Free)"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "mcp" && (
            <div className="config-section">
              <label className="section-title">MODEL CONTEXT PROTOCOL (MCP) AUTO-SPIN-UP HUB</label>
              <p className="section-desc">
                Ultron automatically detects missing MCP servers and spins them up on demand!
              </p>
              <div className="mcp-grid">
                {mcpServers.map((s) => (
                  <div key={s.id} className="mcp-card">
                    <div className="mcp-name">{s.name}</div>
                    <div className="mcp-status">
                      Status: <span className={`status-${s.status}`}>{s.status.toUpperCase()}</span>
                    </div>
                    <button
                      type="button"
                      className="mcp-action-btn"
                      onClick={() => handleSpinUpMcp(s.id)}
                    >
                      {s.status === "running" ? "RESTART SERVER" : "SPIN UP MCP"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "voice" && (
            <div className="config-section">
              <label className="section-title">FISH STUDIO VOICE ENGINE</label>
              <p className="section-desc">
                Ultra-realistic synthetic voice personas for Jarvis, Edith, and Friday with zero-download offline fallback.
              </p>

              <div className="toggle-row">
                <span>ENABLE FISH STUDIO SYNTHESIS</span>
                <input
                  type="checkbox"
                  checked={useFishStudio}
                  onChange={(e) => handleToggleFish(e.target.checked)}
                />
              </div>

              {useFishStudio && (
                <div className="input-group mt-3">
                  <label className="input-label">FISH AUDIO API KEY (Optional)</label>
                  <input
                    type="password"
                    className="glass-input"
                    placeholder="Enter Fish Audio key or leave blank for free tier"
                    value={fishApiKey}
                    onChange={(e) => handleSaveFishKey(e.target.value)}
                  />
                </div>
              )}

              <label className="input-label mt-4">ACTIVE PERSONA</label>
              <div className="chip-grid">
                {[
                  { id: "jarvis", label: "🎩 J.A.R.V.I.S. (British Male)" },
                  { id: "edith", label: "🕶️ E.D.I.T.H. (Tactical Female)" },
                  { id: "friday", label: "☘️ F.R.I.D.A.Y. (Irish Female)" },
                  { id: "off", label: "🔇 MUTE VOICE" },
                ].map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`chip-btn ${voiceProfile === v.id ? "active" : ""}`}
                    onClick={() => onVoiceProfileChange(v.id)}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === "system" && (
            <div className="config-section">
              <label className="section-title">SYSTEM DIAGNOSTICS & MEMORY</label>
              <button type="button" className="action-btn" onClick={onOptimizeMemory}>
                🧠 OPTIMIZE MEMORY & DEDUP CONTEXT
              </button>
              {memOptResult && <div className="opt-result mt-2">{memOptResult}</div>}
              <button type="button" className="action-btn mt-3" onClick={onOpenBenchmark}>
                📊 RUN NEURAL BENCHMARK
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="glass-modal-footer">
          <button type="button" className="save-btn" onClick={onClose}>
            CONFIRM & APPLY
          </button>
        </div>
      </div>
    </div>
  );
}
