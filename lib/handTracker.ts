import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// ── MediaPipe Landmark Indices ───────────────────────────────────────────────
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
const MIDDLE_DIP = 11;
const MIDDLE_TIP = 12;
const RING_MCP = 13;
const RING_PIP = 14;
const RING_DIP = 15;
const RING_TIP = 16;
const PINKY_MCP = 17;
const PINKY_PIP = 18;
const PINKY_DIP = 19;
const PINKY_TIP = 20;

// ── Tuned Thresholds ─────────────────────────────────────────────────────────
// Pinch: normalized to INDEX_MCP→PINKY_MCP "palm width" (adapts to distance)
const PINCH_ON = 0.30;        // pinch activates < 30% of palm width
const PINCH_OFF = 0.42;       // hysteresis — releases > 42% of palm width
const PINCH_LATCH = 18;       // frames to coast after thumb leaves frame

// Curl: angle (0–1) at which a finger is considered "curled shut"
// Using MCP→PIP→TIP dot product normalized to [0,1]
const CURL_CLOSED = 0.55;     // below this = finger curled
const CURL_OPEN = 0.70;       // above this = finger extended (hysteresis)

// Rotation
const ROTATE_SPEED = 8.5;
const DEADZONE = 0.0012;      // minimum delta before rotation fires
const SMOOTHING_BASE = 0.20;  // EMA alpha at low speed
const SMOOTHING_MAX = 0.80;   // EMA alpha at high speed
const INERTIA_DECAY = 0.93;   // momentum decay per frame (idle coast)
const BRAKE_DECAY = 0.40;     // momentum decay per frame (open palm brake)

// Zoom
const ZOOM_SUSTAIN = 8;       // frames both hands must sustain spread/pinch
const ZOOM_DELTA = 0.022;     // 2.2% spread change required to engage zoom
const ZOOM_LATCH = 14;        // frames baseline holds after hands separate

// Mode debounce
const DEBOUNCE_FRAMES = 4;    // frames a new mode must hold before committing
const ACTION_COOLDOWN = 900;  // ms between one-shot gesture actions

// ── Types ────────────────────────────────────────────────────────────────────
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
  /** 0–1 depth factor: 1 = hand very close, 0 = hand far away */
  depthFactor?: number;
}

export interface HandTrackerCallbacks {
  onRotate(deltaTheta: number, deltaPhi: number): void;
  onZoom(factor: number): void;
  onGestureAction?(action: "reset" | "zoomIn" | "zoomOut" | "pulse" | "toggleUI"): void;
  onStatus(status: TrackerStatus): void;
  onDepth?(factor: number): void;
}

interface Point {
  x: number;
  y: number;
}

interface FingerState {
  curl: number;     // 0 = open, 1 = fully curled (angle-based)
  extended: boolean;
  hysteresis: boolean; // latched open/closed to prevent flicker
}

