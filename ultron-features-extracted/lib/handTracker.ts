import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// ── MediaPipe landmark indices ───────────────────────────────────────────────
const WRIST = 0;
const THUMB_MCP = 2;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_PIP = 6;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_PIP = 10;
const MIDDLE_TIP = 12;
const RING_PIP = 14;
const RING_TIP = 16;
const PINKY_MCP = 17;
const PINKY_PIP = 18;
const PINKY_TIP = 20;

const FINGER_TIPS = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP];
const FINGER_KNUCKLES = [THUMB_MCP, INDEX_PIP, MIDDLE_PIP, RING_PIP, PINKY_PIP];

// ── Tuned thresholds ─────────────────────────────────────────────────────────
// Pinch: thumb-index distance normalized to palm width (index MCP -> pinky MCP).
// This makes the threshold distance-from-camera independent.
const PINCH_ON = 0.32;
const PINCH_OFF = 0.45;

// Finger extended/curled: ratio of (wrist->tip) to (wrist->knuckle) distance.
// Simple and robust to camera-angle noise — much less twitchy than angle-based
// curl math, at the cost of being a coarser signal. Hysteresis prevents flicker
// right at the boundary.
const EXTEND_ON = 1.18;
const EXTEND_OFF = 0.95;

// Rotation (direct manipulation — must feel immediate, no debounce here)
const ROTATE_SPEED = 5.2;
const FIST_SPEED_MULT = 1.25;
const SMOOTHING = 0.4;

// Zoom
const ZOOM_MIN = 0.85;
const ZOOM_MAX = 1.18;

// Discrete one-shot poses (victory / thumbs up / thumbs down) — these DO get
// debounced, since they're one-shot triggers rather than continuous control,
// and a false 1-frame classification shouldn't fire an action.
const POSE_HOLD_FRAMES = 6;
const ACTION_COOLDOWN_MS = 900;

// Depth (wrist z -> 0..1, 1 = close to camera)
const DEPTH_SMOOTHING = 0.12;

export type GestureMode =
  | "idle"
  | "spin"
  | "zoom"
  | "fist"
  | "open_palm"
  | "victory"
  | "thumbs_up"
  | "thumbs_down";

export interface TrackerStatus {
  hands: number;
  mode: GestureMode;
  depthFactor?: number;
}

export interface HandTrackerCallbacks {
  /** Single pinched (or fisted) hand drags: deltas in mirrored normalized coords. */
  onRotate(deltaTheta: number, deltaPhi: number): void;
  /** Both hands pinch and spread/close: multiply camera distance by factor. */
  onZoom(factor: number): void;
  onGestureAction?(action: "reset" | "zoomIn" | "zoomOut" | "pulse" | "toggleUI"): void;
  onStatus(status: TrackerStatus): void;
  onDepth?(factor: number): void;
}

interface Point {
  x: number;
  y: number;
}

interface HandState {
  pinching: boolean;
  extended: boolean[]; // [thumb, index, middle, ring, pinky], hysteresis-latched
  grab: Point; // smoothed tracking point, mirrored
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

  // Keyed by handedness label so state survives hand re-ordering between frames.
  private handStates = new Map<string, HandState>();
  private prevMode: GestureMode = "idle";
  private prevSpinGrab: Point | null = null;
  private prevZoomDist: number | null = null;
  private lastStatus: TrackerStatus = { hands: 0, mode: "idle", depthFactor: 0 };

  private posePending: GestureMode | null = null;
  private poseFrames = 0;
  private lastActionTime = 0;
  private depthSmoothed = 0;

