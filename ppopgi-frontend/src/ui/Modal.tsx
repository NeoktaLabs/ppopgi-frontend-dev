// src/ui/Modal.tsx
import React, { useEffect } from "react";
import { X } from "lucide-react";

type ModalWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "wide";
type ModalHeight = "auto" | "tall";

function widthClass(w: ModalWidth) {
  switch (w) {
    case "sm":
      return "max-w-sm";
    case "md":
      return "max-w-md";
    case "lg":
      return "max-w-lg";
    case "xl":
      return "max-w-xl";
    case "2xl":
      return "max-w-2xl";
    case "wide":
      return "max-w-4xl";
    default:
      return "max-w-xl";
  }
}

function heightClass(h: ModalHeight) {
  switch (h) {
    case "tall":
      return "max-h-[88vh]";
    case "auto":
    default:
      return "max-h-[80vh]";
  }
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "xl",
  height = "auto",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: ModalWidth;
  height?: ModalHeight;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Centered container */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={[
            "w-full",
            widthClass(width),
            heightClass(height),
            "overflow-hidden",
            "rounded-[28px]",
            "border border-white/25",
            "bg-white/10",
            "backdrop-blur-xl",
            "shadow-[0_20px_80px_rgba(0,0,0,0.45)]",
          ].join(" ")}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/15 bg-white/10">
            <div className="font-black text-white text-lg tracking-tight">{title}</div>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white"
              aria-label="Close"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto max-h-[calc(80vh-72px)]">{children}</div>
        </div>
      </div>
    </div>
  );
}