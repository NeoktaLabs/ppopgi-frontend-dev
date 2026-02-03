// src/components/DisclaimerGate.tsx

type Props = {
  open: boolean;
  onAccept: () => void;
};

export function DisclaimerGate({ open, onAccept }: Props) {
  if (!open) return null;

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 10000,
  };

  const card: React.CSSProperties = {
    width: "min(520px, 100%)",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.22)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
    padding: 18,
    color: "#2B2B33",
  };

  const h1: React.CSSProperties = { margin: 0, fontSize: 20 };

  const ul: React.CSSProperties = {
    margin: "12px 0 0",
    paddingLeft: 18,
    lineHeight: 1.5,
    fontSize: 14,
  };

  const btn: React.CSSProperties = {
    marginTop: 14,
    width: "100%",
    border: "1px solid rgba(255,255,255,0.45)",
    background: "rgba(255,255,255,0.24)",
    borderRadius: 14,
    padding: "12px 12px",
    cursor: "pointer",
    color: "#2B2B33",
    fontWeight: 700,
    fontSize: 14,
  };

  const small: React.CSSProperties = { marginTop: 10, fontSize: 13, opacity: 0.85 };

  return (
    <div style={overlay}>
      <div style={card} role="dialog" aria-modal="true" aria-label="Before you play">
        <h1 style={h1}>Before you play</h1>

        <ul style={ul}>
          <li>This is an experimental app.</li>
          <li>You’re responsible for your choices.</li>
          <li>Only play with money you can afford to lose.</li>
        </ul>

        <button style={btn} onClick={onAccept}>
          I understand — let’s go
        </button>

        <div style={small}>Nothing happens automatically. You always confirm actions yourself.</div>
      </div>
    </div>
  );
}