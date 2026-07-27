import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Landmark indices (MediaPipe hand model)
const WRIST = 0;
const THUMB_CMC = 1;
const THUMB_MCP = 2;
const THUMB_IP = 3;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_PIP = 6;
const INDEX_DIP = 7;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_PIP = 10;
const MIDDLE_TIP = 12;
const RING_MCP = 13;
const RING_PIP = 14;
const RING_TIP = 16;
const PINKY_MCP = 17;
const PINKY_PIP = 18;
const PINKY_TIP = 20;

// High-precision 3D pinch thresholds relative to palm scale
const PINCH_ON = 0.22;
const PINCH_OFF = 0.28;

// How strongly hand movement rotates the orb (radians per normalized unit)
const ROTATE_SPEED = 9.0;
// Base smoothing factor for grab-point tracking
const BASE_SMOOTHING = 0.25;
const MAX_SMOOTHING = 0.88;

export type GestureMode =
  | "idle"
  | "spin"
  | "zoom"
  | "swipe"
  | "fist"
  | "point"
  | "victory"
  | "thumbs_up"
  | "thumbs_down"
  | "open_palm";

export interface TrackerStatus {
  hands: number;
  mode: GestureMode;
  confidence?: number;
}

export interface HandTrackerCallbacks {
  /** Called when rotating: deltas in mirrored normalized coords or angular velocities. */
  onRotate(deltaTheta: number, deltaPhi: number): void;
  /** Called when zooming: multiply camera distance by factor. */
  onZoom(factor: number): void;
  /** Called when a special gesture action is detected. */
  onGestureAction?(action: "reset" | "zoomIn" | "zoomOut" | "pulse" | "toggleUI"): void;
  onStatus(status: TrackerStatus): void;
}

interface Point {
  x: number;
  y: number;
}

interface HandState {
  mode: GestureMode;
  grab: Point; // smoothed pinch midpoint, mirrored
  wristX: number;
  confidence: number;
}

export class HandTracker {
  private video: HTMLVideoElement;
  private overlay: HTMLCanvasElement;
  private callbacks: HandTrackerCallbacks;
  private landmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private rafId = 0;
  private running = false;
  private lastVideoTime = -1;

  private handStates = new Map<string, HandState>();
  private prevMode: GestureMode = "idle";
  private candidateMode: GestureMode = "idle";
  private candidateFrames = 0;
  private prevSpinGrab: Point | null = null;
  private prevZoomDist: number | null = null;
  private lastStatus: TrackerStatus = { hands: 0, mode: "idle", confidence: 0 };

  // Kinetic rotational inertia (angular momentum)
  private vx = 0;
  private vy = 0;
  private lastActionTime = 0;

