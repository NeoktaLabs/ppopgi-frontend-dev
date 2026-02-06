// src/components/SafetyProofModal.tsx
import { useMemo, useState } from "react";
import type { RaffleDetails } from "../hooks/useRaffleDetails";
import { useSafetyBreakdown } from "../hooks/useSafetyBreakdown";
import "./SafetyProofModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
  raffle: RaffleDetails;
};

const ENTROPY_EXPLORER_URL = "https://entropy-explorer.pyth.network/?chain=etherlink-mainnet";

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
      onClick={(e) => e.stopPropagation()}
    >
      {label} ↗
    </a>
  );
};

const short = (s?: string) => (s ? `${s.slice(0, 6)}...${s.slice(-4)}` : "—");

export function SafetyProofModal({ open, onClose, raffle }: Props) {
  const breakdown = useSafetyBreakdown(raffle);
  const [copied, setCopied] = useState(false);

  const raffleAddr = useMemo(() => String(raffle.address || "").toLowerCase(), [raffle.address]);

  const copyAddr = async () => {
    try {
      if (!raffleAddr) return;
      await navigator.clipboard.writeText(raffleAddr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  if (!open) return null;

  return (
    <div className="sp-overlay" onMouseDown={onClose}>
      <div className="sp-card" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sp-header">
          <div className="sp-header-left">
            <div className="sp-shield-icon">🛡️</div>
            <div>
              <h3 className="sp-title">Randomness Proof</h3>
              <div className="sp-subtitle">Verifiable • Unpredictable • On-Chain</div>
            </div>
          </div>
          <button className="sp-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="sp-body">
          {/* Key facts */}
          <div className="sp-section-grid">
            <div className="sp-data-box">
              <div className="sp-lbl">Contract Status</div>
              <div className={`sp-status-pill ${String(raffle.status || "").toLowerCase()}`}>
                {String(raffle.status || "").replaceAll("_", " ")}
              </div>
            </div>

            <div className="sp-data-box">
              <div className="sp-lbl">Raffle Address</div>
              <div className="sp-inline">
                <ExplorerLink addr={raffleAddr} label={short(raffleAddr)} />
                <button className="sp-copy-btn" onClick={copyAddr} title="Copy address">
                  {copied ? "✅" : "📋"}
                </button>
              </div>
              <div className="sp-tech-note">Use this address as the “Sender” when checking Entropy Explorer.</div>
            </div>

            <div className="sp-data-box">
              <div className="sp-lbl">Entropy Provider</div>
              <ExplorerLink addr={raffle.entropyProvider} label={short(raffle.entropyProvider)} />
            </div>

            <div className="sp-data-box">
              <div className="sp-lbl">Entropy Explorer</div>
              <a className="sp-link" href={ENTROPY_EXPLORER_URL} target="_blank" rel="noreferrer">
                Open Entropy Explorer ↗
              </a>
            </div>
          </div>

          {/* Explain panel */}
          <div className="sp-panel sp-explain-panel">
            <div className="sp-panel-header">What this means</div>
            <p className="sp-p">
              This raffle uses <strong>Pyth Entropy</strong> to generate randomness. The random value is produced by an
              external entropy network and is accompanied by cryptographic proof. That means:
            </p>
            <ul className="sp-bullets">
              <li>No one can predict the winner before the randomness is fulfilled.</li>
              <li>No one (including the creator) can choose or manipulate the outcome.</li>
              <li>The draw can be verified publicly on-chain.</li>
            </ul>
          </div>

          {/* Flow panel */}
          <div className="sp-panel sp-flow-panel">
            <div className="sp-panel-header">
              How to verify yourself <span className="sp-flow-pill">2 min</span>
            </div>

            <div className="sp-flow">
              <div className="sp-step">
                <div className="sp-step-num">1</div>
                <div>
                  <div className="sp-step-title">Open the Entropy Explorer</div>
                  <div className="sp-step-text">
                    Click <a className="sp-link" href={ENTROPY_EXPLORER_URL} target="_blank" rel="noreferrer">Entropy Explorer ↗</a>{" "}
                    (Etherlink mainnet).
                  </div>
                </div>
              </div>

              <div className="sp-step">
                <div className="sp-step-num">2</div>
                <div>
                  <div className="sp-step-title">Find the request sent by this raffle</div>
                  <div className="sp-step-text">
                    In the requests list / search, look for the request where the <strong>Sender</strong> equals this
                    raffle address:
                    <div className="sp-mini-note">
                      <span className="sp-mono">{raffleAddr || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sp-step">
                <div className="sp-step-num">3</div>
                <div>
                  <div className="sp-step-title">Open the request details</div>
                  <div className="sp-step-text">
                    You’ll see the request and, once fulfilled, the randomness proof/fulfillment info. That request is
                    what your raffle used to pick a winner.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tech panel */}
          <div className="sp-panel sp-tech-panel">
            <div className="sp-panel-header">Technical details (optional)</div>
            <div className="sp-tech-grid">
              <div className="sp-tech-row">
                <div className="sp-k">Entropy provider</div>
                <div className="sp-v">
                  <ExplorerLink addr={raffle.entropyProvider} label={String(raffle.entropyProvider ? raffle.entropyProvider : "—")} />
                </div>
              </div>

              <div className="sp-tech-row">
                <div className="sp-k">Raffle (sender)</div>
                <div className="sp-v">
                  <ExplorerLink addr={raffleAddr} label={raffleAddr || "—"} />
                </div>
              </div>
            </div>

            <div className="sp-footnote">
              Note: We don’t display a request id here because it isn’t indexed in the subgraph. The Entropy Explorer
              lookup by <em>Sender</em> is the most reliable way for anyone to verify the request.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}