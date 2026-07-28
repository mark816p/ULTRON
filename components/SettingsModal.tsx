"use client";

import { useState, useEffect, useCallback } from "react";

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

const PROVIDER_MODELS: Record<string, string[]> = {
  openrouter: ["openrouter/auto", "anthropic/claude-sonnet-5", "openai/gpt-5.6", "google/gemini-3.1-pro"],
  gemini: ["gemini-3.1-pro", "gemini-3.5-flash", "gemini-2.5-flash"],
  openai: ["gpt-5.6", "gpt-5.6-terra", "gpt-5.6-luna"],
  anthropic: ["claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5-20251001"],
  groq: ["llama-3.3-70b-versatile", "deepseek-r1-distill-llama-70b", "qwen-qwq-32b"],
  deepseek: ["deepseek-r1", "deepseek-chat"],
  mistral: ["mistral-large-latest", "codestral-latest"],
  xai: ["grok-2-1212", "grok-beta"],
  custom: ["custom-model"],
};

const ANTIGRAVITY_MODELS = [
  "gemini-3.1-pro", "gemini-3.5-flash", "gemini-2.5-flash",
  "claude-sonnet-5", "claude-opus-4-8",
];

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 200,
    background: "rgba(0,0,0,0.75)",
    backdropFilter: "blur(8px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 20,
  },
  modal: {
    width: 520, maxWidth: "100%", maxHeight: "88vh",
    background: "rgba(10,10,14,0.98)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    boxShadow: "0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)",
    fontFamily: "'Courier New', monospace",
    display: "flex", flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    flexShrink: 0,
  },
  headerTitle: { fontSize: 13, fontWeight: "bold", color: "#e8e8e8", letterSpacing: "0.12em" },
  closeBtn: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
    color: "#888", borderRadius: 6, width: 28, height: 28,
    cursor: "pointer", fontSize: 14, display: "flex",
    alignItems: "center", justifyContent: "center",
    transition: "all 0.15s",
  },
  body: { overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 },
  section: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 10, padding: "14px 16px",
    display: "flex", flexDirection: "column", gap: 12,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: "bold", letterSpacing: "0.2em",
    color: "#555", textTransform: "uppercase", marginBottom: 4,
  },
  row: { display: "flex", gap: 8 },
  chipBase: {
    flex: 1, padding: "8px 10px", borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.03)",
    color: "#888", fontSize: 11, fontWeight: "bold",
    cursor: "pointer", textAlign: "center" as const,
    letterSpacing: "0.06em", transition: "all 0.15s",
  },
  chipActive: {
    borderColor: "rgba(255,255,255,0.5)",
    background: "rgba(255,255,255,0.1)",
    color: "#fff",
  },
  label: { fontSize: 10, color: "#555", letterSpacing: "0.12em", marginBottom: 4, display: "block" },
  input: {
    width: "100%", background: "rgba(0,0,0,0.6)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 7, padding: "9px 12px",
    color: "#e0e0e0", fontSize: 12, outline: "none",
    fontFamily: "'Courier New', monospace",
    boxSizing: "border-box" as const,
  },
  select: {
    width: "100%", background: "rgba(0,0,0,0.8)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 7, padding: "9px 12px",
    color: "#e0e0e0", fontSize: 12, outline: "none",
    fontFamily: "'Courier New', monospace",
    cursor: "pointer", boxSizing: "border-box" as const,
  },
  footer: {
    padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.06)",
    display: "flex", gap: 8, flexShrink: 0,
    background: "rgba(0,0,0,0.4)",
  },
  footerBtn: {
    flex: 1, padding: "9px 12px", borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#aaa", fontSize: 11, fontWeight: "bold",
    cursor: "pointer", letterSpacing: "0.06em",
    transition: "all 0.15s",
  },
  primaryBtn: {
    background: "#fff", color: "#000",
    border: "none", boxShadow: "0 0 16px rgba(255,255,255,0.15)",
  },
};

