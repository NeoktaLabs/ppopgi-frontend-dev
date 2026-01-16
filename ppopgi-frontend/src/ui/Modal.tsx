// src/ui/Modal.tsx
import React, { useEffect } from "react";
import { X } from "lucide-react";

type ModalWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "wide";
type ModalHeight = "auto" | "tall";
type ModalVariant = "glass" | "solid";

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
      return "max-h-[82vh]";
  }
}

function shellClass(variant: ModalVariant) {
  if (variant === "solid") {
    return [
      "bg-white",
      "border border-gray-200",
      "shadow-[0_18px_70px_rgba(0,0,0,0.25)]",
    ].join(" ");
  }
  // glass
  return [
    "bg-white/10",
    "border border-white/25",
    "backdrop-blur-xl",
    "shadow-[0_20px_80px_rgba(0,0,0,0.35)]",
  ].join(" ");
}

function headerBaseClass(variant: ModalVariant) {
  if (variant === "solid") {
    return "border-b border-gray-200 bg-gray-50/80";
  }
  return "border-b border-white/20 bg-white/10";
}

function closeBtnClass(variant: ModalVariant) {
  if (variant === "solid") {
    return "bg-white hover:bg-gray-100 border border-gray-200 text-gray-800";
  }
  return "bg-white/20 hover:bg-white/30 border border-white/20 text-white";
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "xl",
  height = "auto",
  variant = "glass",
  header,
  showClose = true,
  className = "",
  headerClassName = "",
  bodyClassName = "",
  backdropClassName = "",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: ModalWidth;
  height?: ModalHeight;
  variant?: ModalVariant;

  /** Provide a fully custom header. If set, `title` is ignored for the header. */
  header?: React.ReactNode;

  /** Hide/show X button (still closable with backdrop + ESC unless you disable those separately). */
  showClose?: boolean;

  /** Extra classes to tweak shell/header/body/backdrop per modal. */
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  backdropClassName?: string;
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

  const textColor = variant === "solid" ? "text-gray-900" : "text-white";

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <button
        type="button"
        className={[
          "absolute inset-0 bg-black/50 backdrop-blur-sm",
          "animate-fade-in",
          backdropClassName,
        ].join(" ")}
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Centered container */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={[
            "relative w-full",
            widthClass(width),
            heightClass(height),
            "overflow-hidden rounded-[28px]",
            shellClass(variant),
            "animate-fade-in-up",
            className,
          ].join(" ")}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          {header ? (
            <div className={["relative", headerClassName].join(" ")}>
              {header}
              {showClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className={[
                    "absolute top-4 right-4 w-10 h-10 rounded-2xl",
                    "flex items-center justify-center transition",
                    closeBtnClass(variant),
                  ].join(" ")}
                  aria-label="Close"
                  title="Close"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          ) : (
            <div
              className={[
                "relative flex items-center justify-between px-5 py-4",
                headerBaseClass(variant),
                headerClassName,
              ].join(" ")}
            >
              <div className={["font-black text-lg tracking-tight", textColor].join(" ")}>
                {title ?? ""}
              </div>

              {showClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className={[
                    "w-10 h-10 rounded-2xl flex items-center justify-center transition",
                    closeBtnClass(variant),
                  ].join(" ")}
                  aria-label="Close"
                  title="Close"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          )}

          {/* Body (scrolls) */}
          <div
            className={[
              "p-5 overflow-y-auto",
              "max-h-[calc(82vh-72px)]",
              bodyClassName,
            ].join(" ")}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}