"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createOrbScene, type OrbSceneApi } from "@/lib/orbScene";
import { HandTracker, type TrackerStatus } from "@/lib/handTracker";
import ChatPanel from "./ChatPanel";
import OnboardingWizard from "./OnboardingWizard";

type CameraState = "off" | "starting" | "on" | "error";

const MODE_LABEL: Record<TrackerStatus["mode"], string> = {
  idle: "STANDBY",
  spin: "SPIN",
  zoom: "ZOOM",
  swipe: "SWIPE",
};

export default function JarvisOrb() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<OrbSceneApi | null>(null);
  const trackerRef = useRef<HandTracker | null>(null);

  const [camera, setCamera] = useState<CameraState>("off");
  const [status, setStatus] = useState<TrackerStatus>({ hands: 0, mode: "idle" });
  const [error, setError] = useState<string | null>(null);

  // New features UI state
  const [showWizard, setShowWizard] = useState(false);
  const [hideUI, setHideUI] = useState(false);
  const [showWebcamFeed, setShowWebcamFeed] = useState(false);

  useEffect(() => {
    const isOnboarded = localStorage.getItem("ultron_onboarded");
    if (!isOnboarded) setShowWizard(true);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const scene = createOrbScene(container);
    sceneRef.current = scene;
    return () => {
      trackerRef.current?.stop();
      trackerRef.current = null;
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  const stopGestures = useCallback(() => {
    trackerRef.current?.stop();
    trackerRef.current = null;
    setCamera("off");
    setStatus({ hands: 0, mode: "idle" });
  }, []);

  const startGestures = useCallback(async () => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay || trackerRef.current) return;

    setCamera("starting");
    setError(null);

    const tracker = new HandTracker(video, overlay, {
      onRotate: (dt, dp) => sceneRef.current?.rotateBy(dt, dp),
      onZoom: (factor) => sceneRef.current?.zoomBy(factor),
      onStatus: setStatus,
    });
    trackerRef.current = tracker;

    try {
      await tracker.start();
      setCamera("on");
    } catch (err) {
      trackerRef.current = null;
      tracker.stop();
      setCamera("error");
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "CAMERA ACCESS DENIED"
          : "TRACKING INIT FAILED",
      );
    }
  }, []);

  const toggleGestures = useCallback(() => {
    if (trackerRef.current) stopGestures();
    else void startGestures();
  }, [startGestures, stopGestures]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === "u" || e.key === "U") {
        setHideUI((prev) => !prev);
        return;
      }
      switch (e.key) {
        case "+":
        case "=":
          sceneRef.current?.zoomIn();
          break;
        case "-":
        case "_":
          sceneRef.current?.zoomOut();
          break;
        case "r":
        case "R":
          sceneRef.current?.resetView();
          break;
        case "g":
        case "G":
          toggleGestures();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleGestures]);

  const cameraOn = camera === "on";

  return (
    <>
      <div ref={containerRef} className="orb-root" />

      <div className="overlay-vignette" />
      <div className="overlay-grain" />
      <div className="overlay-scanlines" />

      {/* Floating Hide UI / Show UI toggle */}
      <button
        type="button"
        className="hide-ui-btn"
        onClick={() => setHideUI((prev) => !prev)}
        title="Toggle HUD Visibility (Press 'U')"
      >
        {hideUI ? "👁️ SHOW UI" : "🙈 HIDE UI"}
      </button>

      {/* Onboarding Wizard Overlay */}
      <OnboardingWizard isOpen={showWizard} onClose={() => setShowWizard(false)} />

      {/* When hideUI is false, render all text HUD and chat panels */}
      {!hideUI && (
        <>
          <div className="hud hud-title">U.L.T.R.O.N.</div>

          <div className="hud hud-hint">
            <div>
              <span className="key">DRAG</span> spin&nbsp;&nbsp;
              <span className="key">SCROLL</span> zoom
            </div>
            {cameraOn ? (
              <div>
                <span className="key">PINCH / SWIPE</span> spin&nbsp;&nbsp;
                <span className="key">PINCH BOTH HANDS ± SPREAD</span> zoom
              </div>
            ) : (
              <div>
                <span className="key">G</span> hand gestures&nbsp;&nbsp;
                <span className="key">R</span> reset&nbsp;&nbsp;
                <span className="key">U</span> toggle UI
              </div>
            )}
          </div>

          <div className="hud hud-controls">
            <div className={`camera-panel${cameraOn ? " visible" : ""}`}>
              {/* Webcam preview is collapsible via showWebcamFeed toggle! */}
              <video
                ref={videoRef}
                muted
                playsInline
                className="camera-video"
                style={{ display: showWebcamFeed ? "block" : "none" }}
              />
              <canvas
                ref={overlayRef}
                width={208}
                height={156}
                className="camera-overlay"
                style={{ display: showWebcamFeed ? "block" : "none" }}
              />
              <div className="camera-status" style={{ borderTop: showWebcamFeed ? "1px solid rgba(255,170,48,0.4)" : "none" }}>
                {status.hands > 0
                  ? `👋 ${status.hands} HAND${status.hands > 1 ? "S" : ""} · ${MODE_LABEL[status.mode]}`
                  : "✋ SENSOR ACTIVE"}
              </div>
            </div>

            {error && <div className="hud-error">{error}</div>}

            <div className="hud-row">
              <button
                type="button"
                className="hud-btn"
                aria-pressed={cameraOn}
                onClick={toggleGestures}
                disabled={camera === "starting"}
              >
                {camera === "starting" ? "INITIALIZING…" : cameraOn ? "🟢 GESTURES ON" : "⚪ GESTURES OFF"}
              </button>
              {cameraOn && (
                <button
                  type="button"
                  className="hud-btn"
                  onClick={() => setShowWebcamFeed((prev) => !prev)}
                >
                  {showWebcamFeed ? "🙈 HIDE FEED" : "👁️ VIEW FEED"}
                </button>
              )}
            </div>
            <div className="hud-row">
              <button type="button" className="hud-btn" onClick={() => sceneRef.current?.zoomIn()} aria-label="Zoom in">
                +
              </button>
              <button type="button" className="hud-btn" onClick={() => sceneRef.current?.zoomOut()} aria-label="Zoom out">
                −
              </button>
              <button type="button" className="hud-btn" onClick={() => sceneRef.current?.resetView()}>
                RESET
              </button>
            </div>
          </div>

          {/* Futuristic Chat & Cognitive Control Panel */}
          <ChatPanel
            sceneRef={sceneRef}
            cameraState={camera}
            onToggleGestures={toggleGestures}
            onOpenBenchmark={() => setShowWizard(true)}
          />
        </>
      )}
    </>
  );
}
