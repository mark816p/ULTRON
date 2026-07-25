"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { OrbSceneApi } from "@/lib/orbScene";
import { voiceEngine, VoiceProfile } from "@/lib/voiceEngine";

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  engine?: string;
  failoverOccurred?: boolean;
  failoverReason?: string;
  dedupStats?: any;
  timestamp?: string;
}

interface ChatPanelProps {
  sceneRef: React.MutableRefObject<OrbSceneApi | null>;
  cameraState: string;
  onToggleGestures: () => void;
  onOpenBenchmark: () => void;
}

export default function ChatPanel({ sceneRef, cameraState, onToggleGestures, onOpenBenchmark }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "U.L.T.R.O.N. online. Neural vectors synchronized. Always-active wake word ('Ultron') listening.",
      engine: "system",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [modelMode, setModelMode] = useState<"auto" | "antigravity" | "ollama" | "lm-studio">("auto");
  const [selectedModelName, setSelectedModelName] = useState("gemini-2.5-pro");
  const [modelsData, setModelsData] = useState<any>(null);

  const [isListening, setIsListening] = useState(false);
  const [wakeWordActive, setWakeWordActive] = useState(true);
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile>("jarvis");
  const [pondering, setPondering] = useState(false);
  const [latestKeywords, setLatestKeywords] = useState<string[]>([]);
  const [dedupSavedTokens, setDedupSavedTokens] = useState<number>(0);

  // UI states
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "tasks" | "system">("chat");
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [memOptResult, setMemOptResult] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === "chat") scrollToBottom();
  }, [messages, activeTab]);

  // Load persisted engine & model choices
  useEffect(() => {
    const savedEngine = localStorage.getItem("ultron_engine");
    const savedModel = localStorage.getItem("ultron_model");
    const savedVoice = localStorage.getItem("ultron_voice_profile") as VoiceProfile;
    if (savedEngine) setModelMode(savedEngine as any);
    if (savedModel) setSelectedModelName(savedModel);
    if (savedVoice) setVoiceProfile(savedVoice);

    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => setModelsData(data))
      .catch(() => {});
  }, []);

  const handleEngineChange = (newEngine: "auto" | "antigravity" | "ollama" | "lm-studio") => {
    setModelMode(newEngine);
    localStorage.setItem("ultron_engine", newEngine);
  };

  const handleModelChange = (newModel: string) => {
    setSelectedModelName(newModel);
    localStorage.setItem("ultron_model", newModel);
  };

  // Fetch autonomous tasks & sysinfo
  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = await res.json();
        if (data.tasks) setTasks(data.tasks);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchTasks();
    const taskInterval = setInterval(fetchTasks, 10000);
    return () => clearInterval(taskInterval);
  }, []);

  useEffect(() => {
    if (activeTab === "system" && !sysInfo) {
      fetch("/api/sysinfo")
        .then((res) => res.json())
        .then((data) => setSysInfo(data))
        .catch(() => {});
    }
  }, [activeTab]);

  // Autonomous Pondering background loop (every 30s when idle)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (loading || isListening) return;
      try {
        setPondering(true);
        sceneRef.current?.setAIState("pondering");
        const res = await fetch("/api/ponder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: "ultron_user_1" }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.keywords && data.keywords.length > 0) {
            setLatestKeywords(data.keywords);
            sceneRef.current?.setThoughtWords(data.keywords);
          }
          fetchTasks();
        }
      } catch (e) {
        console.warn("Ponder loop error:", e);
      } finally {
        setPondering(false);
        sceneRef.current?.setAIState("idle");
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loading, isListening, sceneRef]);

  const handleSend = useCallback(
    async (e?: React.FormEvent, overrideText?: string) => {
      if (e) e.preventDefault();
      const textToSend = overrideText || input;
      if (!textToSend.trim() || loading) return;

      const userMsg: Message = {
        role: "user",
        content: textToSend,
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      if (!overrideText) setInput("");
      setLoading(true);

      sceneRef.current?.setAIState("thinking");

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: textToSend,
            sessionId: "ultron_user_1",
            model: modelMode,
            modelName: selectedModelName,
            history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to communicate with U.L.T.R.O.N.");

        if (voiceEngine && voiceEngine.getProfile() !== "off") {
          voiceEngine.speak(
            data.content,
            () => sceneRef.current?.setAIState("speaking"),
            () => sceneRef.current?.setAIState("idle")
          );
        } else {
          sceneRef.current?.setAIState("speaking");
          setTimeout(() => sceneRef.current?.setAIState("idle"), Math.min(6000, data.content.length * 50));
        }

        if (data.keywords && data.keywords.length > 0) {
          setLatestKeywords(data.keywords);
          sceneRef.current?.setThoughtWords(data.keywords);
        }

        if (data.dedupStats && data.dedupStats.tokensSavedEstimate > 0) {
          setDedupSavedTokens((prev) => prev + data.dedupStats.tokensSavedEstimate);
        }

        const assistantMsg: Message = {
          role: "assistant",
          content: data.content,
          engine: data.engine,
          failoverOccurred: data.failoverOccurred,
          failoverReason: data.failoverReason,
          dedupStats: data.dedupStats,
          timestamp: new Date().toLocaleTimeString(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        sceneRef.current?.setAIState("idle");
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: `⚠️ Error: ${(err as Error).message}. Attempting circuit-breaker reset...`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, modelMode, selectedModelName, sceneRef]
  );

  // Always-active Wake Word ("Ultron") continuous recognition
  useEffect(() => {
    if (!wakeWordActive || isListening || loading) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let recognitionStopped = false;

    recognition.onresult = (event: any) => {
      const results = event.results;
      const latestResult = results[results.length - 1];
      const transcript = latestResult[0].transcript.trim();

      const lower = transcript.toLowerCase();
      if (lower.includes("ultron") || lower.includes("altron")) {
        const idx = Math.max(lower.indexOf("ultron"), lower.indexOf("altron"));
        const command = transcript.slice(idx + 6).trim();

        if (latestResult.isFinal && command.length > 2) {
          recognitionStopped = true;
          recognition.stop();
          setInput(command);
          handleSend(undefined, command);
        } else if (latestResult.isFinal) {
          sceneRef.current?.setAIState("thinking");
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: "🎙️ U.L.T.R.O.N. active. Listening for your command...",
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);
        }
      }
    };

    recognition.onerror = () => {};
    recognition.onend = () => {
      if (!recognitionStopped && wakeWordActive) {
        try {
          recognition.start();
        } catch (e) {}
      }
    };

    try {
      recognition.start();
    } catch (e) {}

    return () => {
      recognitionStopped = true;
      try {
        recognition.stop();
      } catch (e) {}
    };
  }, [wakeWordActive, isListening, loading, handleSend, sceneRef]);

  const toggleListen = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      sceneRef.current?.setAIState("thinking");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
      sceneRef.current?.setAIState("idle");
    };

    recognition.onerror = () => {
      setIsListening(false);
      sceneRef.current?.setAIState("idle");
    };

    recognition.onend = () => {
      setIsListening(false);
      sceneRef.current?.setAIState("idle");
    };

    recognition.start();
  };

  const handleQueueTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", title: newTaskTitle, model: `${modelMode} (${selectedModelName})` }),
      });
      setNewTaskTitle("");
      fetchTasks();
    } catch (err) {}
  };

  const handleOptimizeMemory = async () => {
    setMemOptResult("Optimizing Never-Forget SQLite store...");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          title: "Consolidate Never-Forget SQZ memory and run SQLite VACUUM",
          model: `${modelMode} (${selectedModelName})`,
        }),
      });
      if (res.ok) {
        setMemOptResult("✅ Optimization task queued for background cycle!");
        fetchTasks();
      }
    } catch (e) {
      setMemOptResult("❌ Optimization failed");
    }
  };

  if (isCollapsed) {
    return (
      <div className="chat-panel-collapsed" onClick={() => setIsCollapsed(false)}>
        <span className="pulse-dot" />
        <span className="hud-label">💬 U.L.T.R.O.N. ({selectedModelName})</span>
        {pondering && <span className="pondering-badge">🧠 PONDERING...</span>}
        <div style={{ flex: 1 }} />
        <button className="collapse-btn" title="Expand Panel">🗖 EXPAND</button>
      </div>
    );
  }

  const activeTaskCount = tasks.filter((t) => t.status === "active" || t.status === "queued").length;

  const getAvailableModels = () => {
    if (!modelsData) return ["gemini-2.5-pro", "gemini-1.5-pro", "llama3:8b", "qwen2.5:14b"];
    if (modelMode === "antigravity") return modelsData.antigravityModels || ["gemini-2.5-pro"];
    if (modelMode === "ollama") return modelsData.ollamaModels || ["llama3:8b"];
    if (modelMode === "lm-studio") return modelsData.lmStudioModels || ["local-model"];
    return [
      ...(modelsData.antigravityModels || []),
      ...(modelsData.ollamaModels || []),
      ...(modelsData.lmStudioModels || []),
    ];
  };

  return (
    <div className="chat-panel-container">
      {/* Top Status HUD */}
      <div className="chat-hud-header">
        <div className="hud-title-box">
          <span className="pulse-dot" />
          <span className="hud-label">U.L.T.R.O.N. NEURAL LINK</span>
          <span className="stat-pill" style={{ borderColor: "#00ff66", color: "#00ff66" }}>
            🧠 {selectedModelName}
          </span>
          {pondering && <span className="pondering-badge">🧠 PONDERING...</span>}
        </div>

        <div className="hud-stats">
          <button
            type="button"
            onClick={() => setWakeWordActive(!wakeWordActive)}
            className="collapse-btn"
            style={{
              borderColor: wakeWordActive ? "#00ff66" : "#888",
              color: wakeWordActive ? "#00ff66" : "#888",
            }}
            title="Always-Active 'Ultron' Wake Word Toggle"
          >
            {wakeWordActive ? "🎙️ WAKE WORD: ON" : "🎙️ WAKE WORD: OFF"}
          </button>

          <button
            type="button"
            onClick={() => {
              const profiles: VoiceProfile[] = ["jarvis", "friday", "edith", "off"];
              const next = profiles[(profiles.indexOf(voiceProfile) + 1) % profiles.length];
              setVoiceProfile(next);
              voiceEngine?.setProfile(next);
              if (next !== "off") {
                voiceEngine?.speak(`Voice persona changed to ${next.toUpperCase()}.`);
              } else {
                voiceEngine?.stop();
              }
            }}
            className="collapse-btn"
            style={{
              borderColor: voiceProfile !== "off" ? "#00e5ff" : "#888",
              color: voiceProfile !== "off" ? "#00e5ff" : "#888",
            }}
            title="Cycle AI Voice Persona (Jarvis / Friday / Edith / Mute)"
          >
            🗣️ VOICE: {voiceProfile.toUpperCase()}
          </button>

          {dedupSavedTokens > 0 && (
            <span className="stat-pill" title="Tokens saved by SQZ deduplication">
              ⚡ SQZ SAVED: {dedupSavedTokens}
            </span>
          )}

          <button type="button" onClick={() => setIsCollapsed(true)} className="collapse-btn" title="Minimize Panel">
            🗕 MINIMIZE
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="hud-tabs">
        <button
          type="button"
          className={`hud-tab-btn ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          💬 CHAT
        </button>
        <button
          type="button"
          className={`hud-tab-btn ${activeTab === "tasks" ? "active" : ""}`}
          onClick={() => setActiveTab("tasks")}
        >
          ⚡ TASKS {activeTaskCount > 0 && <span className="tab-badge">{activeTaskCount}</span>}
        </button>
        <button
          type="button"
          className={`hud-tab-btn ${activeTab === "system" ? "active" : ""}`}
          onClick={() => setActiveTab("system")}
        >
          ⚙️ SYSTEM
        </button>
      </div>

      {/* Floating Keywords Ticker */}
      {latestKeywords.length > 0 && (
        <div className="keywords-ticker">
          <span className="ticker-title">ACTUAL THOUGHTS:</span>
          {latestKeywords.slice(0, 6).map((kw, i) => (
            <span key={i} className="keyword-tag">#{kw}</span>
          ))}
        </div>
      )}

      {/* TAB 1: CHAT NEURAL LINK */}
      {activeTab === "chat" && (
        <>
          <div className="chat-messages-area">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message-bubble role-${msg.role}`}>
                <div className="msg-header">
                  <span className="msg-sender">{msg.role.toUpperCase()}</span>
                  <span className="msg-time">{msg.timestamp}</span>
                  {msg.engine && <span className="msg-engine-badge">{msg.engine}</span>}
                </div>
                <div className="msg-content">{msg.content}</div>
                {msg.failoverOccurred && (
                  <div className="msg-failover-alert">
                    ⚡ AUTO-SWITCHED: {msg.failoverReason}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="message-bubble role-assistant loading">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="chat-input-form">
            <button
              type="button"
              onClick={toggleListen}
              className={`voice-btn ${isListening ? "listening" : ""}`}
              title="Manual Voice Command"
            >
              {isListening ? "🎙️ LISTENING..." : "🎙️"}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Command U.L.T.R.O.N. (or say 'Ultron <command>')..."
              className="chat-input"
              disabled={loading}
            />

            <button type="submit" disabled={loading || !input.trim()} className="send-btn">
              SEND
            </button>
          </form>
        </>
      )}

      {/* TAB 2: AUTONOMOUS TASKS QUEUE */}
      {activeTab === "tasks" && (
        <div className="tasks-area">
          <div className="tasks-header-box">
            <span className="tasks-subtitle">UNLIMITED AUTONOMOUS RESEARCH QUEUE</span>
            <span className="tasks-hint">Zero task cap! U.L.T.R.O.N. executes tasks during standby cycles.</span>
          </div>

          <form onSubmit={handleQueueTask} className="task-queue-form">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Queue custom task (e.g., Scrape AI tech news, check RAM)..."
              className="chat-input"
            />
            <button type="submit" disabled={!newTaskTitle.trim()} className="send-btn">
              + QUEUE
            </button>
          </form>

          <div className="tasks-list">
            {tasks.map((t, idx) => (
              <div key={idx} className={`task-card status-${t.status}`}>
                <div className="task-header">
                  <span className={`task-badge ${t.status}`}>{t.status.toUpperCase()}</span>
                  <span className="task-origin">[{t.origin.replace("_", " ")}]</span>
                  <span className="task-time">{t.timestamp}</span>
                </div>
                <div className="task-title">{t.title}</div>
                {t.result && <div className="task-result">💡 {t.result}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SYSTEM BENCHMARK & COGNITIVE ENGINE CONTROL */}
      {activeTab === "system" && (
        <div className="system-area">
          <div className="sys-section">
            <div className="sys-header">🌐 CHANGE AI MIND AT ANY TIME</div>
            <p className="sys-desc">
              Select your backend engine and specific AI model below. Changes take effect immediately without repeating onboarding.
            </p>
            <label style={{ fontSize: "11px", color: "#aaa", display: "block", marginBottom: "4px" }}>
              PRIMARY ROUTING ENGINE:
            </label>
            <select
              value={modelMode}
              onChange={(e) => handleEngineChange(e.target.value as any)}
              className="model-select-large"
              style={{ marginBottom: "10px" }}
            >
              <option value="auto">🔄 Auto Circuit-Breaker (Antigravity ↔ Local)</option>
              <option value="antigravity">🌐 Antigravity Google Gemini Bridge</option>
              <option value="ollama">🦙 Ollama Local Offline</option>
              <option value="lm-studio">🖥️ LM Studio Bionic Local API</option>
            </select>

            <label style={{ fontSize: "11px", color: "#aaa", display: "block", marginBottom: "4px" }}>
              EXACT AI MODEL TAG:
            </label>
            <select
              value={selectedModelName}
              onChange={(e) => handleModelChange(e.target.value)}
              className="model-select-large"
              style={{ marginBottom: "8px" }}
            >
              {getAvailableModels().map((mod: string, i: number) => (
                <option key={i} value={mod}>
                  {mod}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={selectedModelName}
              onChange={(e) => handleModelChange(e.target.value)}
              placeholder="Or type custom tag (e.g., gemini-2.5-pro, llama3:8b, local-model)..."
              className="chat-input"
              style={{ width: "100%", fontSize: "11px" }}
            />

            <div style={{ marginTop: "14px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "10px" }}>
              <label style={{ fontSize: "11px", color: "#00e5ff", fontWeight: "bold", display: "block", marginBottom: "6px" }}>
                🗣️ AI VOICE PERSONA & TELEMETRY CHIRPS:
              </label>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {(["jarvis", "friday", "edith", "off"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setVoiceProfile(v);
                      voiceEngine?.setProfile(v);
                      if (v !== "off") {
                        voiceEngine?.speak(`Greetings. I am ${v.toUpperCase()}, your automated AI assistant.`);
                      } else {
                        voiceEngine?.stop();
                      }
                    }}
                    className={`hud-tab-btn ${voiceProfile === v ? "active" : ""}`}
                    style={{ flex: 1, textAlign: "center", padding: "6px", fontSize: "10px" }}
                  >
                    {v === "jarvis" && "👔 J.A.R.V.I.S."}
                    {v === "friday" && "👩‍🦰 F.R.I.D.A.Y."}
                    {v === "edith" && "👓 E.D.I.T.H."}
                    {v === "off" && "🔇 MUTE"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="sys-section">
            <div className="sys-header">💻 HOST HARDWARE BENCHMARK</div>
            {sysInfo ? (
              <div className="sys-grid">
                <div><strong>CPU:</strong> {sysInfo.cpuModel}</div>
                <div><strong>CORES:</strong> {sysInfo.cpuCores} Logic Units</div>
                <div><strong>RAM:</strong> {sysInfo.freeMemMb} MB Free / {sysInfo.totalMemMb} MB Total</div>
                <div><strong>AI TIER:</strong> <span className="tier-tag">{sysInfo.tierBadge}</span></div>
              </div>
            ) : (
              <div className="sys-loading">Analyzing neural hardware...</div>
            )}
            <button type="button" onClick={onOpenBenchmark} className="hud-btn" style={{ width: "100%", marginTop: "8px" }}>
              ⚙️ RE-RUN ONBOARDING WIZARD
            </button>
          </div>

          <div className="sys-section">
            <div className="sys-header">🧠 NEVER-FORGET MEMORY MANAGEMENT</div>
            <p className="sys-desc">
              SQZ rolling block deduplication is active. You can prune old scratchpad data and run SQLite VACUUM.
            </p>
            <button type="button" onClick={handleOptimizeMemory} className="send-btn" style={{ width: "100%", padding: "8px" }}>
              ⚡ OPTIMIZE & VACUUM DATABASE
            </button>
            {memOptResult && <div className="opt-result">{memOptResult}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
