<div align="center">

# 🔮 U.L.T.R.O.N.
### Autonomous Sentient Neural Orb & Context Engine

[![Version](https://img.shields.io/badge/Version-v36.0.0-00f0ff?style=for-the-badge&logo=electron&logoColor=white)](https://github.com/mark816p/ultron-autonomous-orb)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Electron](https://img.shields.io/badge/Electron-Native-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-FTS5%20Vector-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-ffaa30?style=for-the-badge)](LICENSE)

<p align="center">
  <strong style="font-size: 18px; color: #00f0ff;">Universal Neural Client &amp; Autonomous Operating System</strong><br>
  <em>Seamlessly deploys across local and cloud intelligence tiers with zero configuration.</em>
</p>

---

### ⚡ Architectural Heritage & Co-Creation

> **🤖 Designed, architected, and co-created in pair-programming collaboration with [Antigravity](https://deepmind.google) (Google DeepMind Advanced Agentic Coding AI).**  
> **🔮 Inspired by the original 3D holographic orb visual wireframe concept by Sagar Tamang.**

*Expanded and re-architected into an autonomous, voice-controlled, multi-engine sentient AI operating system with real-time cognitive memory, infinite background task execution, gesture control, and dual cloud/on-device failover intelligence.*

---

</div>

## ✨ Core Capabilities & Innovations

### 🌐 Duo Mode Intelligence (Online Cloud & Local Bionic)
U.L.T.R.O.N. features seamless dual-tier model orchestration with native custom API key support and zero-latency failover switching:
* **🟢 Online Cloud Tier (API Key Support):** Full native integration for **OpenRouter**, **Google Gemini** (*Gemini 2.5 Pro / 3.1 Pro*), **OpenAI** (*GPT-4o*), **Anthropic** (*Claude 3.5 / 3.7 Sonnet*), and custom OpenAI-compatible cloud endpoints.
* **🔵 Local Bionic Tier (100% Offline):** Complete offline execution via **Ollama** and **LM Studio Bionic** engines (`llama3:8b`, `qwen2.5:14b`, `deepseek-r1`, etc.) with automatic local hardware acceleration.

### 🧠 Never-Forget Context Engine
Zero memory loss across infinite conversation horizons. U.L.T.R.O.N. combines an embedded semantic **SQLite FTS5 vector storage engine** with an adaptive **SQZ dynamic token deduplication pipeline**. This architecture permanently retains long-term memory and cognitive reasoning history without ever overflowing LLM context windows.

### 🔮 Sentient 3D Holographic Orb
An Iron Man–inspired cybernetic visual cortex powered by **Three.js** and WebGL. Features multi-layered interactive wireframe shells, a spinning spiral inner core, floating code-text telemetry sprites, orbiting particle debris, holographic scan rings, and reactive bloom post-processing that pulses in sync with the AI's cognitive states.

### 🗣️ Always-Active Voice Personas & HUD Telemetry
Choose between three distinct acoustic identities:
* **👔 J.A.R.V.I.S.** — Refined, analytical, and courteous British butler telemetry.
* **👩‍🦰 F.R.I.D.A.Y.** — Assertive, tactical, and responsive combat AI persona.
* **👓 E.D.I.T.H.** — Sleek, modern, and direct intelligence briefing voice.

Includes authentic Iron Man HUD acoustic chirps, wake-word activation (`"Ultron"`), and real-time synchronized typewriter text vocalization.

### ⚡ Unlimited Autonomous Tasks Queue
No artificial task limits or execution caps. Queue infinite background research, codebase analysis, and system monitoring jobs. Tasks execute autonomously during standby cycles, dynamically injecting findings directly into your active cognitive session.

### 🎮 Touch, Mouse & CPU/GPU Webcam Hand Tracking
Control the holographic interface hands-free using real-time webcam vision powered by **MediaPipe HandLandmarker** with hysteresis smoothing:
* **Pinch-to-Rotate:** Pinch thumb and index finger on one hand to grab and spin the 3D orb in physical space.
* **Two-Handed Scaling:** Pinch with both hands and move them apart or together to dynamically zoom the neural camera viewport.
* **Full Mouse/Touch Sync:** Seamlessly synchronized with OrbitControls for effortless mouse dragging and touch pinching on mobile or tablet devices.

### 📦 Ultra-Fast Multi-Platform Native Installers
Built for performance. U.L.T.R.O.N. ships as an ultra-compact native desktop application generated via an optimized `asar` Electron-Builder compression pipeline with strict dev-bloat stripping:
* **🪟 Windows:** Native NSIS Installer (`.exe`, x64)
* **🍏 macOS:** Universal Disk Image (`.dmg`, Apple Silicon & Intel x64)
* **🐧 Linux:** Self-contained executable (`.AppImage`, x64)

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** v18.0.0 or higher
* **npm** v9.0.0 or higher
* *(Optional)* **Docker & Docker Compose** (required only if running WhatsApp GoWa automation)

### Step 1: Clone the Repository
```bash
git clone https://github.com/mark816p/ultron-autonomous-orb.git
cd ultron-autonomous-orb
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Launch in Web Dev Mode (Next.js 16)
Start the standalone neural UI server:
```bash
npm run dev -- -p 7000
```
*Open **http://localhost:7000** in Google Chrome, Microsoft Edge, or Brave Browser.*

### Step 4: Launch as Native Desktop OS (Electron Mode)
Run U.L.T.R.O.N. as a native desktop application with full system windowing and tray support:
```bash
npm run app
```

---

## 🏗️ Building Native Release Installers

To generate production-ready, highly compressed desktop installers for your operating system:

```bash
# Build desktop installer for current OS (Windows .exe, macOS .dmg, or Linux .AppImage)
npm run build:installer

# Build and publish release directly to GitHub Releases
npm run build:installer:publish
```
*All generated installer binaries are output to the `dist/` directory.*

---

## 🎮 Controls & Gesture Reference

### Touch & Mouse
| Input Action | Resulting System Response |
| :--- | :--- |
| **Left Click + Drag** | Spin and rotate the 3D holographic orb in free space |
| **Right Click + Drag** | Pan the camera viewport across the neural grid |
| **Scroll Wheel / Pinch** | Smoothly zoom in & out of the core hologram |

### Webcam Hand Gestures
Click the **GESTURES OFF** button in the top HUD (or press `G`) and allow camera permissions:
| Hand Gesture | Action Performed |
| :--- | :--- |
| **Single-Hand Pinch & Drag** *(Thumb + Index)* | Grabs the orb and rotates it in 3D space in real-time |
| **Dual-Hand Pinch & Spread** *(Both Hands)* | Dynamically zooms the camera scale in or out based on hand distance |

### Keyboard Shortcuts
| Key | System Action |
| :---: | :--- |
| <kbd>G</kbd> | Toggle webcam hand tracking gestures ON / OFF |
| <kbd>R</kbd> | Reset 3D camera orientation and orb rotation to default origin |
| <kbd>+</kbd> / <kbd>=</kbd> | Zoom camera viewport in |
| <kbd>-</kbd> / <kbd>_</kbd> | Zoom camera viewport out |

---

## 📂 System Architecture & Code Structure

```text
ultron-autonomous-orb/
├── app/                  # Next.js 16 App Router (API endpoints, voice synthesis, memory routes)
├── components/           # React 19 UI components (ChatPanel, HUD, Icons, ModelSelector)
├── docs/                 # Official promotional landing page & download portal (index.html)
├── lib/                  # Core AI, WebGL & Vision engines
│   ├── orbScene.ts       # Three.js 3D holographic orb scene, shaders, particle debris & bloom
│   ├── handTracker.ts    # MediaPipe CPU/GPU hand tracking & gesture smoothing pipeline
│   ├── voiceEngine.ts    # Web Speech API & Web Audio API multi-persona acoustic telemetry
│   └── aiRouter.ts       # Duo Mode intelligent cloud/local LLM router & memory injector
├── main.js               # Native Electron OS desktop wrapper, tray handler & auto-updater
├── package.json          # Project configuration, asar build rules & installer scripts
└── README.md             # Official system architecture documentation
```

---

## 📜 License & Disclaimer

### MIT License
Copyright &copy; 2026 U.L.T.R.O.N. Neural OS Contributors.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

### Autonomous Operation Disclaimer
**U.L.T.R.O.N. is an autonomous AI operating system and neural client provided "as is", without warranty of any kind, express or implied.** The creators, architects, and contributors assume no liability or responsibility for any system operations, automated file modifications, local execution outcomes, data loss, or autonomous actions executed by the software. Always review automated task queues and verify system commands when operating in full autonomous mode.

---

<p align="center">
  <strong style="color: #00f0ff;">U.L.T.R.O.N. Neural OS &copy; 2026</strong><br>
  <em>Designed, architected, and co-created in pair-programming collaboration with <strong>Antigravity</strong> (Google DeepMind Advanced Agentic Coding AI).<br>Inspired by the holographic orb concept by <strong>Sagar Tamang</strong>.</em>
</p>
