# U.L.T.R.O.N. Autonomous Sentient Orb & Context Engine

An Iron Man–inspired cybernetic holographic AI orb built with **Next.js 16**, **Three.js**, **MediaPipe** hand tracking, **WhatsApp GoWa** messaging, and the **Never-Forget Context Engine** (SQLite FTS5 & SQZ compression).

> 🔮 **Credits & Acknowledgements**: Original 3D holographic orb visual wireframe concept inspired by Sagar Tamang. Expanded and re-architected into an autonomous, voice-controlled, multi-engine sentient AI operating system with real-time cognitive memory, infinite background task execution, and dual cloud/on-device failover intelligence.

---

## ✨ Core Capabilities

- 🧠 **Never-Forget Context Engine**: Zero memory loss! Combines semantic FTS5 SQLite vector storage with SQZ dynamic token deduplication to retain long-term conversation history without context window overflow.
- 🗣️ **Always-Active Voice Personas**: Choose between **👔 J.A.R.V.I.S.**, **👩‍🦰 F.R.I.D.A.Y.**, and **👓 E.D.I.T.H.** with acoustic Iron Man HUD telemetry chirps. Speak via manual voice command or wake-word activation (`"Ultron"`).
- ⌨️ **Synchronized Typing & Speaking**: When prompted via chat input, U.L.T.R.O.N. dynamically types out responses with real-time typewriter character animation while simultaneously vocalizing in the selected persona.
- 🎯 **Adaptive Cognitive Scaling (Thinking Weight)**: Calibrates reasoning depth and response length dynamically—responding instantly to conversational prompts while scaling deep analytical reasoning for complex engineering tasks.
- ⚡ **Dual Cloud & On-Device Model Failover**: Seamlessly route between primary Antigravity Cloud models (`gemini-2.5-pro`, `claude-3.7-sonnet`) and offline local models (`llama3:8b`, `qwen2.5:14b` via Ollama/LM Studio Bionic).
- ⚡ **Unlimited Autonomous Tasks Queue**: No task caps! Queue infinite background research and system monitoring tasks executed automatically during standby cycles.
- 🦁 **Brave Browser & Modern Web Vector UI**: Built with custom high-contrast SVG vector icons (`components/Icons.tsx`) for pristine display across Brave, Chrome, and Edge on Windows or Linux.

---

## 🚀 Getting Started

### Step 1: Start WhatsApp GoWa Container (Optional, for WhatsApp automation)
```bash
docker-compose up -d
```
*Open `http://localhost:3001` to scan your WhatsApp QR code.*

### Step 2: Launch U.L.T.R.O.N. Local Dev Server
```bash
npm install
npm run dev -- -p 7000
```
*Open **http://localhost:7000** in Google Chrome, Microsoft Edge, or Brave Browser.*

---

## 🎮 Controls & Interaction

### Touch & Mouse
| Input | Action |
| --- | --- |
| Drag | Spin the holographic orb |
| Scroll / Pinch | Zoom in & out |

### Webcam Hand Gestures
Click **GESTURES OFF** (or press `G`) and allow camera access:
| Gesture | Action |
| --- | --- |
| Pinch (thumb + index) one hand and move | Rotate orb in 3D space |
| Pinch with **both** hands, spread apart / together | Zoom camera scale |

### Keyboard Shortcuts
| Key | Action |
| --- | --- |
| `G` | Toggle hand gestures |
| `R` | Reset view |
| `+` / `−` | Zoom in / out |

---

## 🏗️ Architecture & Engines
- **`lib/orbScene.ts`**: Three.js scene featuring layered wireframe shells, spiral inner cores, floating code-text sprites, orbiting debris, dust particles, scan rings, and bloom post-processing.
- **`lib/handTracker.ts`**: MediaPipe HandLandmarker real-time webcam gesture detection with hysteresis smoothing.
- **`lib/voiceEngine.ts`**: Web Speech API & Web Audio API telemetry engine supporting multi-persona voice synthesis and Iron Man HUD sound effects.
- **`lib/aiRouter.ts`**: Intelligent traffic controller managing cloud API routing, local failover switching, and cognitive memory injection.
- **`never-forget-engine`**: Embedded SQLite FTS5 database and SQZ deduplication pipeline for permanent cognitive recall.

## License
MIT License
