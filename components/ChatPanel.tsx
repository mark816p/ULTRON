"use client";

import { useState, useEffect, useRef } from "react";
import type { OrbSceneApi } from "@/lib/orbScene";

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
      content: "U.L.T.R.O.N. online. Neural vectors synchronized. Autonomous background loop active.",
      engine: "system",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [modelMode, setModelMode] = useState<"auto" | "antigravity" | "ollama" | "lm-studio">("auto");
  const [isListening, setIsListening] = useState(false);
  const [pondering, setPondering] = useState(false);
  const [latestKeywords, setLatestKeywords] = useState<string[]>([]);
  const [dedupSavedTokens, setDedupSavedTokens] = useState<number>(0);

  // New UI states
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
          fetchTasks(); // Refresh tasks as background loop processes them
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

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    const currentInput = input;
    setInput("");
    setLoading(true);

    sceneRef.current?.setAIState("thinking");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: currentInput,
          sessionId: "ultron_user_1",
          model: modelMode,
          history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to communicate with U.L.T.R.O.N.");

      sceneRef.current?.setAIState("speaking");
      setTimeout(() => sceneRef.current?.setAIState("idle"), Math.min(6000, data.content.length * 50));

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
  };

  const handleQueueTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", title: newTaskTitle, model: modelMode }),
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
        body: JSON.stringify({ action: "add", title: "Consolidate Never-Forget SQZ memory and run SQLite VACUUM", model: modelMode }),
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
        <span className="hud-label">💬 U.L.T.R.O.N. NEURAL LINK</span>
        {pondering && <span className="pondering-badge">🧠 PONDERING...</span>}
        <div style={{ flex: 1 }} />
        <button className="collapse-btn" title="Expand Panel">🗖 EXPAND</button>
      </div>
    );
  }

  const activeTaskCount = tasks.filter((t) => t.status === "active" || t.status === "queued").length;

  return (
    <div className="chat-panel-container">
      {/* Top Status HUD */}
      <div className="chat-hud-header">
        <div className="hud-title-box">
          <span className="pulse-dot" />
          <span className="hud-label">U.L.T.R.O.N. NEURAL LINK</span>
          {pondering && <span className="pondering-badge">🧠 PONDERING...</span>}
        </div>

        <div className="hud-stats">
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
              title="Voice Command"
            >
              {isListening ? "🎙️ LISTENING..." : "🎙️"}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Command U.L.T.R.O.N. (or ask to run terminal cmd, search web)..."
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
            <span className="tasks-subtitle">AUTONOMOUS RESEARCH & EXPLORATION QUEUE</span>
            <span className="tasks-hint">U.L.T.R.O.N. explores open topics and executes tasks during standby cycles.</span>
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

      {/* TAB 3: SYSTEM BENCHMARK & MEMORY */}
      {activeTab === "system" && (
        <div className="system-area">
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
            <div className="sys-header">🌐 COGNITIVE ENGINE SELECTOR</div>
            <select
              value={modelMode}
              onChange={(e) => setModelMode(e.target.value as any)}
              className="model-select-large"
            >
              <option value="auto">🔄 Auto Circuit-Breaker (Antigravity ↔ Local)</option>
              <option value="antigravity">🌐 Antigravity 100% Free Bridge</option>
              <option value="ollama">🦙 Ollama Local Offline</option>
              <option value="lm-studio">🖥️ LM Studio Local API</option>
            </select>
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
