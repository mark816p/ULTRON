<div align="center">

# 🔮 U.L.T.R.O.N.
## Unified Logistics and Tactical Response Omnicomplex Network
### Sentient Holographic AI Orb, OpenDesign Canvas, Coworker & Operating System

```text
 ██╗   ██╗██╗     ████████╗██████╗  ██████╗ ███╗   ██╗
 ██║   ██║██║     ╚══██╔══╝██╔══██╗██╔═══██╗████╗  ██║
 ██║   ██║██║        ██║   ██████╔╝██║   ██║██╔██╗ ██║
 ██║   ██║██║        ██║   ██╔══██╗██║   ██║██║╚██╗██║
 ╚██████╔╝███████╗   ██║   ██║  ██║╚██████╔╝██║ ╚████║
  ╚═════╝ ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
```

[![Version](https://img.shields.io/badge/Version-v9.9.1-00f0ff?style=for-the-badge&logo=electron&logoColor=white)](https://github.com/mark816p/ULTRON)
[![License](https://img.shields.io/badge/License-MIT-ffaa30?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Win%20%7C%20Mac%20%7C%20Linux-brightgreen?style=for-the-badge)]()
[![Electron](https://img.shields.io/badge/Electron-Native-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)

<p align="center">
  <strong style="font-size: 18px; color: #38bdf8;">The Ultimate AI Desktop Environment</strong><br>
  <em>ULTRON is not just a chatbot; it's a fully autonomous agentic operating system designed to run as a transparent overlay on your machine. With an omnipresent holographic interface, real-time screen OCR memory, advanced multi-agent orchestration, and the ability to modify its own source code, ULTRON acts as your tireless co-pilot, system administrator, and creative partner.</em>
</p>

</div>

---

## 📸 Interface

![ULTRON Interface](docs/screenshot.png)

---

## ✨ Features

| Feature | Status | Description |
|---|---|---|
| **Holographic UI** | ✅ | Stunning WebGL/Three.js based orb that reacts to voice and system state. |
| **Autonomous Agents** | ✅ | Spawn parallel sub-agents to handle complex multi-step tasks independently. |
| **Memory Graph** | ✅ | Persistent node-based memory system that remembers every project, snippet, and context. |
| **OmniRoute Failover** | ✅ | Intelligent routing between OpenAI, Anthropic, Gemini, Groq, DeepSeek, and local models. |
| **Self-Modification** | ✅ | ULTRON can read, edit, and compile its own source code to upgrade itself. |
| **24/7 Screen OCR** | ✅ | Continuous local screen buffering for perfect contextual awareness of your workspace. |
| **Voice Synthesis** | ✅ | Real-time wake-word detection and premium TTS personas (Jarvis, Friday). |
| **System Automation** | ✅ | Deep OS integration to run scripts, manage files, and automate workflows. |
| **MCP Hub** | ✅ | Native Model Context Protocol support to connect with GitHub, Notion, Figma, etc. |
| **3D Model Gen** | ✅ | Built-in pipelines to generate 3D assets via Meshy or Tripo3D directly to the canvas. |

---

## 📐 Architecture

```text
+-------------------------------------------------------------------+
|                        U.L.T.R.O.N. OS                            |
|                                                                   |
|  +----------------+  +-----------------+  +--------------------+  |
|  |   Next.js UI   |  | Holographic Orb |  |  Voice Subsystem   |  |
|  | (React, Glass) |  |   (Three.js)    |  | (VAD, TTS, STT)    |  |
|  +-------+--------+  +--------+--------+  +---------+----------+  |
|          |                    |                     |             |
|  +-------v--------------------v---------------------v----------+  |
|  |                    ELECTRON MAIN KERNEL                     |  |
|  |  +---------------+  +---------------+  +-----------------+  |  |
|  |  | Agent Router  |  | Memory Graph  |  |   File System   |  |  |
|  |  | (OmniRoute)   |  | (Vector+Node) |  |   Automation    |  |  |
|  |  +-------+-------+  +-------+-------+  +--------+--------+  |  |
|  +----------|------------------|-------------------|-----------+  |
|             |                  |                   |              |
+-------------|------------------|-------------------|--------------+
              v                  v                   v
      +---------------+  +---------------+  +-----------------+
      | Cloud LLMs    |  | Local LLMs    |  | MCP Servers     |
      | (Groq, GPT-4) |  | (Ollama, LM)  |  | (GitHub, Notion)|
      +---------------+  +---------------+  +-----------------+
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js v20+
- Git
- Optional: Python 3.10+ (for local AI and advanced MCP servers)

### 2. Install from Release
Download the latest pre-compiled binary for your operating system from the [Releases page](https://github.com/mark816p/ULTRON/releases).
- Windows: `.exe` installer
- macOS: `.dmg` or `.pkg`
- Linux: `.AppImage`

### 3. Setup Guide

#### First-Time Setup Wizard
Upon first launch, ULTRON will guide you through the initial configuration:
1. **API Configuration:** Enter your preferred AI provider keys.
2. **Theme Selection:** Choose your holographic orb style.
3. **Workspace Indexing:** Select directories for ULTRON to index into the Memory Graph.

#### Configure AI Engines (OmniRoute)
ULTRON supports multiple providers to ensure maximum uptime and cost efficiency:
- **Groq:** Free tier available! Lightning fast inference for rapid agent loops.
- **OpenRouter:** Excellent for routing to specialized models.
- **Google Gemini:** High context windows for massive codebase analysis.
- **Anthropic / OpenAI:** Premium reasoning models for complex tasks.

#### Voice Setup
- **Input:** Ensure your default microphone is selected. The VAD (Voice Activity Detection) engine runs locally and only activates on wake words ("Ultron", "Jarvis").
- **Output:** Choose between local TTS (Piper) or premium cloud TTS (ElevenLabs).

#### Optional: Local AI with Ollama
For complete privacy and offline capabilities:
1. Install [Ollama](https://ollama.ai/).
2. Pull a model: `ollama run llama3`
3. In ULTRON settings, set the Local AI endpoint to `http://localhost:11434`.

#### Optional: Browser Automation
To enable ULTRON to browse the web autonomously:
```bash
npm install -g playwright
npx playwright install chromium
```

#### Optional: 3D Model Generation
1. Create a free account at [Meshy.ai](https://meshy.ai) or Tripo3D.
2. Generate an API key.
3. Add the key to ULTRON's `.env` configuration.

### 4. Build from Source

```bash
# Clone repository
git clone https://github.com/mark816p/ULTRON.git
cd ULTRON

# Install dependencies
npm install

# Copy environment template and fill in your keys
cp .env.example .env

# Run development mode
npm run dev

# Run desktop mode
npm run app

# Build production installer
npm run build:installer
```

---

## 🧠 OmniRoute Setup Guide

OmniRoute is ULTRON's dynamic brain-switching matrix. It automatically routes tasks to the best model based on complexity, speed, and cost, while falling back during outages.

**Supported Providers & Free Keys:**
1. **Groq (Recommended for Speed):** Get a free API key at [console.groq.com](https://console.groq.com). Extremely fast LLaMA 3 inference.
2. **Google Gemini:** Free tier available at [Google AI Studio](https://aistudio.google.com/). Great for 1M+ context windows.
3. **OpenRouter:** Aggregator with many free tier models. Get keys at [openrouter.ai](https://openrouter.ai).
4. **DeepSeek:** Cost-effective and highly capable coding models. Get keys at [platform.deepseek.com](https://platform.deepseek.com).

Configure these in your `.env` file to enable robust failover capabilities.

---

## 🕸️ Memory Graph

ULTRON doesn't just store chat history; it builds a semantic understanding of your world using a Graph Database.
- **Nodes:** Every project, file, concept, and error is stored as a Node.
- **Edges:** Relationships are mapped automatically. E.g., `(Project_A) -[USES]-> (React)`.
- **Querying:** When you ask a question, ULTRON traverses the graph to pull all relevant context before querying the LLM, ensuring zero hallucination and perfect continuity between sessions.

---

## 🤖 Sub-Agent Orchestration

For complex tasks, the primary ULTRON kernel acts as a manager.
1. **Decomposition:** "Build a weather app" is broken down into UI, Logic, and API integration.
2. **Spawning:** ULTRON spawns three separate agent threads.
3. **Execution:** Agents work in parallel, communicating via an internal event bus.
4. **Synthesis:** The primary kernel merges the agents' work and presents the final product.

---

## 🔌 MCP Hub (Model Context Protocol)

The MCP Hub allows ULTRON to connect securely to your existing tools.
- **Built-in Servers:** FileSystem, Terminal, Memory.
- **External Servers:** Easily connect to GitHub, Postgres, Notion, Slack, and more by adding them to the `mcp_config.json`.
- **Auto-Discovery:** ULTRON dynamically reads the schema of connected MCP servers and learns how to use them instantly.

---

## 💻 Developer Section

### Project Structure
- `/src/main`: Electron backend, OS integrations, MCP Hub.
- `/src/renderer`: Next.js frontend, Holographic UI, React components.
- `/src/agents`: AI logic, orchestrators, tools, Memory Graph engine.
- `/public`: Assets, 3D models, sounds.

### Adding New Tools
Tools are defined in `/src/agents/tools/`. Create a new class extending `BaseTool` with a defined schema, and ULTRON will automatically discover and utilize it.

### Adding MCP Servers
Edit `~/.ultron/mcp_config.json` to add new standard MCP servers. ULTRON manages the child processes automatically.

### Self-Modification API
ULTRON possesses tools to read and overwrite its own source files. This is sandboxed by default. To enable full autonomous self-upgrades, toggle `ALLOW_SELF_MODIFICATION=true` in `.env`. **Warning: Use with caution.**

---

## 🛠️ Troubleshooting

- **White Screen on Launch:** Ensure your GPU drivers support WebGL for the Three.js orb. Fallback 2D mode can be activated via config.
- **Voice Not Activating:** Check your microphone permissions in system settings. Ensure the `VAD_SENSITIVITY` in `.env` is calibrated correctly.
- **Agent Loops Endlessly:** If an agent gets stuck in an error loop, use the command `Ultron, halt all agents` or press `Ctrl+Shift+K`.

---

## 🤝 Contributing

We welcome contributions! Please see `CONTRIBUTING.md` for our code of conduct and pull request process.
1. Fork the repo.
2. Create a feature branch.
3. Commit your changes.
4. Push to the branch.
5. Open a Pull Request.

---

## ⚖️ License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Copyright © 2026 U.L.T.R.O.N. Systems & mark816p.
