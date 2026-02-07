// src/components/CreateRaffleModal.tsx
import React, { useState, useMemo } from "react";
import { formatUnits } from "ethers";
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

  const { form, validation, derived, status, helpers } =
    useCreateRaffleForm(open, handleSuccess);

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
  const insufficientPrizeFunds =
    hasBalanceInfo ? winningPotU6 > usdcBalU6! : false;

  const canCreate =
    validation.canSubmit && !status.isPending && !insufficientPrizeFunds;

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

  // Preview
  const previewRaffle = useMemo(
    () => ({
      id: "preview",
      name: form.name || "Your Raffle Name",
      status: "OPEN",
      winningPot: String(derived.winningPotU),
      ticketPrice: String(derived.ticketPriceU),
      deadline: String(
        Math.floor(Date.now() / 1000) + validation.durationSecondsN
      ),
      sold: "0",
      maxTickets: String(derived.maxT),
      minTickets: String(derived.minT),
      protocolFeePercent: String(derived.configData?.protocolFeePercent ?? "0"),
      feeRecipient:
        String(
          derived.configData?.feeRecipient ||
            ADDRESSES.SingleWinnerDeployer
        ),
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
            <span>
              {step === "success"
                ? "Your raffle is now on the blockchain."
                : "Create your provably fair raffle."}
            </span>
          </div>
          <button className="crm-close-btn" onClick={handleFinalClose}>
            ✕
          </button>
        </div>

        {step === "success" ? (
          <div className="crm-success-view">
            <div className="crm-success-icon">✓</div>
            <div className="crm-success-title">Raffle Created!</div>
          </div>
        ) : (
          <div className="crm-body">
            {/* LEFT */}
            <div className="crm-form-col">
              <div className="crm-bal-row">
                <span className="crm-bal-label">My Balance</span>
                <span className="crm-bal-val">
                  {status.usdcBal !== null
                    ? formatUnits(status.usdcBal, 6)
                    : "..."}{" "}
                  USDC
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
                      onChange={(e) =>
                        form.setTicketPrice(
                          helpers.sanitizeInt(e.target.value)
                        )
                      }
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
                      onChange={(e) =>
                        form.setWinningPot(
                          helpers.sanitizeInt(e.target.value)
                        )
                      }
                    />
                    <span className="crm-suffix">USDC</span>
                  </div>
                </div>
              </div>

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
                    onChange={(e) =>
                      form.setDurationValue(
                        helpers.sanitizeInt(e.target.value)
                      )
                    }
                  />
                </div>

                <div className="crm-input-group">
                  <label>Unit</label>
                  <select
                    className="crm-select"
                    value={form.durationUnit}
                    onChange={(e) =>
                      form.setDurationUnit(e.target.value as any)
                    }
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </div>

              <div className="crm-actions">
                <div className="crm-steps">
                  <button
                    className={`crm-step-btn ${
                      status.isReady ? "done" : "active"
                    }`}
                    onClick={status.approve}
                    disabled={status.isReady}
                  >
                    <span className="crm-step-icon">
                      {status.isReady ? "✓" : "1"}
                    </span>
                    <span>
                      {status.isReady
                        ? "Wallet Prepared"
                        : "Prepare Wallet"}
                    </span>
                  </button>

                  <div className="crm-step-line" />

                  <button
                    className={`crm-step-btn ${
                      status.isReady ? "active primary" : ""
                    }`}
                    onClick={() => {
                      setSubmitAttempted(true);
                      if (canCreate) status.create();
                    }}
                    disabled={createDisabled}
                    style={createBtnStyle}
                  >
                    <span className="crm-step-icon">
                      {status.isPending ? "⏳" : "2"}
                    </span>
                    <span>
                      {status.isPending ? "Creating..." : "Create Raffle"}
                    </span>
                  </button>
                </div>

                {status.msg && (
                  <div className="crm-status-msg">{status.msg}</div>
                )}
              </div>
            </div>

            {/* RIGHT */}
            <div className="crm-preview-col">
              <div className="crm-preview-label">Live Preview</div>
              <div className="crm-card-wrapper">
                {/* @ts-ignore */}
                <RaffleCard raffle={previewRaffle} onOpen={() => {}} />
              </div>
              <div className="crm-network-tip">
                Network: Etherlink Mainnet
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}