  constructor(
    video: HTMLVideoElement,
    overlay: HTMLCanvasElement,
    callbacks: HandTrackerCallbacks,
  ) {
    this.video = video;
    this.overlay = overlay;
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user", frameRate: { ideal: 60, min: 30 } },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();

    const fileset = await FilesetResolver.forVisionTasks(WASM_CDN);
    const options = {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" as const },
      runningMode: "VIDEO" as const,
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    };
    try {
      this.landmarker = await HandLandmarker.createFromOptions(fileset, options);
    } catch {
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate: "CPU" as const },
      });
    }

    this.running = true;
    this.loop();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.landmarker?.close();
    this.landmarker = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.handStates.clear();
    this.prevMode = "idle";
    this.candidateMode = "idle";
    this.candidateFrames = 0;
    this.prevSpinGrab = null;
    this.prevZoomDist = null;
    this.vx = 0;
    this.vy = 0;
    const ctx = this.overlay.getContext("2d");
    ctx?.clearRect(0, 0, this.overlay.width, this.overlay.height);
    this.emitStatus({ hands: 0, mode: "idle", confidence: 0 });
  }

  private loop = () => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    if (!this.landmarker || this.video.readyState < 2) return;
    if (this.video.currentTime === this.lastVideoTime) {
      // Continue kinetic coasting when frame hasn't updated yet
      this.applyKineticInertia();
      return;
    }
    this.lastVideoTime = this.video.currentTime;

    const result = this.landmarker.detectForVideo(this.video, performance.now());
    this.processHands(result.landmarks, result.handedness.map((h) => h[0]?.categoryName ?? "?"));
    this.drawOverlay(result.landmarks);
    this.applyKineticInertia();
  };

  private applyKineticInertia(): void {
    // Apply inertia when in idle, point, or victory modes (not actively dragging or braking)
    if (
      this.prevMode === "idle" ||
      this.prevMode === "point" ||
      this.prevMode === "victory" ||
      this.prevMode === "thumbs_up" ||
      this.prevMode === "thumbs_down"
    ) {
      this.vx *= 0.94;
      this.vy *= 0.94;
      if (Math.hypot(this.vx, this.vy) > 1e-5) {
        this.callbacks.onRotate(this.vx, this.vy);
      } else {
        this.vx = 0;
        this.vy = 0;
      }
    } else if (this.prevMode === "open_palm") {
      // Air brake! Immediately absorb momentum
      this.vx *= 0.45;
      this.vy *= 0.45;
      if (Math.hypot(this.vx, this.vy) > 1e-5) {
        this.callbacks.onRotate(this.vx, this.vy);
      } else {
        this.vx = 0;
        this.vy = 0;
      }
    }
  }

  private processHands(
    landmarks: NormalizedLandmark[][],
    labels: string[],
  ): void {
    const pinchedGrabs: Point[] = [];
    const openPalms: { x: number; label: string }[] = [];
    const seen = new Set<string>();
    let detectedModes: GestureMode[] = [];

    landmarks.forEach((lm, i) => {
      const label = labels[i] || `hand_${i}`;
      seen.add(label);

      // Compute 3D distances (incorporating depth Z) for robustness
      const palmScale = dist3d(lm[WRIST], lm[MIDDLE_MCP]);
      if (palmScale < 1e-6) return;

      const pinchDist = dist3d(lm[THUMB_TIP], lm[INDEX_TIP]);
      const pinchRatio = pinchDist / palmScale;

      // Classify finger extension states (3D)
      const indexExt = isFingerExtended(lm, WRIST, INDEX_PIP, INDEX_TIP);
      const middleExt = isFingerExtended(lm, WRIST, MIDDLE_PIP, MIDDLE_TIP);
      const ringExt = isFingerExtended(lm, WRIST, RING_PIP, RING_TIP);
      const pinkyExt = isFingerExtended(lm, WRIST, PINKY_PIP, PINKY_TIP);
      const thumbExt = isThumbExtended(lm);

      const extCount = (indexExt ? 1 : 0) + (middleExt ? 1 : 0) + (ringExt ? 1 : 0) + (pinkyExt ? 1 : 0) + (thumbExt ? 1 : 0);

      const raw: Point = {
        x: 1 - (lm[THUMB_TIP].x + lm[INDEX_TIP].x) / 2,
        y: (lm[THUMB_TIP].y + lm[INDEX_TIP].y) / 2,
      };

      let state = this.handStates.get(label);
      if (!state) {
        state = { mode: "idle", grab: raw, wristX: 1 - lm[WRIST].x, confidence: 100 };
        this.handStates.set(label, state);
      }

      // Determine raw gesture mode for this hand
      let handMode: GestureMode = "idle";
      if (pinchRatio < PINCH_ON) {
        handMode = "spin";
      } else if (extCount === 0 || (extCount <= 1 && pinchRatio < PINCH_OFF && !indexExt)) {
        handMode = "fist";
      } else if (extCount >= 4) {
        handMode = "open_palm";
      } else if (indexExt && !middleExt && !ringExt && !pinkyExt) {
        handMode = "point";
      } else if (indexExt && middleExt && !ringExt && !pinkyExt) {
        handMode = "victory";
      } else if (thumbExt && !indexExt && !middleExt && !ringExt && !pinkyExt) {
        // Check vertical orientation of thumb relative to wrist
        const thumbUp = lm[THUMB_TIP].y < lm[WRIST].y - 0.08;
        const thumbDown = lm[THUMB_TIP].y > lm[WRIST].y + 0.08;
        if (thumbUp) handMode = "thumbs_up";
        else if (thumbDown) handMode = "thumbs_down";
      }

      state.mode = handMode;
      detectedModes.push(handMode);

      // Calculate movement delta for adaptive One-Euro style smoothing
      const speed = Math.hypot(raw.x - state.grab.x, raw.y - state.grab.y);
      const alpha = Math.min(MAX_SMOOTHING, Math.max(BASE_SMOOTHING, speed * 28));

      const prevWristX = state.wristX;
      state.wristX = 1 - lm[WRIST].x;

      state.grab = {
        x: state.grab.x + (raw.x - state.grab.x) * alpha,
        y: state.grab.y + (raw.y - state.grab.y) * alpha,
      };

      if (handMode === "spin" || handMode === "fist") {
        pinchedGrabs.push(state.grab);
      } else if (handMode === "open_palm") {
        openPalms.push({ x: state.wristX - prevWristX, label });
      }
    });

    for (const key of this.handStates.keys()) {
      if (!seen.has(key)) this.handStates.delete(key);
    }

    // Determine global gesture mode
    // CRITICAL FIX: Zoom only triggers when BOTH hands are actively pinching (spin/fist mode).
    // A single pinching hand + any idle/open second hand must NOT trigger zoom.
    const activePinchHands = pinchedGrabs.length;
    const totalHands = landmarks.length;

    let targetMode: GestureMode;
    if (activePinchHands >= 2) {
      // Both hands are pinching — true zoom gesture
      targetMode = "zoom";
    } else if (activePinchHands === 1) {
      // Only one hand is pinching — spin or fist, regardless of how many hands are in frame
      const pinchingHandMode = Array.from(this.handStates.values()).find(
        (s) => s.mode === "spin" || s.mode === "fist"
      )?.mode;
      targetMode = pinchingHandMode === "fist" ? "fist" : "spin";
    } else {
      // No pinching hands
      targetMode = detectedModes[0] || "idle";
    }

    // Check fast open palm swipe
    if (targetMode === "open_palm" || targetMode === "idle") {
      const fastSwipe = openPalms.find((p) => Math.abs(p.x) > 0.016);
      if (fastSwipe) {
        targetMode = "swipe";
        this.callbacks.onRotate(fastSwipe.x * ROTATE_SPEED * 1.5, 0);
      }
    }

    // Debounce state transitions (2 frames hysteresis) unless actively spinning or zooming
    if (targetMode !== this.candidateMode) {
      this.candidateMode = targetMode;
      this.candidateFrames = 1;
    } else {
      this.candidateFrames++;
    }

    let mode = this.prevMode;
    if (
      this.candidateFrames >= 2 ||
      targetMode === "spin" ||
      targetMode === "fist" ||
      targetMode === "zoom" ||
      targetMode === "swipe"
    ) {
      mode = targetMode;
    }

    if (mode !== this.prevMode && mode !== "swipe") {
      this.prevSpinGrab = null;
      this.prevZoomDist = null;
      this.prevMode = mode;

      // Trigger one-shot action callbacks
      const now = performance.now();
      if (now - this.lastActionTime > 800) {
        if (mode === "victory") {
          this.callbacks.onGestureAction?.("pulse");
          this.lastActionTime = now;
        } else if (mode === "thumbs_up") {
          this.callbacks.onGestureAction?.("zoomIn");
          this.lastActionTime = now;
        } else if (mode === "thumbs_down") {
          this.callbacks.onGestureAction?.("zoomOut");
          this.lastActionTime = now;
        } else if (mode === "point") {
          this.callbacks.onGestureAction?.("reset");
          this.lastActionTime = now;
        }
      }
    }

    if (mode === "spin" || mode === "fist") {
      const grab = pinchedGrabs[0];
      if (this.prevSpinGrab && grab) {
        const dx = grab.x - this.prevSpinGrab.x;
        const dy = grab.y - this.prevSpinGrab.y;
        // Deadzone thresholding
        if (Math.hypot(dx, dy) > 0.0018) {
          const rotX = dx * ROTATE_SPEED * (mode === "fist" ? 1.25 : 1.0);
          const rotY = dy * ROTATE_SPEED * (mode === "fist" ? 1.25 : 1.0);
          this.callbacks.onRotate(rotX, rotY);
          // Store angular momentum for smooth inertial coasting upon release
          this.vx = 0.72 * this.vx + 0.28 * rotX;
          this.vy = 0.72 * this.vy + 0.28 * rotY;
        }
      }
      this.prevSpinGrab = grab || null;
    } else if (mode === "zoom") {
      if (pinchedGrabs[0] && pinchedGrabs[1]) {
        const d = Math.hypot(
          pinchedGrabs[0].x - pinchedGrabs[1].x,
          pinchedGrabs[0].y - pinchedGrabs[1].y,
        );
        if (this.prevZoomDist && d > 1e-4) {
          const factor = Math.min(1.18, Math.max(0.85, this.prevZoomDist / d));
          this.callbacks.onZoom(factor);
        }
        this.prevZoomDist = d;
      }
    }

    const conf = landmarks.length > 0 ? Math.min(99, 75 + landmarks[0].length * 1.1) : 0;
    this.emitStatus({ hands: landmarks.length, mode, confidence: Math.floor(conf) });
  }

  private emitStatus(status: TrackerStatus): void {
    if (
      status.hands !== this.lastStatus.hands ||
      status.mode !== this.lastStatus.mode ||
      Math.abs((status.confidence || 0) - (this.lastStatus.confidence || 0)) > 5
    ) {
      this.lastStatus = status;
      this.callbacks.onStatus(status);
    }
  }

  private drawOverlay(landmarks: NormalizedLandmark[][]): void {
    const ctx = this.overlay.getContext("2d");
    if (!ctx) return;
    const { width, height } = this.overlay;
    ctx.clearRect(0, 0, width, height);
    if (!landmarks || landmarks.length === 0) return;

    // Hand skeleton connection pairs
    const connections = [
      [WRIST, THUMB_CMC], [THUMB_CMC, THUMB_MCP], [THUMB_MCP, THUMB_IP], [THUMB_IP, THUMB_TIP],
      [WRIST, INDEX_MCP], [INDEX_MCP, INDEX_PIP], [INDEX_PIP, INDEX_DIP], [INDEX_DIP, INDEX_TIP],
      [WRIST, MIDDLE_MCP], [MIDDLE_MCP, MIDDLE_PIP], [MIDDLE_PIP, 11], [11, MIDDLE_TIP],
      [WRIST, RING_MCP], [RING_MCP, RING_PIP], [RING_PIP, 15], [15, RING_TIP],
      [WRIST, PINKY_MCP], [PINKY_MCP, PINKY_PIP], [PINKY_PIP, 19], [19, PINKY_TIP],
      [INDEX_MCP, MIDDLE_MCP], [MIDDLE_MCP, RING_MCP], [RING_MCP, PINKY_MCP]
    ];

    landmarks.forEach((lm) => {
      // Draw cybernetic skeleton lines
      ctx.save();
      ctx.strokeStyle = "rgba(0, 240, 255, 0.75)";
      ctx.lineWidth = 1.8;
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      connections.forEach(([p1, p2]) => {
        const pt1 = lm[p1];
        const pt2 = lm[p2];
        if (pt1 && pt2) {
          ctx.moveTo((1 - pt1.x) * width, pt1.y * height);
          ctx.lineTo((1 - pt2.x) * width, pt2.y * height);
        }
      });
      ctx.stroke();
      ctx.restore();

      // Draw glowing joint nodes — always visible on all 21 landmarks
      lm.forEach((pt, idx) => {
        const x = (1 - pt.x) * width;
        const y = pt.y * height;
        const isTip = idx === THUMB_TIP || idx === INDEX_TIP || idx === MIDDLE_TIP || idx === RING_TIP || idx === PINKY_TIP;
        const isKnuckle = idx === THUMB_MCP || idx === INDEX_MCP || idx === MIDDLE_MCP || idx === RING_MCP || idx === PINKY_MCP;

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, isTip ? 5 : isKnuckle ? 3 : 2, 0, Math.PI * 2);
        // Fingertips: bright white-cyan; knuckles: cyan; other joints: dim
        ctx.fillStyle = isTip ? "#ffffff" : isKnuckle ? "#00f0ff" : "rgba(0, 240, 255, 0.6)";
        ctx.shadowColor = isTip ? "#ffffff" : "#00f0ff";
        ctx.shadowBlur = isTip ? 14 : isKnuckle ? 6 : 3;
        ctx.fill();
        // White ring outline on fingertips
        if (isTip) {
          ctx.strokeStyle = "rgba(0, 240, 255, 0.8)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.restore();
      });
    });

    // Draw target crosshairs for active grab / pinch / zoom
    if (this.lastStatus.mode === "spin" || this.lastStatus.mode === "fist" || this.lastStatus.mode === "zoom") {
      landmarks.forEach((lm) => {
        const thumb = lm[THUMB_TIP];
        const index = lm[INDEX_TIP];
        if (thumb && index) {
          const midX = (1 - (thumb.x + index.x) / 2) * width;
          const midY = ((thumb.y + index.y) / 2) * height;
          const time = performance.now() * 0.003;

          ctx.save();
          ctx.translate(midX, midY);
          ctx.rotate(time);
          ctx.strokeStyle = this.lastStatus.mode === "fist" ? "#ffaa30" : "#00ff66";
          ctx.lineWidth = 1.5;
          ctx.shadowColor = ctx.strokeStyle;
          ctx.shadowBlur = 8;

          ctx.beginPath();
          ctx.arc(0, 0, 14, 0, Math.PI * 2);
          ctx.stroke();

          // Outer crosshair ticks
          for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(18, 0);
            ctx.lineTo(24, 0);
            ctx.stroke();
          }
          ctx.restore();
        }
      });
    }

    // Top HUD status badge
    ctx.save();
    ctx.fillStyle = "rgba(10, 10, 15, 0.8)";
    ctx.fillRect(6, 6, 172, 26);
    ctx.strokeStyle = "rgba(0, 240, 255, 0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(6, 6, 172, 26);

    ctx.fillStyle = "#00f0ff";
    ctx.font = "bold 10px 'JetBrains Mono', monospace";
    ctx.fillText(`HUD // ${this.lastStatus.mode.toUpperCase()}`, 12, 23);

    // Kinetic momentum indicator
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 0.005) {
      ctx.fillStyle = "#ffaa30";
      ctx.fillRect(130, 15, Math.min(42, speed * 200), 6);
    }
    ctx.restore();
  }
}

