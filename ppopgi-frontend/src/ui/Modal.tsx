import React, { useEffect } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  fullscreen,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  fullscreen?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        justifyContent: "center",
        alignItems: fullscreen ? "stretch" : "center",
        padding: fullscreen ? 0 : 16,
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          width: fullscreen ? "100%" : "min(920px, 100%)",
          height: fullscreen ? "100%" : "auto",
          maxHeight: fullscreen ? "100%" : "min(86vh, 860px)",
          overflow: "auto",
          borderRadius: fullscreen ? 0 : 18,
          border: "1px solid rgba(255,255,255,0.35)",
          background: "rgba(255,255,255,0.22)",
          backdropFilter: "blur(14px)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.25)",
          }}
        >
          <div style={{ fontWeight: 900 }}>{title ?? ""}</div>
          <button
            onClick={onClose}
            style={{
              border: "1px solid rgba(255,255,255,0.4)",
              background: "rgba(255,255,255,0.25)",
              borderRadius: 999,
              padding: "6px 10px",
              cursor: "pointer",
              fontWeight: 900,
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}