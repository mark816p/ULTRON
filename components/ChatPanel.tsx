"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { OrbSceneApi } from "@/lib/orbScene";
import { voiceEngine, VoiceProfile } from "@/lib/voiceEngine";
import { LogoIcon, ChatIcon, TasksIcon, SystemIcon, VoiceIcon, SendIcon, EyeIcon } from "@/components/Icons";
import SettingsModal from "@/components/SettingsModal";

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  engine?: string;
  failoverOccurred?: boolean;
  failoverReason?: string;
  executedBrain?: string;
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
  const [modelMode, setModelMode] = useState<"auto" | "antigravity" | "api-key" | "ollama" | "lm-studio">("auto");
  const [selectedModelName, setSelectedModelName] = useState("gemini-2.5-pro");
  const [selectedLocalModelName, setSelectedLocalModelName] = useState("llama3:8b");
  const [onlineMode, setOnlineMode] = useState<"antigravity" | "api-key">("antigravity");
  const [localMode, setLocalMode] = useState<"ollama" | "lm-studio">("ollama");
  const [apiProvider, setApiProvider] = useState<string>("openrouter");
  const [apiKey, setApiKey] = useState<string>("");
  const [apiBaseUrl, setApiBaseUrl] = useState<string>("");
  const [activeBrains, setActiveBrains] = useState<string[]>(["antigravity", "ollama"]);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [modelsData, setModelsData] = useState<any>(null);

  const [isListening, setIsListening] = useState(false);
  const [wakeWordActive, setWakeWordActive] = useState(true);
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile>("jarvis");
  const [pondering, setPondering] = useState(false);
  const [latestKeywords, setLatestKeywords] = useState<string[]>([]);
  const [dedupSavedTokens, setDedupSavedTokens] = useState<number>(0);
  const [speakOnTyping, setSpeakOnTyping] = useState<boolean>(true);

  // UI states
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "tasks">("chat");
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
    const savedLocalModel = localStorage.getItem("ultron_local_model");
    const savedVoice = localStorage.getItem("ultron_voice_profile") as VoiceProfile;
    const savedOnlineMode = localStorage.getItem("ultron_online_mode");
    const savedLocalMode = localStorage.getItem("ultron_local_mode");
    const savedApiProvider = localStorage.getItem("ultron_api_provider");
    const savedApiKey = localStorage.getItem("ultron_api_key");
    const savedApiBaseUrl = localStorage.getItem("ultron_api_base_url");
    const savedBrains = localStorage.getItem("ultron_active_brains");
    const savedKeys = localStorage.getItem("ultron_api_keys");
    if (savedEngine) setModelMode(savedEngine as any);
    if (savedModel) setSelectedModelName(savedModel);
    if (savedLocalModel) setSelectedLocalModelName(savedLocalModel);
    if (savedVoice && savedVoice !== ("off" as any)) setVoiceProfile(savedVoice);
    if (savedOnlineMode) setOnlineMode(savedOnlineMode as any);
    if (savedLocalMode) setLocalMode(savedLocalMode as any);
    if (savedApiProvider) setApiProvider(savedApiProvider);
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedApiBaseUrl) setApiBaseUrl(savedApiBaseUrl);
    if (savedBrains) {
      try {
        const parsed = JSON.parse(savedBrains);
        if (Array.isArray(parsed) && parsed.length > 0) setActiveBrains(parsed);
      } catch (e) {}
    }
    if (savedKeys) {
      try { setApiKeys(JSON.parse(savedKeys)); } catch (e) {}
    }

    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => {
        setModelsData(data);
        if (!savedLocalModel) {
          if (data?.ollamaModels?.[0]) setSelectedLocalModelName(data.ollamaModels[0]);
          else if (data?.lmStudioModels?.[0]) setSelectedLocalModelName(data.lmStudioModels[0]);
        }
      })
      .catch(() => {});
  }, []);

  const handleEngineChange = (newEngine: "auto" | "antigravity" | "api-key" | "ollama" | "lm-studio") => {
    setModelMode(newEngine);
    localStorage.setItem("ultron_engine", newEngine);
  };

  const handleOnlineModeChange = (val: "antigravity" | "api-key") => {
    setOnlineMode(val);
    localStorage.setItem("ultron_online_mode", val);
  };

  const handleLocalModeChange = (val: "ollama" | "lm-studio") => {
    setLocalMode(val);
    localStorage.setItem("ultron_local_mode", val);
  };

  const handleApiProviderChange = (provider: string) => {
    setApiProvider(provider);
    localStorage.setItem("ultron_api_provider", provider);
    if (modelsData) {
      const list =
        provider === "openrouter" ? modelsData.openRouterModels :
        provider === "openai" ? modelsData.openAiModels :
        provider === "gemini" ? modelsData.geminiApiModels :
        provider === "anthropic" ? modelsData.anthropicModels :
        provider === "deepseek" ? modelsData.deepSeekModels :
        provider === "groq" ? modelsData.groqModels :
        provider === "mistral" ? modelsData.mistralModels :
        provider === "xai" ? modelsData.xAiModels : [];
      if (list && list[0]) {
        setSelectedModelName(list[0]);
        localStorage.setItem("ultron_model", list[0]);
      }
    }
  };

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    localStorage.setItem("ultron_api_key", key);
  };

  const handleApiBaseUrlChange = (url: string) => {
    setApiBaseUrl(url);
    localStorage.setItem("ultron_api_base_url", url);
  };

  const handleModelChange = (newModel: string) => {
    setSelectedModelName(newModel);
    localStorage.setItem("ultron_model", newModel);
  };

  const handleLocalModelChange = (newLocalModel: string) => {
    setSelectedLocalModelName(newLocalModel);
    localStorage.setItem("ultron_local_model", newLocalModel);
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
    if (isSettingsOpen && !sysInfo) {
      fetch("/api/sysinfo")
        .then((res) => res.json())
        .then((data) => setSysInfo(data))
        .catch(() => {});
    }
  }, [isSettingsOpen, sysInfo]);

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
            fallbackModelName: localStorage.getItem("ultron_local_model") || "llama3:8b",
            onlineMode,
            localMode,
            apiProvider,
            apiKey,
            apiBaseUrl,
            activeBrains,
            apiKeys,
            ollamaModel: selectedLocalModelName,
            lmStudioModel: selectedLocalModelName,
            history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to communicate with U.L.T.R.O.N.");

        if (voiceEngine && (speakOnTyping || overrideText)) {
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

        const fullText = data.content;
        const assistantMsg: Message = {
          role: "assistant",
          content: "",
          engine: data.engine,
          failoverOccurred: data.failoverOccurred,
          failoverReason: data.failoverReason,
          executedBrain: data.executedBrain,
          dedupStats: data.dedupStats,
          timestamp: new Date().toLocaleTimeString(),
        };

        setMessages((prev) => [...prev, assistantMsg]);

        let currentLen = 0;
        const step = Math.max(1, Math.floor(fullText.length / 35));
        const typeTimer = setInterval(() => {
          currentLen += step;
          if (currentLen >= fullText.length) {
            currentLen = fullText.length;
            clearInterval(typeTimer);
          }
          const typedText = fullText.slice(0, currentLen);
          setMessages((prev) => {
            const copy = [...prev];
            const lastIdx = copy.length - 1;
            if (lastIdx >= 0 && copy[lastIdx].role === "assistant") {
              copy[lastIdx] = { ...copy[lastIdx], content: typedText };
            }
            return copy;
          });
        }, 20);
      } catch (err) {
        sceneRef.current?.setAIState("idle");
        const errMsg = (err as Error).message || "Unknown error";
        const isEngineErr = errMsg.includes("unreachable") || errMsg.includes("API Key is missing") || errMsg.includes("failed") || errMsg.includes("unavailable");
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: isEngineErr
              ? `⚠️ AI ENGINE OFFLINE: ${errMsg}\n\n💡 FIX: Go to SYSTEM tab → set your API key (Gemini / OpenRouter / OpenAI / Groq etc.) or start Ollama locally. U.L.T.R.O.N. supports 10+ engines simultaneously.`
              : `⚠️ Error: ${errMsg}`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, modelMode, selectedModelName, onlineMode, localMode, apiProvider, apiKey, apiBaseUrl, sceneRef]
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
      <div className="chat-panel-collapsed" onClick={() => setIsCollapsed(false)} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <LogoIcon size={18} />
        <span className="pulse-dot" />
        <span className="hud-label">U.L.T.R.O.N. ({selectedModelName})</span>
        {pondering && <span className="pondering-badge">🧠 PONDERING...</span>}
        <div style={{ flex: 1 }} />
        <button className="collapse-btn" title="Expand Panel">🗖 EXPAND</button>
      </div>
    );
  }

  const activeTaskCount = tasks.filter((t) => t.status === "active" || t.status === "queued").length;

  const getAvailableModels = () => {
    const defaultCloud = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-pro-exp-02-05", "gemini-2.0-flash-001", "claude-3.7-sonnet"];
    if (!modelsData) return defaultCloud;
    if (modelMode === "antigravity" || modelMode === "auto") return modelsData.antigravityModels || defaultCloud;
    if (modelMode === "ollama") return modelsData.ollamaModels || ["llama3:8b"];
    if (modelMode === "lm-studio") return modelsData.lmStudioModels || ["local-model"];
    return modelsData.antigravityModels || defaultCloud;
  };

  return (
    <div className="chat-panel-container">
      {/* Top Status HUD */}
      <div className="chat-hud-header">
        <div className="hud-title-box" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <LogoIcon size={20} />
          <span className="pulse-dot" />
          <span className="hud-label">U.L.T.R.O.N. NEURAL LINK v43</span>
          <span className="stat-pill">
            🧠 {selectedModelName}
          </span>
          <span className="stat-pill" title={`Active Brains: ${activeBrains.join(", ")}`}>
            ⚡ MULTI-BRAIN: {activeBrains.length} ACTIVE
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
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
            title="Always-Active 'Ultron' Wake Word Toggle"
          >
            <VoiceIcon size={14} active={wakeWordActive} />
            {wakeWordActive ? "WAKE WORD: ON" : "WAKE WORD: OFF"}
          </button>
          <button
            type="button"
            onClick={onToggleGestures}
            className="collapse-btn"
            style={{
              borderColor: cameraState === "gesture" ? "#00ff66" : "#888",
              color: cameraState === "gesture" ? "#00ff66" : "#888",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
            title="Hand & Head Gesture Tracking Toggle"
          >
            <EyeIcon size={14} color={cameraState === "gesture" ? "#00ff66" : "#888"} />
            {cameraState === "gesture" ? "GESTURES: ACTIVE" : "GESTURES: OFF"}
          </button>

          <button
            type="button"
            onClick={onOpenBenchmark}
            className="collapse-btn"
            style={{ borderColor: "#ffcc00", color: "#ffcc00", fontWeight: "bold" }}
            title="Run U.L.T.R.O.N. Hardware & Bionic Performance Benchmark"
          >
            ⚡ BENCHMARK
          </button>

          <button
            type="button"
            onClick={() => {
              const profiles: VoiceProfile[] = ["jarvis", "friday", "edith"];
              const next = profiles[(profiles.indexOf(voiceProfile) + 1) % profiles.length];
              setVoiceProfile(next);
              voiceEngine?.setProfile(next);
              voiceEngine?.speak(`Voice persona changed to ${next.toUpperCase()}.`);
            }}
            className="collapse-btn"
            style={{
              borderColor: "#00e5ff",
              color: "#00e5ff",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
            title="Cycle AI Voice Persona (Jarvis / Friday / Edith)"
          >
            <VoiceIcon size={14} color="#00e5ff" />
            VOICE: {voiceProfile.toUpperCase()}
          </button>

          <button
            type="button"
            onClick={() => setSpeakOnTyping(!speakOnTyping)}
            className="collapse-btn"
            style={{
              borderColor: speakOnTyping ? "#00ff66" : "#888",
              color: speakOnTyping ? "#00ff66" : "#888",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
            title="Toggle whether Ultron speaks aloud when you type in the text prompt box"
          >
            <VoiceIcon size={14} active={speakOnTyping} />
            {speakOnTyping ? "AUTO-SPEAK TYPED: ON" : "AUTO-SPEAK TYPED: OFF"}
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
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
        >
          <ChatIcon size={14} color={activeTab === "chat" ? "#00e5ff" : "#aaa"} /> NEURAL LINK
        </button>
        <button
          type="button"
          className={`hud-tab-btn ${activeTab === "tasks" ? "active" : ""}`}
          onClick={() => setActiveTab("tasks")}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
        >
          <TasksIcon size={14} color={activeTab === "tasks" ? "#ffcc00" : "#aaa"} /> AUTONOMOUS TASKS ({activeTaskCount})
        </button>
        <button
          type="button"
          className="hud-tab-btn"
          onClick={() => setIsSettingsOpen(true)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
        >
          <SystemIcon size={14} color="#00ff66" /> SETTINGS
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
                  {msg.engine && (
                    <span className="msg-engine-badge">
                      {msg.executedBrain ? `${msg.engine.toUpperCase()} [${msg.executedBrain.toUpperCase()}]` : msg.engine}
                    </span>
                  )}
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
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
              title="Manual Voice Command"
            >
              <VoiceIcon size={16} active={isListening} />
              {isListening && "LISTENING..."}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Command U.L.T.R.O.N. (or say 'Ultron <command>')..."
              className="chat-input"
              disabled={loading}
            />

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="send-btn"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
            >
              SEND <SendIcon size={14} />
            </button>
          </form>

          {/* Bottom App Version Indicator */}
          <div className="chat-app-footer-version" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 12px 6px", fontSize: "10px", color: "#888", fontFamily: "'JetBrains Mono', monospace", borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(5, 5, 8, 0.7)" }}>
            <span style={{ cursor: "pointer", textDecoration: "underline", opacity: 0.7 }} onClick={() => setIsSettingsOpen(true)} title="Open Settings to configure AI engines">⚙ CONFIG AI ENGINE</span>
            <span style={{ color: "#e0e0e0", fontWeight: "bold", background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(200, 200, 200, 0.3)", padding: "1px 8px", borderRadius: "10px", letterSpacing: "0.5px" }}>v43</span>
          </div>
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

      {/* SETTINGS POPUP MODAL */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        modelMode={modelMode}
        onlineMode={onlineMode}
        localMode={localMode}
        apiProvider={apiProvider}
        apiKey={apiKey}
        apiBaseUrl={apiBaseUrl}
        selectedModelName={selectedModelName}
        selectedLocalModelName={selectedLocalModelName}
        modelsData={modelsData}
        voiceProfile={voiceProfile}
        speakOnTyping={speakOnTyping}
        onEngineChange={handleEngineChange}
        onOnlineModeChange={handleOnlineModeChange}
        onLocalModeChange={handleLocalModeChange}
        onApiProviderChange={handleApiProviderChange}
        onApiKeyChange={handleApiKeyChange}
        onApiBaseUrlChange={handleApiBaseUrlChange}
        onModelChange={handleModelChange}
        onLocalModelChange={handleLocalModelChange}
        onVoiceProfileChange={(v) => {
          setVoiceProfile(v);
          voiceEngine?.setProfile(v);
          voiceEngine?.speak(`Greetings. I am ${v.toUpperCase()}, your automated AI assistant.`);
        }}
        onSpeakOnTypingChange={setSpeakOnTyping}
        onOptimizeMemory={handleOptimizeMemory}
        onOpenBenchmark={onOpenBenchmark}
        sysInfo={sysInfo}
        memOptResult={memOptResult}
      />
    </div>
  );
}
