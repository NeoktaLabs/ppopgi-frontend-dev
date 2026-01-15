import { useState } from "react";
import { Modal } from "./ui/Modal";

export default function App() {
  const [cashierOpen, setCashierOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: 16 }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0" }}>
        <div style={{ fontWeight: 1000, letterSpacing: 0.2 }}>Ppopgi</div>

        <div style={{ display: "flex", gap: 12, marginLeft: 10 }}>
          <button style={linkBtn()}>Explore</button>
          <button style={linkBtn()} onClick={() => setCreateOpen(true)}>
            Create
          </button>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button style={pillBtn()} onClick={() => setCashierOpen(true)}>
            Cashier
          </button>
          <button style={pillBtn()}>Sign in</button>
        </div>
      </div>

      {/* Home sections (placeholder for now) */}
      <div style={{ display: "grid", gap: 18, marginTop: 12 }}>
        <section style={panel()}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Big prizes right now</div>
          <div style={{ opacity: 0.85, marginTop: 4 }}>
            The biggest rewards you can win today.
          </div>
          <div style={{ marginTop: 12, opacity: 0.8 }}>
            (Next step: load these from the subgraph.)
          </div>
        </section>

        <section style={panel()}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Ending soon</div>
          <div style={{ opacity: 0.85, marginTop: 4 }}>Last chance to join.</div>
          <div style={{ marginTop: 12, opacity: 0.8 }}>
            (Next step: load these from the subgraph.)
          </div>
        </section>
      </div>

      {/* Cashier modal */}
      <Modal open={cashierOpen} onClose={() => setCashierOpen(false)} title="Cashier">
        <div style={{ lineHeight: 1.6 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>What you need</div>
          <ul>
            <li>Energy coins (XTZ) for energy costs and the draw step.</li>
            <li>Coins (USDC) to buy tickets.</li>
          </ul>
          <div style={{ opacity: 0.85, marginTop: 10 }}>
            We’ll add friendly “how to bring coins in” links soon.
          </div>
        </div>
      </Modal>

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create">
        <div style={{ lineHeight: 1.6 }}>
          Create will be wired after we add the factory contract.
        </div>
      </Modal>
    </div>
  );
}

function linkBtn(): React.CSSProperties {
  return {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontWeight: 800,
    padding: "8px 10px",
    borderRadius: 12,
  };
}

function pillBtn(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.4)",
    background: "rgba(255,255,255,0.20)",
    cursor: "pointer",
    fontWeight: 900,
    padding: "8px 12px",
    borderRadius: 999,
  };
}

function panel(): React.CSSProperties {
  return {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.18)",
    backdropFilter: "blur(14px)",
    padding: 14,
  };
}