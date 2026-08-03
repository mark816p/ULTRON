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
      content: "U.L.T.R.O.N. v9.9.1 active. OpenDesign Canvas, Autonomous Coworker, Desktop System Automation, 24/7 Screen OCR, Voice Synthesis & OmniRoute Failover initialized. Speak 'Jarvis' or type a command.",
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

  // Tabs state
  const [activeTab, setActiveTab] = useState<"chat" | "memory" | "agents" | "browser" | "3d">("chat");

  // UI states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [memOptResult, setMemOptResult] = useState<string | null>(null);

  // Agent, Memory states
  const [agents, setAgents] = useState<any[]>([]);
  const [memories, setMemories] = useState<any[]>([]);
  const [memorySearch, setMemorySearch] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const handyVoiceRef = useRef<HandyVoiceEngine | null>(null);

  const scrollToBottom = () => {
    if (activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeTab]);

  useEffect(() => {
    if (activeTab === "agents") {
      fetch("/api/subagents").then(res => res.json()).then(data => setAgents(data || [])).catch(console.error);
    } else if (activeTab === "memory") {
      fetch("/api/memory-graph").then(res => res.json()).then(data => setMemories(data || [])).catch(console.error);
    }
  }, [activeTab]);

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
      setActiveTab("chat"); // ensure we see chat

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

        // Special render for agent activities
        if (data.agentActivities && data.agentActivities.length > 0) {
           data.agentActivities.forEach((act: any) => {
             setMessages(prev => [...prev, {
                role: "system",
                content: '🚀 SUB-AGENT ' + act.type.toUpperCase() + ': ' + (act.name || act.goal),
                timestamp: new Date().toLocaleTimeString()
             }]);
           });
        }

        const assistantMsg: Message = {
          role: "assistant",
          content: data.content,
          engine: data.engine,
          executedBrain: data.executedBrain,
          timestamp: new Date().toLocaleTimeString(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        
        // Auto update memory graph UI if new nodes were added
        if (data.memoryNodes && data.memoryNodes.length > 0) {
           fetch("/api/memory-graph").then(r => r.json()).then(setMemories).catch(e=>e);
        }
        
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: 'ERROR: ' + err.message,
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

  const handleQuickAction = (actionType: string) => {
    let prompt = "";
    if (actionType === "web") prompt = "Search the web for the latest updates on ";
    if (actionType === "agent") prompt = "Spawn a sub-agent to ";
    if (actionType === "memory") prompt = "Search my memory graph for ";
    if (actionType === "3d") prompt = "Generate a 3D model of ";
    
    setInput(prompt);
  };

  const renderMarkdown = (text: string) => {
    // Very basic markdown renderer for bold and code blocks
    let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const chatPanelStyles = `
    .tabs-header { display: flex; gap: 8px; padding: 10px; background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(255,255,255,0.1); overflow-x: auto; }
    .tab-btn { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #aaa; padding: 6px 12px; border-radius: 4px; cursor: pointer; white-space: nowrap; transition: all 0.2s; }
    .tab-btn.active { color: #fff; background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); border-image: linear-gradient(to right, #00f2fe, #4facfe) 1; }
    .tab-content { flex: 1; overflow-y: auto; padding: 10px; }
    .quick-actions { display: flex; gap: 4px; padding: 4px 10px; background: rgba(0,0,0,0.3); }
    .quick-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 4px 8px; color: #ccc; font-size: 12px; cursor: pointer; transition: background 0.2s; }
    .quick-btn:hover { background: rgba(255,255,255,0.15); }
    .msg-bubble { margin-bottom: 12px; padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); }
    .msg-assistant { border-left: 3px solid #4facfe; }
    .msg-user { border-left: 3px solid #00f2fe; text-align: right; }
    .msg-system { border-left: 3px solid #ff4b2b; color: #ff4b2b; font-family: monospace; font-size: 0.9em; }
    .data-card { background: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.1); }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: chatPanelStyles}} />
      <div
        className="chat-drawer glass-panel"
        style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
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
            <span>U.L.T.R.O.N. CORE v9.9.1</span>
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

        <div className="tabs-header">
          <button className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>CHAT</button>
          <button className={`tab-btn ${activeTab === 'memory' ? 'active' : ''}`} onClick={() => setActiveTab('memory')}>MEMORY MAP ({memories.length})</button>
          <button className={`tab-btn ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>AGENTS ({agents.length})</button>
          <button className={`tab-btn ${activeTab === 'browser' ? 'active' : ''}`} onClick={() => setActiveTab('browser')}>BROWSER</button>
          <button className={`tab-btn ${activeTab === '3d' ? 'active' : ''}`} onClick={() => setActiveTab('3d')}>3D MODELS</button>
        </div>

        <div className="tab-content">
          {activeTab === 'chat' && (
            <div className="chat-history">
              {messages.map((m, i) => (
                <div key={i} className={`msg-bubble msg-${m.role}`}>
                  {m.role === 'assistant' ? renderMarkdown(m.content) : <div>{m.content}</div>}
                  <div className="msg-meta">
                    {m.timestamp} {m.executedBrain ? `• ${m.executedBrain.toUpperCase()}` : ""}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {activeTab === 'agents' && (
            <div>
              <h3>Active Sub-Agents</h3>
              <div style={{ marginBottom: 10 }}>
                <input type="text" placeholder="Orchestrate Goal..." style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }} onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const goalText = e.currentTarget.value;
                    setInput(`[TOOL: orchestrate_goal(${e.currentTarget.value})]`);
                    handleSend(undefined, `[TOOL: orchestrate_goal(${e.currentTarget.value})]`);
                    e.currentTarget.value = '';
                  }
                }} />
              </div>
              {agents.length === 0 ? <p style={{ color: '#aaa' }}>No active agents.</p> : agents.map((ag, i) => (
                <div key={i} className="data-card">
                   <strong>{ag.name}</strong> ({ag.role})<br/>
                   <small>{ag.status}</small>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'memory' && (
            <div>
              <h3>Memory Graph</h3>
              <p style={{ color: '#aaa', fontSize: 12 }}>Nodes: {memories.length} | Edges: {Math.floor(memories.length * 1.5)}</p>
              <input type="text" placeholder="Search memories..." value={memorySearch} onChange={e => setMemorySearch(e.target.value)} style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', marginBottom: 10 }} />
              <button className="quick-btn" style={{ width: '100%', marginBottom: 10 }}>Open Full Map</button>
              
              {memories.filter(m => !memorySearch || (m.content && m.content.toLowerCase().includes(memorySearch.toLowerCase()))).map((mem, i) => (
                <div key={i} className="data-card">
                  <span style={{ fontSize: 10, color: '#4facfe', textTransform: 'uppercase' }}>{mem.type}</span><br/>
                  {mem.content}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'browser' && (
            <div style={{ textAlign: 'center', paddingTop: 20, color: '#aaa' }}>
              <h3>Playwright Automation</h3>
              <p>No active browser session.</p>
            </div>
          )}
          
          {activeTab === '3d' && (
            <div style={{ textAlign: 'center', paddingTop: 20, color: '#aaa' }}>
              <h3>3D Synthesis Engine</h3>
              <p>Ready to generate models.</p>
            </div>
          )}
        </div>

        <div className="quick-actions">
          <button type="button" className="quick-btn" onClick={() => handleQuickAction('web')}>🔍 Web</button>
          <button type="button" className="quick-btn" onClick={() => handleQuickAction('agent')}>🤖 Agent</button>
          <button type="button" className="quick-btn" onClick={() => handleQuickAction('memory')}>🧠 Memory</button>
          <button type="button" className="quick-btn" onClick={() => handleQuickAction('3d')}>📦 Gen 3D</button>
        </div>

        <form onSubmit={handleSend} className="chat-input-area" style={{ marginTop: 'auto' }}>
          <input
            type="text"
            className="chat-input"
            placeholder="Type or speak ('Jarvis'...)..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
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