  constructor(
    video: HTMLVideoElement,
    overlay: HTMLCanvasElement,
    callbacks: HandTrackerCallbacks
  ) {
    this.video = video;
    this.overlay = overlay;
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();

    const fileset = await FilesetResolver.forVisionTasks(WASM_CDN);
    const options = {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" as const },
      runningMode: "VIDEO" as const,
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    };
    try {
      this.landmarker = await HandLandmarker.createFromOptions(fileset, options);
    } catch {
      // Some browsers/GPUs reject the GPU delegate — fall back to CPU.
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
    this.prevSpinGrab = null;
    this.prevZoomDist = null;
    this.posePending = null;
    this.poseFrames = 0;
    this.depthSmoothed = 0;
    const ctx = this.overlay.getContext("2d");
    ctx?.clearRect(0, 0, this.overlay.width, this.overlay.height);
    this.emitStatus({ hands: 0, mode: "idle", depthFactor: 0 });
  }

  private loop = () => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    if (!this.landmarker || this.video.readyState < 2) return;
    if (this.video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = this.video.currentTime;

    const result = this.landmarker.detectForVideo(this.video, performance.now());
    this.processHands(
      result.landmarks,
      result.handedness.map((h) => h[0]?.categoryName ?? "?")
    );
    this.drawOverlay(result.landmarks);
  };

  private processHands(landmarks: NormalizedLandmark[][], labels: string[]): void {
    const pinchGrabs: Point[] = []; // genuinely pinching hands (for spin/zoom)
    let fistGrab: Point | null = null; // at most one fisted hand (alt. spin path)
    let singleHandMode: GestureMode | null = null;
    const seen = new Set<string>();
    let depthSum = 0;

    landmarks.forEach((lm, i) => {
      const label = labels[i] || `hand_${i}`;
      seen.add(label);

      const palmWidth = dist2d(lm[INDEX_MCP], lm[PINKY_MCP]);
      if (palmWidth < 1e-6) return;

      depthSum += Math.max(0, Math.min(1, (-(lm[WRIST].z ?? 0) + 0.05) / 0.15));

      let state = this.handStates.get(label);
      if (!state) {
        state = { pinching: false, extended: [true, true, true, true, true], grab: { x: 0.5, y: 0.5 } };
        this.handStates.set(label, state);
      }

      // Pinch, scale-relative with hysteresis.
      const pinchRatio = dist2d(lm[THUMB_TIP], lm[INDEX_TIP]) / palmWidth;
      if (state.pinching && pinchRatio > PINCH_OFF) state.pinching = false;
      else if (!state.pinching && pinchRatio < PINCH_ON) state.pinching = true;

      // Per-finger extended/curled, scale-relative with hysteresis.
      const wrist = lm[WRIST];
      for (let f = 0; f < 5; f++) {
        const ratio =
          dist2d(wrist, lm[FINGER_TIPS[f]]) / (dist2d(wrist, lm[FINGER_KNUCKLES[f]]) + 1e-6);
        if (state.extended[f] && ratio < EXTEND_OFF) state.extended[f] = false;
        else if (!state.extended[f] && ratio > EXTEND_ON) state.extended[f] = true;
      }
      const [thumbExt, indexExt, middleExt, ringExt, pinkyExt] = state.extended;
      const extendedCount = state.extended.filter(Boolean).length;
      const isFist = extendedCount === 0;

      // Smoothed tracking point: pinch midpoint normally, wrist when fisted.
      const raw: Point = isFist
        ? { x: 1 - wrist.x, y: wrist.y }
        : { x: 1 - (lm[THUMB_TIP].x + lm[INDEX_TIP].x) / 2, y: (lm[THUMB_TIP].y + lm[INDEX_TIP].y) / 2 };
      state.grab = {
        x: state.grab.x + (raw.x - state.grab.x) * SMOOTHING,
        y: state.grab.y + (raw.y - state.grab.y) * SMOOTHING,
      };

      if (state.pinching) {
        pinchGrabs.push(state.grab);
      } else if (isFist) {
        fistGrab = state.grab;
      } else {
        // Discrete one-shot poses only apply when this hand is neither
        // pinching nor fisted. First hand detected with a recognizable
        // pose wins if two hands disagree in the same frame.
        if (extendedCount === 5) {
          singleHandMode = singleHandMode ?? "open_palm";
        } else if (indexExt && middleExt && !ringExt && !pinkyExt && !thumbExt) {
          singleHandMode = singleHandMode ?? "victory";
        } else if (thumbExt && !indexExt && !middleExt && !ringExt && !pinkyExt) {
          if (lm[THUMB_TIP].y < wrist.y - 0.1) singleHandMode = singleHandMode ?? "thumbs_up";
          else if (lm[THUMB_TIP].y > wrist.y + 0.1) singleHandMode = singleHandMode ?? "thumbs_down";
        }
      }
    });

    for (const key of this.handStates.keys()) {
      if (!seen.has(key)) this.handStates.delete(key);
    }

    const rawDepth = landmarks.length > 0 ? depthSum / landmarks.length : 0;
    this.depthSmoothed += (rawDepth - this.depthSmoothed) * DEPTH_SMOOTHING;
    this.callbacks.onDepth?.(this.depthSmoothed);

    // ── Mode resolution ────────────────────────────────────────────────────
    // Pinch/fist (direct manipulation) always wins over discrete poses.
    let mode: GestureMode;
    if (pinchGrabs.length >= 2) mode = "zoom";
    else if (pinchGrabs.length === 1) mode = "spin";
    else if (fistGrab) mode = "fist";
    else mode = (singleHandMode ?? "idle") as GestureMode;

    if (mode !== this.prevMode) {
      this.prevSpinGrab = null;
      this.prevZoomDist = null;
    }

    switch (mode) {
      case "spin":
      case "fist": {
        const grab = mode === "spin" ? pinchGrabs[0] : fistGrab;
        if (this.prevSpinGrab && grab) {
          const dx = grab.x - this.prevSpinGrab.x;
          const dy = grab.y - this.prevSpinGrab.y;
          if (Math.abs(dx) > 1e-4 || Math.abs(dy) > 1e-4) {
            const scale = mode === "fist" ? FIST_SPEED_MULT : 1;
            this.callbacks.onRotate(dx * ROTATE_SPEED * scale, dy * ROTATE_SPEED * scale);
          }
        }
        this.prevSpinGrab = grab ?? null;
        break;
      }
      case "zoom": {
        const d = dist2d(pinchGrabs[0], pinchGrabs[1]);
        if (this.prevZoomDist && d > 1e-4) {
          const factor = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.prevZoomDist / d));
          this.callbacks.onZoom(factor);
        }
        this.prevZoomDist = d;
        break;
      }
      case "victory":
      case "thumbs_up":
      case "thumbs_down": {
        if (this.posePending === mode) this.poseFrames++;
        else {
          this.posePending = mode;
          this.poseFrames = 1;
        }
        if (this.poseFrames === POSE_HOLD_FRAMES) {
          const now = performance.now();
          if (now - this.lastActionTime > ACTION_COOLDOWN_MS) {
            this.lastActionTime = now;
            if (mode === "victory") this.callbacks.onGestureAction?.("pulse");
            else if (mode === "thumbs_up") this.callbacks.onGestureAction?.("zoomIn");
            else if (mode === "thumbs_down") this.callbacks.onGestureAction?.("zoomOut");
          }
        }
        break;
      }
    }

