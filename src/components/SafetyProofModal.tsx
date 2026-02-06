// src/components/SafetyProofModal.tsx
import type { RaffleDetails } from "../hooks/useRaffleDetails";
import { useSafetyBreakdown } from "../hooks/useSafetyBreakdown";
import "./SafetyProofModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
  raffle: RaffleDetails;
};

// Helper: Clickable Link
const ExplorerLink = ({ addr, label }: { addr?: string; label: string }) => {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return <span className="sp-mono">—</span>;
  const a = String(addr).toLowerCase();
  return (
    <a
      href={`https://explorer.etherlink.com/address/${a}`}
      target="_blank"
      rel="noreferrer"
      className="sp-link"
      title={a}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {label} ↗
    </a>
  );
};

const short = (s?: string) => (s ? `${s.slice(0, 6)}...${s.slice(-4)}` : "—");

// Some chains call it “entropy”, “vrf”, “randomness provider”…
// We do soft-fallbacks so this modal works even if fields differ by version.
function pickAddr(obj: any, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (v && typeof v === "string") return v;
  }
  return undefined;
}

function pickStr(obj: any, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).length > 0) return String(v);
  }
  return undefined;
}

export function SafetyProofModal({ open, onClose, raffle }: Props) {
  // keeping hook call (even if we don’t show money) in case you later reuse it
  useSafetyBreakdown(raffle);

  if (!open) return null;

  const anyRaffle: any = raffle as any;

  const raffleAddress = pickAddr(anyRaffle, ["address", "raffle", "raffleAddress", "contract", "id"]);
  const creator = pickAddr(anyRaffle, ["creator", "owner"]);
  const entropyProvider = pickAddr(anyRaffle, ["entropyProvider", "vrfProvider", "randomnessProvider", "provider"]);
  const entropyAddress = pickAddr(anyRaffle, ["entropyAddress", "vrfCoordinator", "coordinator", "entropy"]);
  const requestId = pickStr(anyRaffle, ["requestId", "vrfRequestId", "entropyRequestId", "lastRequestId"]);
  const status = String(anyRaffle?.status || "").replaceAll("_", " ").trim();

  const isDrawingLike =
    String(anyRaffle?.status || "").toUpperCase().includes("DRAW") ||
    String(anyRaffle?.status || "").toUpperCase().includes("FINAL");

  return (
    <div className="sp-overlay" onMouseDown={onClose}>
      <div className="sp-card" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sp-header">
          <div className="sp-header-left">
            <div className="sp-shield-icon">🛡️</div>
            <div>
              <h3 className="sp-title">Randomness Proof</h3>
              <div className="sp-subtitle">Transparent • Verifiable • On-Chain</div>
            </div>
          </div>
          <button className="sp-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="sp-body">
          {/* 1) Quick facts */}
          <div className="sp-section-grid">
            <div className="sp-data-box">
              <div className="sp-lbl">Contract status</div>
              <div className={`sp-status-pill ${String(anyRaffle?.status || "").toLowerCase()}`}>
                {status || "—"}
              </div>
            </div>

            <div className="sp-data-box">
              <div className="sp-lbl">Raffle contract</div>
              <ExplorerLink addr={raffleAddress} label={short(raffleAddress)} />
            </div>

            <div className="sp-data-box">
              <div className="sp-lbl">Created by</div>
              <ExplorerLink addr={creator} label={short(creator)} />
            </div>

            <div className="sp-data-box">
              <div className="sp-lbl">Randomness provider</div>
              <ExplorerLink addr={entropyProvider} label={short(entropyProvider) || "—"} />
            </div>
          </div>

          {/* 2) Big explanation (simple) */}
          <div className="sp-panel sp-explain-panel">
            <div className="sp-panel-header">
              <span>✅ Why the draw is fair</span>
            </div>

            <div className="sp-explain">
              <p className="sp-p">
                The winner is picked using a <b>verifiable randomness</b> process.
                That means the result is:
              </p>

              <ul className="sp-bullets">
                <li>
                  <b>Unpredictable</b> before it happens (no one can guess it in advance)
                </li>
                <li>
                  <b>Unchangeable</b> once requested (the request is recorded on-chain)
                </li>
                <li>
                  <b>Auditable</b> by anyone (you can verify it using the provider contract)
                </li>
              </ul>

              <div className="sp-mini-note">
                Even the creator (and Ppopgi) can’t “pick a winner”. The contract only accepts randomness that matches the
                provider’s cryptographic proof.
              </div>
            </div>
          </div>

          {/* 3) How it works timeline */}
          <div className="sp-panel sp-flow-panel">
            <div className="sp-panel-header">
              <span>🎲 How randomness works</span>
              <span className={`sp-flow-pill ${isDrawingLike ? "active" : ""}`}>
                {isDrawingLike ? "In progress" : "Always verifiable"}
              </span>
            </div>

            <div className="sp-flow">
              <div className="sp-step">
                <div className="sp-step-num">1</div>
                <div className="sp-step-body">
                  <div className="sp-step-title">Request randomness</div>
                  <div className="sp-step-text">
                    When the raffle is ready to draw, the contract sends a request to the randomness provider.
                    This request is logged on-chain.
                  </div>
                </div>
              </div>

              <div className="sp-step">
                <div className="sp-step-num">2</div>
                <div className="sp-step-body">
                  <div className="sp-step-title">Provider generates entropy</div>
                  <div className="sp-step-text">
                    The provider creates a random value (“entropy”) and attaches a cryptographic proof that it is valid.
                  </div>
                </div>
              </div>

              <div className="sp-step">
                <div className="sp-step-num">3</div>
                <div className="sp-step-body">
                  <div className="sp-step-title">Contract verifies + picks winner</div>
                  <div className="sp-step-text">
                    The raffle contract verifies the proof on-chain, then converts the entropy into a winner index.
                    If the proof is invalid, the contract rejects it.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4) Technical details (still readable) */}
          <div className="sp-panel sp-tech-panel">
            <div className="sp-panel-header">
              <span>🔎 Proof details</span>
              <span className="sp-tech-note">For anyone who wants to verify</span>
            </div>

            <div className="sp-tech-grid">
              <div className="sp-tech-row">
                <div className="sp-k">Entropy provider</div>
                <div className="sp-v">
                  <ExplorerLink addr={entropyProvider} label={short(entropyProvider)} />
                </div>
              </div>

              <div className="sp-tech-row">
                <div className="sp-k">Entropy address</div>
                <div className="sp-v">
                  <ExplorerLink addr={entropyAddress} label={short(entropyAddress)} />
                </div>
              </div>

              <div className="sp-tech-row">
                <div className="sp-k">Request id</div>
                <div className="sp-v sp-mono">{requestId || "—"}</div>
              </div>

              <div className="sp-tech-row">
                <div className="sp-k">What to check</div>
                <div className="sp-v">
                  Confirm the draw tx calls the provider and the provider callback includes a valid proof.
                </div>
              </div>
            </div>

            <div className="sp-footnote">
              Tip: If you click the provider / entropy addresses above, you can inspect transactions and events on the explorer.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}