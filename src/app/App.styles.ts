import type { CSSProperties } from "react";

export function createAppStyles(chosenBg: string) {
  // ✅ Use a fixed background layer instead of backgroundAttachment: fixed (reduces desktop flicker)
  const pageWrap: CSSProperties = {
    minHeight: "100vh",
    position: "relative",
    overflowX: "hidden",
  };

  const bgLayer: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    backgroundImage: `url(${chosenBg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    transform: "translateZ(0)",
    willChange: "transform",
  };

  const overlay: CSSProperties = {
    position: "relative",
    zIndex: 1,
    minHeight: "100vh",
    background:
      "radial-gradient(900px 520px at 15% 10%, rgba(246,182,200,0.14), transparent 60%)," +
      "radial-gradient(900px 520px at 85% 5%, rgba(169,212,255,0.12), transparent 60%)," +
      "rgba(255,255,255,0.02)",
  };

  const container: CSSProperties = {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "18px 16px",
  };

  const sectionCard: CSSProperties = {
    marginTop: 18,
    padding: 16,
    borderRadius: 24,
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))," +
      "radial-gradient(900px 240px at 10% 0%, rgba(255,141,187,0.10), rgba(255,141,187,0) 55%)," +
      "radial-gradient(900px 240px at 90% 0%, rgba(203,183,246,0.10), rgba(203,183,246,0) 55%)",
    // 🔧 blur reduced a bit to be easier on desktop compositing
    backdropFilter: "blur(2px)",
    border: "2px solid rgba(255,255,255,0.55)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.16)",
  };

  const sectionInnerStroke: CSSProperties = {
    position: "absolute",
    inset: 6,
    borderRadius: 20,
    pointerEvents: "none",
    border: "1px solid rgba(242,166,198,0.55)",
  };

  const sectionAccent: CSSProperties = {
    position: "absolute",
    top: 12,
    bottom: 12,
    left: 12,
    width: 6,
    borderRadius: 999,
    background: "linear-gradient(180deg, #FF8DBB, #CBB7F6, #FFD89A)",
    boxShadow: "0 10px 18px rgba(0,0,0,0.12)",
  };

  const sectionTitleRow: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    paddingLeft: 18,
  };

  const sectionTitlePill: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 999,
    fontWeight: 1000 as any,
    fontSize: 16,
    letterSpacing: 0.25,
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(0,0,0,0.10)",
    color: "#4A0F2B",
    boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
  };

  const sectionTitleNotch: CSSProperties = {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "linear-gradient(135deg, rgba(255,141,187,0.95), rgba(203,183,246,0.95))",
    boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
  };

  const row5: CSSProperties = {
    marginTop: 12,
    paddingLeft: 18,
    display: "flex",
    gap: 12,
    overflowX: "auto",
    paddingBottom: 8,
    scrollSnapType: "x mandatory",
  };

  const row5Item: CSSProperties = {
    scrollSnapAlign: "start",
    flex: "0 0 auto",
  };
  return {
    pageWrap, bgLayer, overlay, container, sectionCard, sectionInnerStroke, sectionAccent, sectionTitleRow, sectionTitlePill, sectionTitleNotch, row5, row5Item,
  };
}