interface HandState {
  mode: GestureMode;
  grab: Point;
  wristX: number;
  pinchLatch: number;
  pinchLatched: boolean;
  fingers: FingerState[]; // [thumb, index, middle, ring, pinky]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** 3D Euclidean distance using x, y, z */
function dist3d(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

/**
 * Compute curl factor for a finger using the angle at the PIP joint.
 * Returns 0 (fully extended) → 1 (fully curled).
 * Uses vectors MCP→PIP and PIP→TIP; the dot product tells us straightness.
 */
function computeCurl(
  lm: NormalizedLandmark[],
  mcpIdx: number,
  pipIdx: number,
  tipIdx: number
): number {
  const mcp = lm[mcpIdx];
  const pip = lm[pipIdx];
  const tip = lm[tipIdx];

  // Vector from MCP to PIP
  const v1x = pip.x - mcp.x;
  const v1y = pip.y - mcp.y;
  const v1z = (pip.z ?? 0) - (mcp.z ?? 0);
  const len1 = Math.hypot(v1x, v1y, v1z) + 1e-8;

  // Vector from PIP to TIP
  const v2x = tip.x - pip.x;
  const v2y = tip.y - pip.y;
  const v2z = (tip.z ?? 0) - (pip.z ?? 0);
  const len2 = Math.hypot(v2x, v2y, v2z) + 1e-8;

  // Normalized dot product (1 = straight, -1 = fully bent back)
  const dot = (v1x * v2x + v1y * v2y + v1z * v2z) / (len1 * len2);

  // Map: 1 (straight/open) → 0 curl, -1 (fully bent) → 1 curl
  return (1 - dot) / 2;
}

/**
 * Compute thumb curl using CMC→MCP→IP angle.
 * Thumb has different anatomy — abduction matters more than curl.
 */
function computeThumbCurl(lm: NormalizedLandmark[]): number {
  const cmc = lm[THUMB_CMC];
  const mcp = lm[THUMB_MCP];
  const tip = lm[THUMB_TIP];

  // Abduction: how far is the thumb tip from the palm center (index MCP)?
  const palmWidth = dist3d(lm[INDEX_MCP], lm[PINKY_MCP]) + 1e-8;
  const thumbSpread = dist3d(tip, lm[INDEX_MCP]) / palmWidth;

  // Curl along CMC→MCP→TIP axis
  const v1x = mcp.x - cmc.x;
  const v1y = mcp.y - cmc.y;
  const v1z = (mcp.z ?? 0) - (cmc.z ?? 0);
  const len1 = Math.hypot(v1x, v1y, v1z) + 1e-8;
  const v2x = tip.x - mcp.x;
  const v2y = tip.y - mcp.y;
  const v2z = (tip.z ?? 0) - (mcp.z ?? 0);
  const len2 = Math.hypot(v2x, v2y, v2z) + 1e-8;
  const dot = (v1x * v2x + v1y * v2y + v1z * v2z) / (len1 * len2);
  const bendCurl = (1 - dot) / 2;

  // Thumb is "extended" when it's spread out (high thumbSpread) AND not bent
  // Blend: low spread = curled toward palm (curl ~ 1), high spread = extended (curl ~ 0)
  return Math.min(1, (bendCurl * 0.4 + Math.max(0, 0.8 - thumbSpread) * 0.6));
}

/** Update a finger's extended state with hysteresis */
function updateFingerState(
  existing: FingerState,
  curl: number
): FingerState {
  let extended = existing.extended;
  if (curl < CURL_CLOSED) extended = true;
  else if (curl > CURL_OPEN) extended = false;
  return { curl, extended, hysteresis: existing.hysteresis };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── Main Class ───────────────────────────────────────────────────────────────

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
  private zoomBaseline: number | null = null;
  private zoomSustain = 0;
  private zoomLatch = 0;
  private lastStatus: TrackerStatus = { hands: 0, mode: "idle", confidence: 0, depthFactor: 0 };
  private lastActionTime = 0;

  // Kinetic inertia
  private vx = 0;
  private vy = 0;

  // Depth tracking (3D awareness)
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
      video: {
        width: 640,
        height: 480,
        facingMode: "user",
        frameRate: { ideal: 60, min: 30 },
      },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();

    const fileset = await FilesetResolver.forVisionTasks(WASM_CDN);
    const options = {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" as const },
      runningMode: "VIDEO" as const,
      numHands: 2,
      minHandDetectionConfidence: 0.50,
      minHandPresenceConfidence: 0.50,
      minTrackingConfidence: 0.50,
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
    this.zoomBaseline = null;
    this.zoomSustain = 0;
    this.zoomLatch = 0;
    this.vx = 0;
    this.vy = 0;
    this.depthSmoothed = 0;
    const ctx = this.overlay.getContext("2d");
    ctx?.clearRect(0, 0, this.overlay.width, this.overlay.height);
    this.emitStatus({ hands: 0, mode: "idle", confidence: 0, depthFactor: 0 });
  }

  // ── Main Loop ──────────────────────────────────────────────────────────────

  private loop = () => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    if (!this.landmarker || this.video.readyState < 2) return;
    if (this.video.currentTime === this.lastVideoTime) {
      this.applyInertia();
      return;
    }
    this.lastVideoTime = this.video.currentTime;

    const result = this.landmarker.detectForVideo(this.video, performance.now());
    this.processHands(
      result.landmarks,
      result.handedness.map((h) => h[0]?.categoryName ?? "?")
    );
    this.drawOverlay(result.landmarks);
    this.applyInertia();
  };

  // ── Inertia ────────────────────────────────────────────────────────────────

  private applyInertia(): void {
    const decay =
      this.prevMode === "open_palm" ? BRAKE_DECAY : INERTIA_DECAY;
    this.vx *= decay;
    this.vy *= decay;
    if (Math.hypot(this.vx, this.vy) > 1e-5) {
      this.callbacks.onRotate(this.vx, this.vy);
    } else {
      this.vx = 0;
      this.vy = 0;
    }
  }

  // ── Per-Frame Processing ───────────────────────────────────────────────────

  private processHands(
    landmarks: NormalizedLandmark[][],
    labels: string[]
  ): void {
    const pinchedGrabs: Point[] = [];
    const openPalms: { xDelta: number }[] = [];
    const seen = new Set<string>();
    const detectedModes: GestureMode[] = [];

    // 3D depth: average wrist Z across all hands (more negative = closer to camera)
    let depthSum = 0;
    let depthCount = 0;

    landmarks.forEach((lm, i) => {
      const label = labels[i] || `hand_${i}`;
      seen.add(label);

      // Palm scale: width between INDEX_MCP and PINKY_MCP
      const palmWidth = dist3d(lm[INDEX_MCP], lm[PINKY_MCP]);
      if (palmWidth < 1e-6) return;

      // ── DEPTH FACTOR ──────────────────────────────────────────────────────
      // MediaPipe z is in the same scale as x/y, negative = toward camera
      // Wrist z typically ranges: ~-0.1 (close) to ~0.1 (far)
      // We invert and normalize so 1 = very close, 0 = far
      const wristZ = lm[WRIST].z ?? 0;
      depthSum += Math.max(0, Math.min(1, (-wristZ + 0.05) / 0.15));
      depthCount++;

      // ── CURL DETECTION (angle-based) ──────────────────────────────────────
      let state = this.handStates.get(label);
      if (!state) {
        state = {
          mode: "idle",
          grab: { x: 0.5, y: 0.5 },
          wristX: 1 - lm[WRIST].x,
          pinchLatch: 0,
          pinchLatched: false,
          fingers: [
            { curl: 0, extended: true, hysteresis: false }, // thumb
            { curl: 0, extended: true, hysteresis: false }, // index
            { curl: 0, extended: true, hysteresis: false }, // middle
            { curl: 0, extended: true, hysteresis: false }, // ring
            { curl: 0, extended: true, hysteresis: false }, // pinky
          ],
        };
        this.handStates.set(label, state);
      }

      // Compute angle-based curl for all 5 fingers
      const thumbCurl = computeThumbCurl(lm);
      const indexCurl = computeCurl(lm, INDEX_MCP, INDEX_PIP, INDEX_TIP);
      const middleCurl = computeCurl(lm, MIDDLE_MCP, MIDDLE_PIP, MIDDLE_TIP);
      const ringCurl = computeCurl(lm, RING_MCP, RING_PIP, RING_TIP);
      const pinkyCurl = computeCurl(lm, PINKY_MCP, PINKY_PIP, PINKY_TIP);

      state.fingers[0] = updateFingerState(state.fingers[0], thumbCurl);
      state.fingers[1] = updateFingerState(state.fingers[1], indexCurl);
      state.fingers[2] = updateFingerState(state.fingers[2], middleCurl);
      state.fingers[3] = updateFingerState(state.fingers[3], ringCurl);
      state.fingers[4] = updateFingerState(state.fingers[4], pinkyCurl);

      const [thumbF, indexF, middleF, ringF, pinkyF] = state.fingers;
      const extendedCount =
        (thumbF.extended ? 1 : 0) +
        (indexF.extended ? 1 : 0) +
        (middleF.extended ? 1 : 0) +
        (ringF.extended ? 1 : 0) +
        (pinkyF.extended ? 1 : 0);

      // ── PINCH (index tip to thumb tip, normalized to palm width) ──────────
      const pinchDist = dist3d(lm[THUMB_TIP], lm[INDEX_TIP]) / palmWidth;
      const tipVisible =
        (lm[THUMB_TIP].visibility ?? 1) > 0.30 &&
        (lm[INDEX_TIP].visibility ?? 1) > 0.30;

      let effectivePinched = false;
      if (tipVisible) {
        if (pinchDist < PINCH_ON) {
          effectivePinched = true;
          state.pinchLatch = PINCH_LATCH;
          state.pinchLatched = true;
        } else if (pinchDist < PINCH_OFF && state.pinchLatched) {
          effectivePinched = true; // hysteresis zone
        } else {
          if (state.pinchLatch > 0) {
            state.pinchLatch--;
            effectivePinched = state.pinchLatch > 0;
          } else {
            state.pinchLatched = false;
          }
        }
      } else if (state.pinchLatch > 0) {
        state.pinchLatch--;
        effectivePinched = true; // coast on latch
      } else {
        state.pinchLatched = false;
      }

      // ── CLASSIFY HAND MODE ────────────────────────────────────────────────
      let handMode: GestureMode = "idle";

      if (effectivePinched) {
        handMode = "spin";
      } else if (extendedCount === 0 || (extendedCount <= 1 && !indexF.extended)) {
        // All fingers closed = fist (also allows spin with fist)
        handMode = "fist";
      } else if (extendedCount >= 4) {
        handMode = "open_palm";
      } else if (indexF.extended && !middleF.extended && !ringF.extended && !pinkyF.extended) {
        handMode = "point";
      } else if (indexF.extended && middleF.extended && !ringF.extended && !pinkyF.extended) {
        handMode = "victory";
      } else if (thumbF.extended && !indexF.extended && !middleF.extended && !ringF.extended && !pinkyF.extended) {
        // Thumb up/down — use wrist-relative Y position
        const thumbTip = lm[THUMB_TIP];
        const wrist = lm[WRIST];
        if (thumbTip.y < wrist.y - 0.10) handMode = "thumbs_up";
        else if (thumbTip.y > wrist.y + 0.10) handMode = "thumbs_down";
      }

      state.mode = handMode;
      detectedModes.push(handMode);

      // ── SMOOTHED GRAB POINT ───────────────────────────────────────────────
      const raw: Point =
        handMode === "fist"
          ? { x: 1 - lm[WRIST].x, y: lm[WRIST].y }
          : {
              x: 1 - (lm[THUMB_TIP].x + lm[INDEX_TIP].x) / 2,
              y: (lm[THUMB_TIP].y + lm[INDEX_TIP].y) / 2,
            };

      const speed = Math.hypot(raw.x - state.grab.x, raw.y - state.grab.y);
      const alpha = Math.min(SMOOTHING_MAX, Math.max(SMOOTHING_BASE, speed * 24));
      const prevWristX = state.wristX;
      state.wristX = 1 - lm[WRIST].x;
      state.grab = {
        x: state.grab.x + (raw.x - state.grab.x) * alpha,
        y: state.grab.y + (raw.y - state.grab.y) * alpha,
      };

      if (handMode === "spin" || handMode === "fist") {
        pinchedGrabs.push(state.grab);
      } else if (handMode === "open_palm") {
        openPalms.push({ xDelta: state.wristX - prevWristX });
      }
    });

    // Expire removed hands
    for (const key of this.handStates.keys()) {
      if (!seen.has(key)) {
        const s = this.handStates.get(key)!;
        if (s.pinchLatch > 0) s.pinchLatch--;
        else this.handStates.delete(key);
      }
    }

    // ── DEPTH FACTOR ─────────────────────────────────────────────────────────
    const rawDepth = depthCount > 0 ? depthSum / depthCount : 0;
    this.depthSmoothed = lerp(this.depthSmoothed, rawDepth, 0.12);
    this.callbacks.onDepth?.(this.depthSmoothed);

    // ── GLOBAL MODE RESOLUTION ────────────────────────────────────────────────
    let targetMode: GestureMode;
    const activePinch = pinchedGrabs.length;

    if (activePinch >= 2) {
      if (this.zoomBaseline === null) {
        this.zoomBaseline = Math.hypot(
          pinchedGrabs[0].x - pinchedGrabs[1].x,
          pinchedGrabs[0].y - pinchedGrabs[1].y
        );
        this.zoomSustain = 0;
        this.zoomLatch = ZOOM_LATCH;
        targetMode = "spin";
      } else {
        const cur = Math.hypot(
          pinchedGrabs[0].x - pinchedGrabs[1].x,
          pinchedGrabs[0].y - pinchedGrabs[1].y
        );
        const delta = Math.abs(cur - this.zoomBaseline) / (this.zoomBaseline + 1e-6);
        if (delta > ZOOM_DELTA) {
          this.zoomSustain++;
          // Slowly drift baseline to track sustained movement
          this.zoomBaseline = this.zoomBaseline * 0.88 + cur * 0.12;
        }
        this.zoomLatch = ZOOM_LATCH;
        targetMode = this.zoomSustain >= ZOOM_SUSTAIN ? "zoom" : "spin";
      }
    } else {
      if (this.zoomLatch > 0) this.zoomLatch--;
      else {
        this.zoomBaseline = null;
        this.zoomSustain = 0;
      }

      if (activePinch === 1) {
        const pinchingMode = Array.from(this.handStates.values()).find(
          (s) => s.mode === "spin" || s.mode === "fist"
        )?.mode;
        targetMode = pinchingMode === "fist" ? "fist" : "spin";
      } else {
        targetMode = detectedModes[0] ?? "idle";
      }
    }

    // ── SWIPE DETECTION ───────────────────────────────────────────────────────
    if (targetMode === "open_palm" || targetMode === "idle") {
      const swipe = openPalms.find((p) => Math.abs(p.xDelta) > 0.018);
      if (swipe) {
        targetMode = "swipe";
        this.callbacks.onRotate(swipe.xDelta * ROTATE_SPEED * 1.6, 0);
      }
    }

    // ── DEBOUNCED STATE TRANSITION ────────────────────────────────────────────
    if (targetMode !== this.candidateMode) {
      this.candidateMode = targetMode;
      this.candidateFrames = 1;
    } else {
      this.candidateFrames++;
    }

    const immediate =
      targetMode === "spin" ||
      targetMode === "fist" ||
      targetMode === "zoom" ||
      targetMode === "swipe";

    let mode = this.prevMode;
    if (immediate || this.candidateFrames >= DEBOUNCE_FRAMES) {
      mode = targetMode;
    }

    // ── ONE-SHOT ACTIONS ──────────────────────────────────────────────────────
    if (mode !== this.prevMode && mode !== "swipe") {
      this.prevSpinGrab = null;
      this.prevZoomDist = null;

      const now = performance.now();
      if (now - this.lastActionTime > ACTION_COOLDOWN) {
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
    this.prevMode = mode;

    // ── ROTATION APPLICATION ──────────────────────────────────────────────────
    if (mode === "spin" || mode === "fist") {
      const grab = pinchedGrabs[0];
      if (this.prevSpinGrab && grab) {
        const dx = grab.x - this.prevSpinGrab.x;
        const dy = grab.y - this.prevSpinGrab.y;
        if (Math.hypot(dx, dy) > DEADZONE) {
          const scale = mode === "fist" ? 1.20 : 1.0;
          const rx = dx * ROTATE_SPEED * scale;
          const ry = dy * ROTATE_SPEED * scale;
          this.callbacks.onRotate(rx, ry);
          this.vx = 0.70 * this.vx + 0.30 * rx;
          this.vy = 0.70 * this.vy + 0.30 * ry;
        }
      }
      this.prevSpinGrab = grab ?? null;
    } else if (mode === "zoom") {
      if (pinchedGrabs[0] && pinchedGrabs[1]) {
        const d = Math.hypot(
          pinchedGrabs[0].x - pinchedGrabs[1].x,
          pinchedGrabs[0].y - pinchedGrabs[1].y
        );
        if (this.prevZoomDist && d > 1e-4) {
          const factor = Math.min(1.15, Math.max(0.88, this.prevZoomDist / d));
          this.callbacks.onZoom(factor);
        }
        this.prevZoomDist = d;
      }
    }

    const conf = landmarks.length > 0 ? Math.min(99, 70 + landmarks[0].length * 1.4) : 0;
    this.emitStatus({
      hands: landmarks.length,
      mode,
      confidence: Math.floor(conf),
      depthFactor: Math.round(this.depthSmoothed * 100) / 100,
    });
  }

  // ── Status Emit ────────────────────────────────────────────────────────────

  private emitStatus(status: TrackerStatus): void {
    if (
      status.hands !== this.lastStatus.hands ||
      status.mode !== this.lastStatus.mode ||
      Math.abs((status.confidence ?? 0) - (this.lastStatus.confidence ?? 0)) > 5 ||
      Math.abs((status.depthFactor ?? 0) - (this.lastStatus.depthFactor ?? 0)) > 0.05
    ) {
      this.lastStatus = status;
      this.callbacks.onStatus(status);
    }
  }

  // ── Overlay Drawing ────────────────────────────────────────────────────────

  private drawOverlay(landmarks: NormalizedLandmark[][]): void {
    const ctx = this.overlay.getContext("2d");
    if (!ctx) return;
    const { width, height } = this.overlay;
    ctx.clearRect(0, 0, width, height);
    if (!landmarks?.length) return;

    const connections: [number, number][] = [
      [WRIST, THUMB_CMC], [THUMB_CMC, THUMB_MCP], [THUMB_MCP, THUMB_IP], [THUMB_IP, THUMB_TIP],
      [WRIST, INDEX_MCP], [INDEX_MCP, INDEX_PIP], [INDEX_PIP, INDEX_DIP], [INDEX_DIP, INDEX_TIP],
      [WRIST, MIDDLE_MCP], [MIDDLE_MCP, MIDDLE_PIP], [MIDDLE_PIP, MIDDLE_DIP], [MIDDLE_DIP, MIDDLE_TIP],
      [WRIST, RING_MCP], [RING_MCP, RING_PIP], [RING_PIP, RING_DIP], [RING_DIP, RING_TIP],
      [WRIST, PINKY_MCP], [PINKY_MCP, PINKY_PIP], [PINKY_PIP, PINKY_DIP], [PINKY_DIP, PINKY_TIP],
      [INDEX_MCP, MIDDLE_MCP], [MIDDLE_MCP, RING_MCP], [RING_MCP, PINKY_MCP],
    ];

    const mode = this.lastStatus.mode;
    const lineColor =
      mode === "zoom" ? "#ff6600"
      : mode === "fist" ? "#ffaa30"
      : mode === "spin" ? "#00ff66"
      : "#00f0ff";

    landmarks.forEach((lm, handIdx) => {
      const handState = Array.from(this.handStates.values())[handIdx];

      // Draw skeleton
      ctx.save();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      connections.forEach(([p1, p2]) => {
        const a = lm[p1];
        const b = lm[p2];
        if (a && b) {
          ctx.moveTo((1 - a.x) * width, a.y * height);
          ctx.lineTo((1 - b.x) * width, b.y * height);
        }
      });
      ctx.stroke();
      ctx.restore();

      // Draw joints — color-coded by curl state
      lm.forEach((pt, idx) => {
        const x = (1 - pt.x) * width;
        const y = pt.y * height;
        const isTip = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP].includes(idx);
        const isMCP = [THUMB_MCP, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP].includes(idx);

        // Get curl color from finger state
        let fillColor = isTip ? "#ffffff" : isMCP ? "#00f0ff" : "rgba(0,240,255,0.5)";
        if (handState && isTip) {
          const fingerIdx = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP].indexOf(idx);
          if (fingerIdx >= 0) {
            const curl = handState.fingers[fingerIdx]?.curl ?? 0;
            // Red = curled, green = extended
            const r = Math.round(curl * 255);
            const g = Math.round((1 - curl) * 200);
            fillColor = `rgb(${r},${g},60)`;
          }
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, isTip ? 5.5 : isMCP ? 3.5 : 2, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.shadowColor = fillColor;
        ctx.shadowBlur = isTip ? 14 : 5;
        ctx.fill();
        ctx.restore();
      });

      // Pinch crosshair
      if (mode === "spin" || mode === "fist" || mode === "zoom") {
        const thumb = lm[THUMB_TIP];
        const index = lm[INDEX_TIP];
        if (thumb && index) {
          const mx = (1 - (thumb.x + index.x) / 2) * width;
          const my = ((thumb.y + index.y) / 2) * height;
          const t = performance.now() * 0.003;

          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(t);
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = 1.5;
          ctx.shadowColor = lineColor;
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
      }
    });

    // HUD status bar
    const modeLabel = mode.toUpperCase().replace("_", " ");
    const depth = Math.round((this.lastStatus.depthFactor ?? 0) * 100);
    ctx.save();
    ctx.fillStyle = "rgba(8, 8, 14, 0.85)";
    const hudW = 210;
    ctx.fillRect(5, 5, hudW, 28);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(5, 5, hudW, 28);
    ctx.fillStyle = lineColor;
    ctx.font = "bold 10px 'JetBrains Mono', monospace";
    ctx.fillText(`${modeLabel}  ⊕ DEPTH ${depth}%`, 10, 22);

    // Momentum bar
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 0.005) {
      ctx.fillStyle = "#ffaa30";
      ctx.fillRect(150, 14, Math.min(60, speed * 200), 6);
    }
    ctx.restore();
  }
}