    if (mode !== "victory" && mode !== "thumbs_up" && mode !== "thumbs_down") {
      this.posePending = null;
      this.poseFrames = 0;
    }

    this.prevMode = mode;
    this.emitStatus({
      hands: landmarks.length,
      mode,
      depthFactor: Math.round(this.depthSmoothed * 100) / 100,
    });
  }

  private emitStatus(status: TrackerStatus): void {
    if (
      status.hands !== this.lastStatus.hands ||
      status.mode !== this.lastStatus.mode ||
      Math.abs((status.depthFactor ?? 0) - (this.lastStatus.depthFactor ?? 0)) > 0.05
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
    if (!landmarks.length) return;

    const connections: [number, number][] = [
      [WRIST, 1], [1, 2], [2, 3], [3, THUMB_TIP],
      [WRIST, INDEX_MCP], [INDEX_MCP, INDEX_PIP], [INDEX_PIP, 7], [7, INDEX_TIP],
      [WRIST, MIDDLE_MCP], [MIDDLE_MCP, MIDDLE_PIP], [MIDDLE_PIP, 11], [11, MIDDLE_TIP],
      [WRIST, 13], [13, RING_PIP], [RING_PIP, 15], [15, RING_TIP],
      [WRIST, PINKY_MCP], [PINKY_MCP, PINKY_PIP], [PINKY_PIP, 19], [19, PINKY_TIP],
      [INDEX_MCP, MIDDLE_MCP], [MIDDLE_MCP, 13], [13, PINKY_MCP],
    ];

    const mode = this.lastStatus.mode;
    const color =
      mode === "zoom" ? "#ff6600"
      : mode === "fist" ? "#ffaa30"
      : mode === "spin" ? "#00ff66"
      : mode === "victory" || mode === "thumbs_up" || mode === "thumbs_down" ? "#c084fc"
      : "#00f0ff";

    landmarks.forEach((lm) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      connections.forEach(([a, b]) => {
        const pa = lm[a];
        const pb = lm[b];
        if (pa && pb) {
          ctx.moveTo((1 - pa.x) * width, pa.y * height);
          ctx.lineTo((1 - pb.x) * width, pb.y * height);
        }
      });
      ctx.stroke();
      ctx.restore();

      lm.forEach((pt, idx) => {
        const x = (1 - pt.x) * width;
        const y = pt.y * height;
        const isTip = FINGER_TIPS.includes(idx);
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = isTip ? "#ffffff" : color;
        ctx.shadowColor = color;
        ctx.shadowBlur = isTip ? 10 : 4;
        ctx.arc(x, y, isTip ? 5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      if (mode === "spin" || mode === "zoom" || mode === "fist") {
        const thumb = lm[THUMB_TIP];
        const index = lm[INDEX_TIP];
        const mx = (1 - (thumb.x + index.x) / 2) * width;
        const my = ((thumb.y + index.y) / 2) * height;
        const t = performance.now() * 0.003;
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(t);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(17, 0);
          ctx.lineTo(23, 0);
          ctx.stroke();
        }
        ctx.restore();
      }
    });

    const label = mode.toUpperCase().replace("_", " ");
    const depth = Math.round((this.lastStatus.depthFactor ?? 0) * 100);
    ctx.save();
    ctx.fillStyle = "rgba(8, 8, 14, 0.85)";
    ctx.fillRect(5, 5, 190, 26);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(5, 5, 190, 26);
    ctx.fillStyle = color;
    ctx.font = "bold 10px 'JetBrains Mono', monospace";
    ctx.fillText(`${label}  \u2295 DEPTH ${depth}%`, 10, 21);
    ctx.restore();
  }
}

function dist2d(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
