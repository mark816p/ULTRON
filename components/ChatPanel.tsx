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
}

export default function ChatPanel({ sceneRef, cameraState, onToggleGestures }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "U.L.T.R.O.N. online. Neural vectors synchronized. How may I assist you today?",
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

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  // Voice recognition setup
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
              ⚡ SQZ SAVED: {dedupSavedTokens} TOKENS
            </span>
          )}

          <div className="model-selector-wrapper">
            <label htmlFor="model-select" className="model-label">ENGINE:</label>
            <select
              id="model-select"
              value={modelMode}
              onChange={(e) => setModelMode(e.target.value as any)}
              className="model-select"
            >
              <option value="auto">🔄 Auto Circuit-Breaker</option>
              <option value="antigravity">🌐 Antigravity (Local 100% Free)</option>
              <option value="ollama">🦙 Ollama Local</option>
              <option value="lm-studio">🖥️ LM Studio</option>
            </select>
          </div>
        </div>
      </div>

      {/* Floating Keywords Badge */}
      {latestKeywords.length > 0 && (
        <div className="keywords-ticker">
          <span className="ticker-title">ACTUAL THOUGHTS:</span>
          {latestKeywords.slice(0, 6).map((kw, i) => (
            <span key={i} className="keyword-tag">#{kw}</span>
          ))}
        </div>
      )}

      {/* Messages Scroll Area */}
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

      {/* Input Form */}
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
          placeholder="Command U.L.T.R.O.N. (or ask to search web, check news, whatsapp)..."
          className="chat-input"
          disabled={loading}
        />

        <button type="submit" disabled={loading || !input.trim()} className="send-btn">
          SEND
        </button>
      </form>
    </div>
  );
}