export default function SettingsModal(props: SettingsModalProps) {
  const {
    isOpen, onClose,
    modelMode, onlineMode, localMode, apiProvider, apiKey, apiBaseUrl,
    selectedModelName, selectedLocalModelName, modelsData,
    voiceProfile, speakOnTyping,
    onEngineChange, onOnlineModeChange, onLocalModeChange, onApiProviderChange,
    onApiKeyChange, onApiBaseUrlChange, onModelChange, onLocalModelChange,
    onVoiceProfileChange, onSpeakOnTypingChange,
    onOptimizeMemory, onOpenBenchmark, sysInfo, memOptResult,
  } = props;

  const [activeTab, setActiveTab] = useState<"engine" | "voice" | "system">("engine");
  const [showKey, setShowKey] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "up-to-date" | "available" | "error">("idle");
  const [latestVer, setLatestVer] = useState<string>("");

  const handleCheckUpdate = async () => {
    setUpdateStatus("checking");
    try {
      const res = await fetch("https://api.github.com/repos/mark816p/ULTRON/releases/latest");
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const tag = data.tag_name || "";
      setLatestVer(tag);
      if (tag && tag !== "v49.0.0" && !tag.includes("v49")) {
        setUpdateStatus("available");
      } else {
        setUpdateStatus("up-to-date");
      }
    } catch {
      setUpdateStatus("error");
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const isApiKey = onlineMode === "api-key" || modelMode === "api-key";
  const models = isApiKey
    ? (modelsData?.[`${apiProvider}Models`] || PROVIDER_MODELS[apiProvider] || ["custom-model"])
    : ANTIGRAVITY_MODELS;
  const localModels = localMode === "lm-studio"
    ? (modelsData?.lmStudioModels || ["local-model"])
    : (modelsData?.ollamaModels || ["llama3:8b", "qwen2.5:14b", "mistral:7b"]);

  const chip = (active: boolean, onClick: () => void, label: string) => (
    <button
      type="button"
      onClick={onClick}
      style={{ ...S.chipBase, ...(active ? S.chipActive : {}) }}
    >
      {label}
    </button>
  );

  const tabs = [
    { id: "engine", label: "🧠 AI Engine" },
    { id: "voice", label: "🗣 Voice" },
    { id: "system", label: "⚙ System" },
  ] as const;

  return (
    <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modal}>
        {/* Header */}
        <div style={S.header}>
          <span style={S.headerTitle}>⚙ SETTINGS — U.L.T.R.O.N. v49</span>
          <button style={S.closeBtn} onClick={onClose} title="Close (Esc)">✕</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                flex: 1, padding: "10px 8px",
                background: activeTab === t.id ? "rgba(255,255,255,0.06)" : "transparent",
                border: "none",
                borderBottom: activeTab === t.id ? "2px solid rgba(255,255,255,0.6)" : "2px solid transparent",
                color: activeTab === t.id ? "#e0e0e0" : "#555",
                fontSize: 11, fontWeight: "bold", letterSpacing: "0.08em",
                cursor: "pointer", transition: "all 0.15s",
                fontFamily: "'Courier New', monospace",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={S.body}>

          {/* ── AI ENGINE TAB ───────────────────────────── */}
          {activeTab === "engine" && (
            <>
              {/* Routing strategy */}
              <div style={S.section}>
                <span style={S.sectionLabel}>Routing Mode</span>
                <div style={S.row}>
                  {chip(modelMode === "auto", () => onEngineChange("auto"), "Auto (Smart)")}
                  {chip(modelMode === "antigravity", () => onEngineChange("antigravity"), "Antigravity Only")}
                  {chip(modelMode === "api-key", () => { onEngineChange("api-key"); onOnlineModeChange("api-key"); }, "API Key Only")}
                  {chip(modelMode === "ollama", () => onEngineChange("ollama"), "Ollama Only")}
                </div>
                <p style={{ fontSize: 10, color: "#444", lineHeight: 1.5, margin: 0 }}>
                  {modelMode === "auto" && "Auto tries Antigravity (free) → API Key → Local in order."}
                  {modelMode === "antigravity" && "Uses the free Antigravity bridge. Requires agy CLI installed."}
                  {modelMode === "api-key" && "Uses your cloud API key directly. Most reliable."}
                  {modelMode === "ollama" && "Runs fully offline. Requires Ollama running locally."}
                </p>
              </div>

              {/* Online engine */}
              <div style={S.section}>
                <span style={S.sectionLabel}>Online Engine</span>
                <div style={S.row}>
                  {chip(!isApiKey, () => { onOnlineModeChange("antigravity"); if (modelMode === "api-key") onEngineChange("auto"); }, "Antigravity (Free)")}
                  {chip(isApiKey, () => { onOnlineModeChange("api-key"); if (modelMode !== "ollama" && modelMode !== "lm-studio") onEngineChange("api-key"); }, "API Key")}
                </div>

                {isApiKey ? (
                  <>
                    <div>
                      <span style={S.label}>PROVIDER</span>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                        {PROVIDERS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onApiProviderChange(p.id)}
                            title={p.hint}
                            style={{
                              padding: "7px 8px", borderRadius: 7, fontSize: 10, fontWeight: "bold",
                              cursor: "pointer", letterSpacing: "0.06em", textAlign: "center",
                              fontFamily: "'Courier New', monospace",
                              border: apiProvider === p.id ? "1px solid rgba(255,255,255,0.5)" : "1px solid rgba(255,255,255,0.08)",
                              background: apiProvider === p.id ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)",
                              color: apiProvider === p.id ? "#fff" : "#666",
                              transition: "all 0.15s",
                            }}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span style={S.label}>API KEY ({apiProvider.toUpperCase()})</span>
                      <div style={{ position: "relative" }}>
                        <input
                          type={showKey ? "text" : "password"}
                          value={apiKey}
                          onChange={(e) => onApiKeyChange(e.target.value)}
                          placeholder={`Paste your ${apiProvider} API key...`}
                          style={{ ...S.input, paddingRight: 52 }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          style={{
                            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                            background: "transparent", border: "none", color: "#555",
                            fontSize: 11, cursor: "pointer",
                          }}
                        >
                          {showKey ? "HIDE" : "SHOW"}
                        </button>
                      </div>
                      {apiKey && (
                        <p style={{ fontSize: 10, color: "#00aa66", marginTop: 4 }}>✓ Key saved locally</p>
                      )}
                    </div>

                    {apiProvider === "custom" && (
                      <div>
                        <span style={S.label}>CUSTOM BASE URL</span>
                        <input
                          type="text"
                          value={apiBaseUrl}
                          onChange={(e) => onApiBaseUrlChange(e.target.value)}
                          placeholder="https://your-api.com/v1/chat/completions"
                          style={S.input}
                        />
                      </div>
                    )}

                    <div>
                      <span style={S.label}>MODEL</span>
                      <select value={selectedModelName} onChange={(e) => onModelChange(e.target.value)} style={S.select}>
                        {models.map((m: string) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </>
                ) : (
                  <div>
                    <span style={S.label}>ANTIGRAVITY MODEL</span>
                    <select value={selectedModelName} onChange={(e) => onModelChange(e.target.value)} style={S.select}>
                      {ANTIGRAVITY_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Local engine */}
              <div style={S.section}>
                <span style={S.sectionLabel}>Local / Offline Engine</span>
                <div style={S.row}>
                  {chip(localMode === "ollama", () => onLocalModeChange("ollama"), "🦙 Ollama")}
                  {chip(localMode === "lm-studio", () => onLocalModeChange("lm-studio"), "🖥 LM Studio")}
                </div>
                <div>
                  <span style={S.label}>LOCAL MODEL</span>
                  <select value={selectedLocalModelName} onChange={(e) => onLocalModelChange(e.target.value)} style={S.select}>
                    {localModels.map((m: string) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <p style={{ fontSize: 10, color: "#444", lineHeight: 1.5, margin: 0 }}>
                  {localMode === "ollama" ? "Requires Ollama running at localhost:11434." : "Requires LM Studio server running at localhost:1234."}
                </p>
              </div>
            </>
          )}

          {/* ── VOICE TAB ───────────────────────────────── */}
          {activeTab === "voice" && (
            <>
              <div style={S.section}>
                <span style={S.sectionLabel}>Voice Persona</span>
                <div style={S.row}>
                  {chip(voiceProfile === "jarvis", () => onVoiceProfileChange("jarvis"), "👔 J.A.R.V.I.S.")}
                  {chip(voiceProfile === "friday", () => onVoiceProfileChange("friday"), "👩 F.R.I.D.A.Y.")}
                  {chip(voiceProfile === "edith", () => onVoiceProfileChange("edith"), "👓 E.D.I.T.H.")}
                  {chip(voiceProfile === "off", () => onVoiceProfileChange("off"), "🔇 OFF")}
                </div>
                <p style={{ fontSize: 10, color: "#444", lineHeight: 1.5, margin: 0 }}>
                  {voiceProfile === "jarvis" && "Calm, precise, British-accented male voice. Classic Stark AI."}
                  {voiceProfile === "friday" && "Warm, Irish-accented female voice. Friendly and responsive."}
                  {voiceProfile === "edith" && "Sharp, confident female voice. Strategic intelligence persona."}
                  {voiceProfile === "off" && "Voice output disabled. Silent telemetry mode."}
                </p>
              </div>

              <div style={S.section}>
                <span style={S.sectionLabel}>Auto-Speak Settings</span>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontSize: 12, color: "#ccc", display: "block" }}>Speak typed responses aloud</span>
                    <span style={{ fontSize: 10, color: "#444" }}>ULTRON will read out AI replies when you type messages</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSpeakOnTypingChange(!speakOnTyping)}
                    style={{
                      width: 44, height: 24, borderRadius: 12,
                      background: speakOnTyping ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      cursor: "pointer", position: "relative", flexShrink: 0,
                      transition: "all 0.2s",
                    }}
                  >
                    <span style={{
                      position: "absolute", top: 2,
                      left: speakOnTyping ? 22 : 2,
                      width: 18, height: 18, borderRadius: "50%",
                      background: speakOnTyping ? "#000" : "#888",
                      transition: "left 0.2s",
                    }} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── SYSTEM TAB ──────────────────────────────── */}
          {activeTab === "system" && (
            <>
              {sysInfo && (
                <div style={S.section}>
                  <span style={S.sectionLabel}>Hardware</span>
                  <div style={{ fontSize: 11, color: "#888", lineHeight: 2, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                    <span style={{ color: "#555" }}>CPU</span>
                    <span style={{ color: "#ccc" }}>{sysInfo.cpuModel?.split(" ").slice(0, 4).join(" ")}</span>
                    <span style={{ color: "#555" }}>Cores</span>
                    <span style={{ color: "#ccc" }}>{sysInfo.cpuCores}</span>
                    <span style={{ color: "#555" }}>RAM Free</span>
                    <span style={{ color: "#ccc" }}>{sysInfo.freeMemMb} MB / {sysInfo.totalMemMb} MB</span>
                    <span style={{ color: "#555" }}>AI Tier</span>
                    <span style={{ color: "#e0e0e0", fontWeight: "bold" }}>{sysInfo.tierBadge}</span>
                  </div>
                </div>
              )}

              <div style={S.section}>
                <span style={S.sectionLabel}>In-App Updater</span>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 12, color: "#ccc", display: "block" }}>Current Version: v49.0.0</span>
                    <span style={{ fontSize: 10, color: "#444" }}>Check official repository for new releases</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckUpdate}
                    disabled={updateStatus === "checking"}
                    style={{ ...S.footerBtn, flex: "none", padding: "6px 14px", fontSize: 10 }}
                  >
                    {updateStatus === "checking" ? "Checking..." : "⚡ CHECK FOR UPDATES"}
                  </button>
                </div>
                {updateStatus === "up-to-date" && (
                  <p style={{ fontSize: 11, color: "#44bb44", margin: 0 }}>✅ U.L.T.R.O.N. is running the latest verified version (v49.0.0).</p>
                )}
                {updateStatus === "available" && (
                  <div style={{ background: "rgba(255, 170, 48, 0.1)", border: "1px solid rgba(255, 170, 48, 0.4)", borderRadius: 6, padding: 10, marginTop: 8 }}>
                    <p style={{ fontSize: 11, color: "#ffaa30", margin: "0 0 8px" }}>🚀 New release available: {latestVer}</p>
                    <a
                      href="https://github.com/mark816p/ULTRON/releases/latest/download/ULTRON-Installer.exe"
                      target="_blank"
                      rel="noreferrer"
                      style={{ ...S.footerBtn, display: "inline-block", textDecoration: "none", fontSize: 10, padding: "6px 12px", background: "var(--accent-amber)", color: "#000" }}
                    >
                      Download & Install Update &rarr;
                    </a>
                  </div>
                )}
                {updateStatus === "error" && (
                  <p style={{ fontSize: 11, color: "#bb4444", margin: 0 }}>⚠️ Could not check for updates. Check internet connection.</p>
                )}
              </div>

              <div style={S.section}>
                <span style={S.sectionLabel}>Memory Management</span>
                <p style={{ fontSize: 10, color: "#444", lineHeight: 1.5, margin: 0 }}>
                  SQZ rolling deduplication is active. Prune old scratchpad data and run SQLite VACUUM to reclaim space.
                </p>
                <button
                  type="button"
                  onClick={onOptimizeMemory}
                  style={{ ...S.footerBtn, flex: "none", width: "100%", textAlign: "center" as const }}
                >
                  ⚡ OPTIMIZE & VACUUM DATABASE
                </button>
                {memOptResult && (
                  <p style={{ fontSize: 10, color: "#aaa", textAlign: "center", margin: 0 }}>{memOptResult}</p>
                )}
              </div>

              <div style={S.section}>
                <span style={S.sectionLabel}>Onboarding & Diagnostics</span>
                <button
                  type="button"
                  onClick={() => { onOpenBenchmark(); onClose(); }}
                  style={{ ...S.footerBtn, flex: "none", width: "100%", textAlign: "center" as const }}
                >
                  ⚙ RE-RUN SETUP WIZARD
                </button>
              </div>

              <div style={{ ...S.section, textAlign: "center" as const }}>
                <span style={{ fontSize: 10, color: "#333", letterSpacing: "0.12em" }}>
                  U.L.T.R.O.N. v49 · Neural OS · Google DeepMind Antigravity AI
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button type="button" style={S.footerBtn} onClick={onClose}>CANCEL</button>
          <button type="button" style={{ ...S.footerBtn, ...S.primaryBtn }} onClick={onClose}>
            ✓ SAVE & CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