function dist3d(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function isFingerExtended(
  lm: NormalizedLandmark[],
  wristIdx: number,
  pipIdx: number,
  tipIdx: number,
): boolean {
  const tipToWrist = dist3d(lm[tipIdx], lm[wristIdx]);
  const pipToWrist = dist3d(lm[pipIdx], lm[wristIdx]);
  const tipToPip = dist3d(lm[tipIdx], lm[pipIdx]);
  const pipToMcp = dist3d(lm[pipIdx], lm[pipIdx - 1]);
  return tipToWrist > 1.22 * pipToWrist && tipToPip > 0.85 * pipToMcp;
}

function isThumbExtended(lm: NormalizedLandmark[]): boolean {
  const tipToWrist = dist3d(lm[THUMB_TIP], lm[WRIST]);
  const ipToWrist = dist3d(lm[THUMB_IP], lm[WRIST]);
  const tipToPinkyMcp = Math.hypot(lm[THUMB_TIP].x - lm[PINKY_MCP].x, lm[THUMB_TIP].y - lm[PINKY_MCP].y);
  const mcpToPinkyMcp = Math.hypot(lm[THUMB_MCP].x - lm[PINKY_MCP].x, lm[THUMB_MCP].y - lm[PINKY_MCP].y);
  return tipToWrist > 1.15 * ipToWrist && tipToPinkyMcp > 1.05 * mcpToPinkyMcp;
}
