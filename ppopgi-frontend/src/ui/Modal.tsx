// src/ui/Modal.tsx
import React, { useEffect, useMemo } from "react";
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

function maxHValue(h: ModalHeight) {
  return h === "tall" ? "88vh" : "80vh";
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  width = "xl",
  height = "auto",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
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

  const maxH = useMemo(() => maxHValue(height), [height]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
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

            // The modal should never take full screen height.
            `max-h-[${maxH}]`,

            "overflow-hidden",
            "rounded-[32px]",

            // Soft glass shell like your screenshots
            "border border-white/25",
            "bg-white/10",
            "backdrop-blur-xl",
            "shadow-[0_24px_90px_rgba(0,0,0,0.45)]",
          ].join(" ")}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-white/15 bg-white/10">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {icon ? (
                  <div className="shrink-0 w-11 h-11 rounded-2xl bg-white/15 border border-white/15 flex items-center justify-center text-white">
                    {icon}
                  </div>
                ) : null}

                <div className="min-w-0">
                  <div className="font-black text-white text-xl tracking-tight truncate">
                    {title}
                  </div>
                  {subtitle ? (
                    <div className="mt-1 text-[12px] font-bold text-white/70 leading-snug">
                      {subtitle}
                    </div>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="shrink-0 w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 border border-white/15 flex items-center justify-center text-white transition"
                aria-label="Close"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Body (scrolls inside) */}
          <div
            className="p-6 overflow-y-auto"
            style={{
              // header is ~84px-96px depending on subtitle; this keeps it safe.
              maxHeight: `calc(${maxH} - 96px)`,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}