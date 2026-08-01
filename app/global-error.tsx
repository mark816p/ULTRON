"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global U.L.T.R.O.N. Error:", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body style={{ backgroundColor: "#030308", color: "#fff", margin: 0 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              background: "rgba(14, 14, 24, 0.9)",
              border: "1px solid rgba(255, 170, 48, 0.4)",
              borderRadius: "24px",
              padding: "40px 32px",
              maxWidth: "480px",
              width: "100%",
            }}
          >
            <h2 style={{ color: "#ffaa30", marginBottom: "12px" }}>U.L.T.R.O.N. v9.4.6.1 SYSTEM RECOVERY</h2>
            <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "20px" }}>
              An exception occurred during client initialization. Reconnect to restore full functionality.
            </p>
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
                cursor: "pointer",
              }}
            >
              RELOAD NEURAL INTERFACE
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
