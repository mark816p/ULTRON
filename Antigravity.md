# 🪐 ANTIGRAVITY.md — Sentient AI Operating System Architecture & Developer Guide

> **U.L.T.R.O.N. Autonomous Operating System Architecture Reference**  
> *Universal Logistical Tactical & Reactive Operating Network (v9.4.6)*

---

## 📐 1. System Overview & Core Philosophy

**U.L.T.R.O.N.** is a high-performance, zero-download, sentient AI holographic orb operating network built on **Electron**, **Next.js 16 (Turbopack)**, **Three.js WebGL**, and an assemblage of state-of-the-art open-source AI projects.

Antigravity acts as the central pair-programmer and autonomous agent standard. It enforces dual-mode intelligence (Cloud API + Local Bionic execution), self-healing automation loops, zero-dependency client installation, and continuous multimodal context indexing.

---

## 🏛️ 2. Architectural Subsystem Directory

```mermaid
graph TD
    User([User Voice & UI Input]) --> Handy[Handy Speech Engine & VAD]
    User --> ChatUI[KokonutUI Liquid Glass HUD]
    
    Handy --> OmniRoute[OmniRoute Router & Proxy]
    ChatUI --> OmniRoute

    OmniRoute -->|Interactive Chat| CloudAPI[Free LLM Directory & Antigravity Bridge]
    OmniRoute -->|Background Heavy Work| LocalBionic[Ollama / LM Studio Local Models]

    OmniRoute --> OpenJarvis[OpenJarvis Desktop Automation]
    OmniRoute --> Accomplish[Accomplish AI Coworker Loop]
    OmniRoute --> Screenpipe[Screenpipe 24/7 OCR & Audio Indexer]
    OmniRoute --> OpenDesign[Nexu OpenDesign Canvas System]
    OmniRoute --> MCP[MCP Hub Auto-Spin-Up]
    
    Fish[Fish Studio Synthesis] <-- Voice Persona --> User
```

---

## ⚡ 3. Detailed Component Deep-Dive

### 3.1 OmniRoute Multi-Provider Proxy (`lib/omniRoute.ts`)
- **Round-Robin Multi-Key Router**: Load balances multiple API keys per provider to circumvent quota limits.
- **Failover Cooldown Matrix**: If an API key encounters an HTTP 429 or 503 error, OmniRoute automatically flags the key into a 60-second cooldown queue and seamlessly reroutes to alternate providers.
- **Duo-Mode Routing Rule**:
  - **Quick Interactive Chat**: Sent to ultra-fast cloud endpoints (Gemini 2.0 Flash, Groq, Cerebras, OpenRouter).
  - **Background Pondering & Workflows**: Offloaded to local bionic models (Ollama `llama3:8b`, LM Studio) to conserve cloud quota.

### 3.2 Accomplish AI Coworker Engine (`lib/accomplishCoworker.ts`)
- **Task Decomposition Pipeline**: Receives complex high-level goals and breaks them into ordered sub-steps (`research`, `computer_action`, `mcp_tool`, `verification`).
- **Autonomous Worker Loop**: Asynchronously executes each step, verifies outputs, and generates structured markdown report artifacts.

### 3.3 OpenJarvis Computer Automation (`lib/openJarvis.ts`)
- **Self-Healing Command Execution**: Runs system tasks, desktop application launches, shell commands, and automated repair scripts.
- **Automatic Fallback Wrapper**: If a direct command fails, OpenJarvis automatically wraps the operation with native shell fallback execution (`cmd.exe /c` or `sh -c`).

### 3.4 Screenpipe Continuous Context Indexer (`lib/screenpipe.ts`)
- **24/7 Local OCR & Audio Capture**: Records active desktop window titles, text snippets, and microphone audio transcripts.
- **Timeline Context Search**: Exposes `searchHistory(query)` to find past activities and automatically appends active window state to AI chat prompts.

### 3.5 Nexu OpenDesign System (`lib/openDesign.ts`)
- **AI UI/UX Synthesis**: Generates dynamic glassmorphism design tokens, liquid card components, HUD elements, and CSS styling on demand.

### 3.6 Fish Studio Persona Synthesis (`lib/voiceEngine.ts`)
- **Voice Personas**: Native support for **J.A.R.V.I.S.** (British Male), **E.D.I.T.H.** (Tactical Female), and **F.R.I.D.A.Y.** (Irish Female).
- **Zero-Download Fallback**: Uses standard Web Speech API if offline or if Fish API keys are unavailable.

### 3.7 Handy Hands-Free Speech Engine (`lib/handyVoice.ts`)
- **Continuous Wake-Word Detection**: Listens for `"Jarvis"`, `"Edith"`, `"Friday"`, `"Ultron"`.
- **VAD Audio Spectrum Output**: Emits real-time audio level frequency arrays for live spectrum rendering on the HUD header.

### 3.8 Model Context Protocol Hub (`lib/mcpManager.ts`)
- **Auto-Spin-Up**: Detects missing tools in user prompts and automatically initializes MCP servers on demand (`@modelcontextprotocol/server-filesystem`, `fetch`, `memory`, `git`).

---

## 🛠️ 4. Build, Packaging & Run Specifications

### Development Mode
```bash
npm run dev     # Runs Next.js 16 dev server with Turbopack
npm run app     # Launches Electron main process
```

### Fast Desktop Installer Packaging
```bash
npm run build:installer   # Produces ULTRON-Setup.exe (NSIS Fast Compression, ASAR)
```

### Electron Smart App Control Bypass (`main.js`)
- `main.js` starts an **in-process Next.js HTTP server** (`next({ dev: false, dir: appDir })`) directly inside Electron's Node runtime.
- Eliminates child-process spawning (`process.execPath`), completely bypassing Smart App Control blocking on Windows.

---

## 📝 5. Guidelines for AI Assistants & Co-Creators

1. **Strict Version Parity**: Always maintain version parity across `package.json`, `main.js`, `README.md`, `Antigravity.md`, `ChatPanel.tsx`, and `SettingsModal.tsx`.
2. **Zero-Download Guarantee**: Never ask the user to manually install external runtimes.
3. **Multi-Key Cooldown Policy**: Never fail a request on a single key error; always pass through OmniRoute's retry and fallback loop.
4. **Verification**: Always verify changes by running `npm run build`.

---
*U.L.T.R.O.N. Architecture Standard v9.4.6 • Built for Antigravity Protocol*
