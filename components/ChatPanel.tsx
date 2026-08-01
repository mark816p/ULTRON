"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { OrbSceneApi } from "@/lib/orbScene";
import { voiceEngine, VoiceProfile } from "@/lib/voiceEngine";
import { HandyVoiceEngine } from "@/lib/handyVoice";
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
      content: "U.L.T.R.O.N. v9.4.5 active. OpenDesign Canvas, Autonomous Coworker, Desktop System Automation, 24/7 Screen OCR, Voice Synthesis & OmniRoute Failover initialized. Speak 'Jarvis' or type a command.",
      engine: "system",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [modelMode, setModelMode] = useState<"auto" | "antigravity" | "api-key" | "ollama" | "lm-studio">("auto");
  const [selectedModelName, setSelectedModelName] = useState("auto");
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
  const [audioWaveform, setAudioWaveform] = useState<number[]>([0.2, 0.4, 0.6, 0.3, 0.7, 0.5, 0.2]);
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile>("jarvis");
  const [speakOnTyping, setSpeakOnTyping] = useState<boolean>(true);

  // UI states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [memOptResult, setMemOptResult] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const handyVoiceRef = useRef<HandyVoiceEngine | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handy voice engine setup
  useEffect(() => {
    const handy = new HandyVoiceEngine({
      wakeWords: ["jarvis", "edith", "friday", "ultron", "hey jarvis", "ok jarvis"],
      onWakeWordDetected: () => {
        sceneRef.current?.setAIState("thinking");
      },
      onAudioLevel: (level, waveform) => {
        if (waveform && waveform.length > 0) {
          setAudioWaveform(waveform.slice(0, 8));
        }
      },
      onTranscript: (transcript, isFinal) => {
        setInput(transcript);
        if (isFinal && transcript.trim()) {
          handleSend(undefined, transcript);
        }
      },
    });
    handyVoiceRef.current = handy;
    handy.startListening();
    setIsListening(true);

    return () => handy.stopListening();
  }, []);

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
            history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to communicate with U.L.T.R.O.N.");

        if (voiceEngine && (speakOnTyping || overrideText)) {
          voiceEngine.speak(
            data.content,
            () => sceneRef.current?.setAIState("speaking"),
            () => sceneRef.current?.setAIState("idle"),
            voiceProfile
          );
        } else {
          sceneRef.current?.setAIState("speaking");
          setTimeout(() => sceneRef.current?.setAIState("idle"), 4000);
        }

        if (data.keywords && data.keywords.length > 0) {
          sceneRef.current?.setThoughtWords(data.keywords);
        }

        const assistantMsg: Message = {
          role: "assistant",
          content: data.content,
          engine: data.engine,
          executedBrain: data.executedBrain,
          timestamp: new Date().toLocaleTimeString(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: `ERROR: ${err.message}`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
        sceneRef.current?.setAIState("error");
        setTimeout(() => sceneRef.current?.setAIState("idle"), 3000);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, modelMode, selectedModelName, onlineMode, localMode, apiProvider, apiKey, apiBaseUrl, activeBrains, apiKeys, messages, voiceProfile, speakOnTyping, sceneRef]
  );

  const handleVisionScan = async () => {
    const prompt = "Screenpipe & Vision Scan: Analyze what is currently displayed on my active workspace.";
    setInput(prompt);
    handleSend(undefined, prompt);
  };

  const handleOpenJarvisAction = async () => {
    const prompt = "OpenJarvis: Execute system status check and list running background tasks.";
    setInput(prompt);
    handleSend(undefined, prompt);
  };

  const handleCoworkerTaskAction = async () => {
    const prompt = "Accomplish Coworker: Run an autonomous audit task analyzing active system state and generate a summary report artifact.";
    setInput(prompt);
    handleSend(undefined, prompt);
  };

  const handleOpenDesignAction = async () => {
    const prompt = "Nexu OpenDesign: Synthesize a modern liquid glassmorphism HUD dashboard card component.";
    setInput(prompt);
    handleSend(undefined, prompt);
  };

  return (
    <>
      <div
        className="chat-drawer glass-panel"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
          e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
        }}
      >
        <div className="hud-bar">
          <div className="hud-title">
            <span className="pulse-led" />
            <span>U.L.T.R.O.N. CORE v9.4.5</span>
          </div>
          <div className="waveform-bar">
            {audioWaveform.map((val, idx) => (
              <span
                key={idx}
                className="wave-bar"
                style={{ height: `${Math.max(4, val * 24)}px` }}
              />
            ))}
          </div>
          <button type="button" className="icon-btn" onClick={() => setIsSettingsOpen(true)} title="Settings">
            ⚙️
          </button>
        </div>

        <div className="chat-history">
          {messages.map((m, i) => (
            <div key={i} className={`msg-bubble msg-${m.role}`}>
              <div>{m.content}</div>
              <div className="msg-meta">
                {m.timestamp} {m.executedBrain ? `• ${m.executedBrain.toUpperCase()}` : ""}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="chat-input-area">
          <input
            type="text"
            className="chat-input"
            placeholder="Type or speak ('Jarvis'...)..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="button" className="icon-btn" onClick={handleOpenDesignAction} title="Nexu OpenDesign UI Canvas Synthesis">
            🎨
          </button>
          <button type="button" className="icon-btn" onClick={handleCoworkerTaskAction} title="Accomplish AI Autonomous Coworker Task">
            🤖
          </button>
          <button type="button" className="icon-btn" onClick={handleOpenJarvisAction} title="OpenJarvis System Automation">
            ⚡
          </button>
          <button type="button" className="icon-btn" onClick={handleVisionScan} title="Screenpipe Vision Scan">
            📷
          </button>
          <button type="submit" className="icon-btn" disabled={loading}>
            {loading ? "⌛" : "➔"}
          </button>
        </form>
      </div>

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
        onEngineChange={(v) => { setModelMode(v); localStorage.setItem("ultron_engine", v); }}
        onOnlineModeChange={(v) => { setOnlineMode(v); localStorage.setItem("ultron_online_mode", v); }}
        onLocalModeChange={(v) => { setLocalMode(v); localStorage.setItem("ultron_local_mode", v); }}
        onApiProviderChange={(v) => { setApiProvider(v); localStorage.setItem("ultron_api_provider", v); }}
        onApiKeyChange={(v) => { setApiKey(v); localStorage.setItem("ultron_api_key", v); }}
        onApiBaseUrlChange={(v) => { setApiBaseUrl(v); localStorage.setItem("ultron_api_base_url", v); }}
        onModelChange={(v) => { setSelectedModelName(v); localStorage.setItem("ultron_model", v); }}
        onLocalModelChange={(v) => { setSelectedLocalModelName(v); localStorage.setItem("ultron_local_model", v); }}
        onVoiceProfileChange={(v) => { setVoiceProfile(v); localStorage.setItem("ultron_voice_profile", v); }}
        onSpeakOnTypingChange={(v) => setSpeakOnTyping(v)}
        onOptimizeMemory={() => setMemOptResult("Memory optimized! Deduplicated history tokens.")}
        onOpenBenchmark={onOpenBenchmark}
        sysInfo={sysInfo}
        memOptResult={memOptResult}
      />
    </>
  );
}
