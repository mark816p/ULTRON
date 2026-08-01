"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("U.L.T.R.O.N. UI Error caught by boundary:", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "#030308",
        color: "#f3f4f8",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          background: "rgba(14, 14, 24, 0.8)",
          border: "1px solid rgba(255, 170, 48, 0.4)",
          borderRadius: "24px",
          padding: "40px 32px",
          maxWidth: "480px",
          width: "100%",
          boxShadow: "0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(255, 170, 48, 0.15)",
        }}
      >
        <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚡</div>
        <h2
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: "24px",
            fontWeight: 800,
            marginBottom: "12px",
            color: "#ffaa30",
          }}
        >
          NEURAL LINK RECOVERY
        </h2>
        <p style={{ color: "#8b92a5", fontSize: "14px", marginBottom: "24px", lineHeight: "1.6" }}>
          U.L.T.R.O.N. v9.4.5 encountered a transient component state anomaly. Click below to self-heal and reconnect the interface.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "linear-gradient(135deg, #ffaa30, #ff5500)",
              color: "#fff",
              border: "none",
              padding: "12px 24px",
              borderRadius: "999px",
              fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "12px",
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(255, 170, 48, 0.4)",
            }}
          >
            ⚡ RECONNECT NEURAL LINK
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.clear();
                window.location.reload();
              } catch (e) {
                window.location.reload();
              }
            }}
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              color: "#fff",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              padding: "12px 20px",
              borderRadius: "999px",
              fontWeight: 600,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            🔄 RESET CACHE
          </button>
        </div>
      </div>
    </div>
  );
}
