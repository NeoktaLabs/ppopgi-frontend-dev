// src/components/CreateRaffleModal.tsx
import React, { useState, useMemo } from "react";
import { formatUnits } from "ethers";
import { useActiveAccount } from "thirdweb/react";
import { ADDRESSES } from "../config/contracts";
import { RaffleCard } from "./RaffleCard";
import { useCreateRaffleForm } from "../hooks/useCreateRaffleForm";
import { useConfetti } from "../hooks/useConfetti";
import "./CreateRaffleModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (raffleAddress?: string) => void;
};

function toBigInt6(v: string): bigint {
  const clean = String(v || "").replace(/[^\d]/g, "");
  if (!clean) return 0n;
  try {
    return BigInt(clean) * 1_000_000n;
  } catch {
    return 0n;
  }
}

export function CreateRaffleModal({ open, onClose, onCreated }: Props) {
  const { fireConfetti } = useConfetti();
  const account = useActiveAccount();
  const isConnected = !!account?.address;

  const [step, setStep] = useState<"form" | "success">("form");
  const [createdAddr, setCreatedAddr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Track submit attempt → enables red highlights
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const handleSuccess = (addr?: string) => {
    fireConfetti();
    if (addr) {
      setCreatedAddr(addr);
      setStep("success");
    }
  };

  const handleFinalClose = () => {
    if (onCreated && createdAddr) onCreated(createdAddr);
    onClose();
    if (window.location.pathname !== "/") window.location.href = "/";
  };

  const { form, validation, derived, status, helpers } = useCreateRaffleForm(open, handleSuccess);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  React.useEffect(() => {
    if (open) {
      setStep("form");
      setCreatedAddr(null);
      setSubmitAttempted(false);
    }
  }, [open]);

  // ---------------------------------------------
  // Balance vs Winning Pot validation
  // ---------------------------------------------
  const winningPotU6 = useMemo(() => toBigInt6(form.winningPot), [form.winningPot]);
  const usdcBalU6 = status.usdcBal ?? null;

  const hasBalanceInfo = usdcBalU6 !== null;
  const insufficientPrizeFunds = hasBalanceInfo ? winningPotU6 > usdcBalU6! : false;

  // Only allow create if connected
  const canCreate = isConnected && validation.canSubmit && !status.isPending && !insufficientPrizeFunds;

  if (!open) return null;

  // ---------------------------------------------
  // Required field validation (UI only)
  // ---------------------------------------------
  const invalidName = !form.name.trim();
  const invalidTicketPrice = Number(form.ticketPrice) <= 0;
  const invalidWinningPot = Number(form.winningPot) <= 0;
  const invalidDuration = Number(form.durationValue) <= 0;

  const showInvalid = submitAttempted;

  const fieldClass = (invalid: boolean) =>
    `crm-input ${showInvalid && invalid ? "crm-input-invalid" : ""}`;

  // ---------------------------------------------
  // Button visual disable
  // ---------------------------------------------
  const createDisabled = !canCreate;
  const createBtnStyle: React.CSSProperties = createDisabled
    ? { opacity: 0.45, cursor: "not-allowed", filter: "grayscale(0.35)" }
    : {};

  // Generate Share Links
  const shareLink = createdAddr ? `${window.location.origin}/?raffle=${createdAddr}` : "";
  const tweetText = `I just created a new raffle on Ppopgi! 🎟️\n\nPrize: ${form.winningPot} USDC\nCheck it out here:`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareLink)}`;
  const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(tweetText)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Preview
  const previewRaffle = useMemo(
    () => ({
      id: "preview",
      name: form.name || "Your Raffle Name",
      status: "OPEN",
      winningPot: String(derived.winningPotU),
      ticketPrice: String(derived.ticketPriceU),
      deadline: String(Math.floor(Date.now() / 1000) + validation.durationSecondsN),
      sold: "0",
      maxTickets: String(derived.maxT),
      minTickets: String(derived.minT),
      protocolFeePercent: String(derived.configData?.protocolFeePercent ?? "0"),
      feeRecipient: String(derived.configData?.feeRecipient || ADDRESSES.SingleWinnerDeployer),
      deployer: ADDRESSES.SingleWinnerDeployer,
      creator: derived.me ?? "0x000",
      lastUpdatedTimestamp: String(Math.floor(Date.now() / 1000)),
    }),
    [form.name, derived, validation.durationSecondsN]
  );

  return (
    <div className="crm-overlay" onMouseDown={handleFinalClose}>
      <div className="crm-modal" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="crm-header">
          <div className="crm-header-text">
            <h3>{step === "success" ? "You're Live! 🎉" : "Creator Studio"}</h3>
            <span>{step === "success" ? "Your raffle is now on the blockchain." : "Create your provably fair raffle."}</span>
          </div>
          <button className="crm-close-btn" onClick={handleFinalClose}>✕</button>
        </div>

        {/* --- VIEW 1: SUCCESS (SHARE) --- */}
        {step === "success" ? (
          <div className="crm-success-view">
            <div className="crm-success-icon">✓</div>
            <div className="crm-success-title">Raffle Created!</div>
            <div className="crm-success-sub">Your contract is live. Share the link below to start selling tickets.</div>

            <div className="crm-share-box">
              <label className="crm-label" style={{ textAlign: "left" }}>Direct Link</label>
              <div className="crm-link-row">
                <input className="crm-link-input" readOnly value={shareLink} onClick={(e) => (e.target as HTMLInputElement).select()} />
                <button className={`crm-copy-btn ${copied ? "copied" : ""}`} onClick={handleCopy}>
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="crm-social-row">
              <a href={tweetUrl} target="_blank" rel="noreferrer" className="crm-social-btn twitter">Share on 𝕏</a>
              <a href={tgUrl} target="_blank" rel="noreferrer" className="crm-social-btn telegram">Telegram</a>
            </div>

            <button className="crm-done-btn" onClick={handleFinalClose}>
              Skip and view dashboard →
            </button>
          </div>
        ) : (
          /* --- VIEW 2: FORM --- */
          <div className="crm-body">
            {/* LEFT */}
            <div className="crm-form-col">
              <div className="crm-bal-row">
                <span className="crm-bal-label">My Balance</span>
                <span className="crm-bal-val">
                  {status.usdcBal !== null ? formatUnits(status.usdcBal, 6) : "..."} USDC
                </span>
              </div>

              <div className="crm-input-group">
                <label>Raffle Name</label>
                <input
                  className={fieldClass(invalidName)}
                  value={form.name}
                  onChange={(e) => form.setName(e.target.value)}
                  placeholder="e.g. Bored Ape #8888"
                  maxLength={32}
                />
              </div>

              <div className="crm-grid-2">
                <div className="crm-input-group">
                  <label>Ticket Price</label>
                  <div className="crm-input-wrapper">
                    <input
                      className={fieldClass(invalidTicketPrice)}
                      inputMode="numeric"
                      value={form.ticketPrice}
                      onChange={(e) => form.setTicketPrice(helpers.sanitizeInt(e.target.value))}
                    />
                    <span className="crm-suffix">USDC</span>
                  </div>
                </div>

                <div className="crm-input-group">
                  <label>Total Prize</label>
                  <div className="crm-input-wrapper">
                    <input
                      className={fieldClass(invalidWinningPot)}
                      inputMode="numeric"
                      value={form.winningPot}
                      onChange={(e) => form.setWinningPot(helpers.sanitizeInt(e.target.value))}
                    />
                    <span className="crm-suffix">USDC</span>
                  </div>
                </div>
              </div>

              {/* Warn if prize > balance */}
              {hasBalanceInfo && insufficientPrizeFunds && (
                <div
                  className="crm-status-msg"
                  style={{
                    marginTop: 10,
                    marginBottom: 14,
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                    color: "#9a3412",
                    fontWeight: 800,
                  }}
                >
                  Your wallet balance isn’t enough to fund this prize.
                </div>
              )}

              <div className="crm-grid-dur">
                <div className="crm-input-group">
                  <label>Duration</label>
                  <input
                    className={fieldClass(invalidDuration)}
                    inputMode="numeric"
                    value={form.durationValue}
                    onChange={(e) => form.setDurationValue(helpers.sanitizeInt(e.target.value))}
                  />
                </div>

                <div className="crm-input-group">
                  <label>Unit</label>
                  <select className="crm-select" value={form.durationUnit} onChange={(e) => form.setDurationUnit(e.target.value as any)}>
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </div>

              <div className="crm-advanced">
                <button type="button" className="crm-adv-toggle" onClick={() => setAdvancedOpen(!advancedOpen)}>
                  {advancedOpen ? "− Less Options" : "+ Advanced Options (Limits)"}
                </button>

                {advancedOpen && (
                  <div className="crm-adv-content">
                    <div className="crm-grid-2">
                      <div className="crm-input-group">
                        <label>Min Tickets to Draw</label>
                        <input className="crm-input" value={form.minTickets} onChange={(e) => form.setMinTickets(helpers.sanitizeInt(e.target.value))} />
                      </div>
                      <div className="crm-input-group">
                        <label>Max Capacity (Opt)</label>
                        <input className="crm-input" value={form.maxTickets} onChange={(e) => form.setMaxTickets(helpers.sanitizeInt(e.target.value))} placeholder="∞" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ✅ Actions (blur + overlay if not connected) */}
              <div
                className="crm-actions"
                style={{
                  position: "relative",
                  filter: !isConnected ? "blur(3px)" : undefined,
                  opacity: !isConnected ? 0.65 : 1,
                  pointerEvents: !isConnected ? "none" : "auto",
                  transition: "filter 0.2s ease, opacity 0.2s ease",
                }}
              >
                <div className="crm-steps">
                  <button
                    className={`crm-step-btn ${status.isReady ? "done" : "active"}`}
                    onClick={status.approve}
                    disabled={!isConnected || status.isReady}
                  >
                    <span className="crm-step-icon">{status.isReady ? "✓" : "1"}</span>
                    <span>{status.isReady ? "Wallet Prepared" : "Prepare Wallet"}</span>
                  </button>

                  <div className="crm-step-line" />

                  <button
                    className={`crm-step-btn ${status.isReady ? "active primary" : ""}`}
                    onClick={() => {
                      setSubmitAttempted(true);
                      if (canCreate) status.create();
                    }}
                    disabled={createDisabled}
                    style={createBtnStyle}
                    title={insufficientPrizeFunds ? "Insufficient USDC balance for prize pot" : undefined}
                  >
                    <span className="crm-step-icon">{status.isPending ? "⏳" : "2"}</span>
                    <span>{status.isPending ? "Creating..." : "Create Raffle"}</span>
                  </button>
                </div>

                {status.msg && <div className="crm-status-msg">{status.msg}</div>}
              </div>

              {/* Overlay message (not blurred) */}
              {!isConnected && (
                <div
                  style={{
                    marginTop: 10,
                    background: "rgba(15, 23, 42, 0.9)",
                    border: "1px solid rgba(255,255,255,.10)",
                    borderRadius: 14,
                    padding: "12px 14px",
                    color: "#e5e7eb",
                    fontWeight: 900,
                    textAlign: "center",
                  }}
                >
                  Connect your wallet to create a raffle.
                </div>
              )}
            </div>

            {/* RIGHT */}
            <div className="crm-preview-col">
              <div className="crm-preview-label">Live Preview</div>
              <div className="crm-card-wrapper">
                {/* @ts-ignore */}
                <RaffleCard raffle={previewRaffle} onOpen={() => {}} />
              </div>
              <div className="crm-network-tip">Network: Etherlink Mainnet</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}