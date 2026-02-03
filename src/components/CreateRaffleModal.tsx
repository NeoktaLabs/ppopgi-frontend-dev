// src/components/CreateRaffleModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "ethers";
import { ETHERLINK_MAINNET } from "../chain/etherlink";
import { useFactoryConfig } from "../hooks/useFactoryConfig";
import { ADDRESSES } from "../config/contracts";

import { getContract, prepareContractCall, readContract } from "thirdweb";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";

import { RaffleCard } from "./RaffleCard";
import type { RaffleListItem } from "../indexer/subgraph";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (raffleAddress?: string) => void;
};

function short(a: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

type DurationUnit = "minutes" | "hours" | "days";
function unitToSeconds(unit: DurationUnit): number {
  if (unit === "minutes") return 60;
  if (unit === "hours") return 3600;
  return 86400;
}

// ---- integer-only helpers ----
function sanitizeIntInput(raw: string) {
  return raw.replace(/[^\d]/g, "");
}
function toIntStrict(raw: string, fallback = 0) {
  const s = sanitizeIntInput(raw);
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

// ---- amount helpers (integer-only USDC for this UI) ----
function sanitizeUsdcInt(raw: string) {
  // only digits; no decimals
  return raw.replace(/[^\d]/g, "");
}

function fmtUsdc(raw: bigint) {
  try {
    return formatUnits(raw, 6);
  } catch {
    return "0";
  }
}

function etherlinkExplorerAddrUrl(address: string) {
  // If you already have a known explorer base, swap it here.
  // Kept generic & safe: user can change without touching logic.
  const a = String(address || "");
  return `https://explorer.etherlink.com/address/${a}`;
}

export function CreateRaffleModal({ open, onClose, onCreated }: Props) {
  const { data, loading } = useFactoryConfig(open);

  const account = useActiveAccount();
  const me = account?.address ?? null;

  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();

  // ---------- UI state ----------
  const [msg, setMsg] = useState<string | null>(null);
  const [createdRaffleAddr, setCreatedRaffleAddr] = useState<string | null>(null);

  // Collapsibles
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [netOpen, setNetOpen] = useState(false);

  // ---------- form state ----------
  const [name, setName] = useState("");
  const [ticketPrice, setTicketPrice] = useState("1"); // integer USDC
  const [winningPot, setWinningPot] = useState("100"); // integer USDC

  // Duration
  const [durationValue, setDurationValue] = useState("24");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("hours");

  // Min tickets is MAIN (not advanced)
  const [minTickets, setMinTickets] = useState("1");

  // Advanced only
  const [maxTickets, setMaxTickets] = useState(""); // empty = unlimited
  const [minPurchaseAmount, setMinPurchaseAmount] = useState("1");

  // --- Allowance/balance state ---
  const [usdcBal, setUsdcBal] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [allowLoading, setAllowLoading] = useState(false);
  const [approvedOnce, setApprovedOnce] = useState(false);

  // Contracts
  const deployer = useMemo(() => {
    return getContract({
      client: thirdwebClient,
      chain: ETHERLINK_CHAIN,
      address: ADDRESSES.SingleWinnerDeployer,
    });
  }, []);

  const usdcContract = useMemo(() => {
    const addr = data?.usdc || ADDRESSES.USDC;
    if (!addr) return null;
    return getContract({
      client: thirdwebClient,
      chain: ETHERLINK_CHAIN,
      address: addr,
    });
  }, [data?.usdc]);

  // ---- parse + validate ----
  const durV = toIntStrict(durationValue, 0);
  const durationSecondsN = durV * unitToSeconds(durationUnit);

  // Duration min/max: 5 minutes to 30 days
  const MIN_DURATION_SECONDS = 5 * 60;
  const MAX_DURATION_SECONDS = 30 * 24 * 3600;

  const durOk = durationSecondsN >= MIN_DURATION_SECONDS && durationSecondsN <= MAX_DURATION_SECONDS;

  // Integers only
  const ticketPriceInt = toIntStrict(ticketPrice, 0);
  const winningPotInt = toIntStrict(winningPot, 0);
  const minTn = toIntStrict(minTickets, 1);

  const maxTnRaw = toIntStrict(maxTickets, 0);
  const maxTn = maxTickets.trim() === "" ? 0 : maxTnRaw; // 0 means unlimited
  const minPurchase = toIntStrict(minPurchaseAmount, 1);

  const minT = BigInt(Math.max(1, minTn));
  const maxT = BigInt(Math.max(0, maxTn));
  const minPurchaseU32 = Math.max(1, minPurchase);

  const maxTicketsIsUnlimited = maxTickets.trim() === "" || maxTn === 0;
  const ticketsOk = maxTicketsIsUnlimited ? true : maxT >= minT;
  const minPurchaseOk = maxTicketsIsUnlimited ? true : BigInt(minPurchaseU32) <= maxT;

  // USDC amounts are 6 decimals on-chain; but our UI is integer USDC.
  const ticketPriceU = useMemo(() => {
    try {
      return parseUnits(String(ticketPriceInt || 0), 6);
    } catch {
      return 0n;
    }
  }, [ticketPriceInt]);

  const winningPotU = useMemo(() => {
    try {
      return parseUnits(String(winningPotInt || 0), 6);
    } catch {
      return 0n;
    }
  }, [winningPotInt]);

  const requiredAllowanceU = winningPotU;

  const hasEnoughAllowance = allowance !== null ? allowance >= requiredAllowanceU : false;
  const hasEnoughBalance = usdcBal !== null ? usdcBal >= requiredAllowanceU : true;

  // We keep approval “visible” but make it less confusing:
  // - we approve exactly the pot amount (not 100 by default)
  // - we only show an “Approved ✓” pill when sufficient
  const needsAllow = !!me && !isPending && !!usdcContract && requiredAllowanceU > 0n && !hasEnoughAllowance;

  const canSubmit =
    !!me &&
    !isPending &&
    name.trim().length > 0 &&
    durOk &&
    ticketPriceInt > 0 &&
    winningPotInt > 0 &&
    minT > 0n &&
    ticketsOk &&
    minPurchaseOk &&
    hasEnoughAllowance &&
    hasEnoughBalance;

  const durationHint = useMemo(() => {
    if (!durV) return "Pick how long it stays open.";
    if (durationSecondsN < MIN_DURATION_SECONDS) return "Minimum duration is 5 minutes.";
    if (durationSecondsN > MAX_DURATION_SECONDS) return "Maximum duration is 30 days.";
    const end = new Date(Date.now() + durationSecondsN * 1000);
    return `Ends at ${end.toLocaleString()}`;
  }, [durV, durationSecondsN]);

  async function refreshAllowance() {
    if (!open) return;
    if (!me) return;
    if (!usdcContract) return;

    setAllowLoading(true);
    try {
      const [bal, a] = await Promise.all([
        readContract({
          contract: usdcContract,
          method: "function balanceOf(address) view returns (uint256)",
          params: [me],
        }),
        readContract({
          contract: usdcContract,
          method: "function allowance(address,address) view returns (uint256)",
          params: [me, ADDRESSES.SingleWinnerDeployer],
        }),
      ]);

      setUsdcBal(BigInt(bal as any));
      setAllowance(BigInt(a as any));
    } catch {
      setUsdcBal(null);
      setAllowance(null);
    } finally {
      setAllowLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setMsg(null);
    setCreatedRaffleAddr(null);
    setApprovedOnce(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!me) return;
    refreshAllowance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, me, usdcContract?.address]);

  async function onApproveUsdc() {
    setMsg(null);

    if (!me) return setMsg("Please sign in first.");
    if (!usdcContract) return setMsg("USDC isn’t available right now.");
    if (requiredAllowanceU <= 0n) return setMsg("Enter a prize amount first.");

    try {
      const tx = prepareContractCall({
        contract: usdcContract,
        method: "function approve(address spender,uint256 amount) returns (bool)",
        params: [ADDRESSES.SingleWinnerDeployer, requiredAllowanceU],
      });

      await sendAndConfirm(tx);
      setApprovedOnce(true);
      setMsg("✅ Payment approved. You’re ready to create your raffle.");
      await refreshAllowance();
    } catch (e: any) {
      const m = String(e?.reason || e?.shortMessage || e?.message || "");
      if (m.toLowerCase().includes("rejected")) setMsg("Action canceled.");
      else setMsg("Couldn’t approve right now. Please try again.");
    }
  }

  async function onCreate() {
    setMsg(null);

    if (!me) return setMsg("Please sign in first.");
    if (!durOk) return setMsg("Duration must be between 5 minutes and 30 days.");
    if (!ticketsOk) return setMsg("Max tickets must be ≥ min tickets (or leave max empty for unlimited).");
    if (!minPurchaseOk) return setMsg("Min purchase must be ≤ max tickets (or keep max unlimited).");
    if (winningPotInt <= 0) return setMsg("Prize must be greater than 0.");
    if (ticketPriceInt <= 0) return setMsg("Ticket price must be greater than 0.");
    if (!hasEnoughBalance) return setMsg("Not enough USDC for the prize.");
    if (!hasEnoughAllowance) return setMsg("Please approve the payment first.");

    try {
      const durationSeconds = BigInt(durationSecondsN);

      const tx = prepareContractCall({
        contract: deployer,
        method:
          "function createSingleWinnerLottery(string name,uint256 ticketPrice,uint256 winningPot,uint64 minTickets,uint64 maxTickets,uint64 durationSeconds,uint32 minPurchaseAmount) returns (address lotteryAddr)",
        params: [
          name.trim(),
          ticketPriceU,
          winningPotU,
          minT,
          maxT, // 0 = unlimited
          durationSeconds,
          minPurchaseU32,
        ],
      });

      const receipt: any = await sendAndConfirm(tx);

      // Best-effort: thirdweb receipts vary. We keep it safe + non-blocking.
      // If you later want the real address reliably, we can parse the LotteryDeployed event from the deployer.
      const maybeAddr = receipt?.result?.lotteryAddr || receipt?.receipt?.logs?.[0]?.address || null;

      setCreatedRaffleAddr(typeof maybeAddr === "string" ? maybeAddr : null);
      setMsg("🎉 Raffle created! Share it with your friends.");
      try {
        onCreated?.(typeof maybeAddr === "string" ? maybeAddr : undefined);
      } catch {}
    } catch (e: any) {
      const m = String(e?.reason || e?.shortMessage || e?.message || "");
      if (m.toLowerCase().includes("rejected")) setMsg("Transaction canceled.");
      else setMsg(m || "Could not create the raffle. Please try again.");
    }
  }

  async function copyShareLink() {
    try {
      const base = window.location.origin;
      const id = createdRaffleAddr;
      if (!id) return;
      const url = `${base}/raffle/${id}`;
      await navigator.clipboard.writeText(url);
      setMsg("✅ Link copied. Send it to your friends.");
    } catch {
      setMsg("Couldn’t copy automatically. You can copy the link from your address bar.");
    }
  }

  // ----------------- STYLE -----------------
  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 10500,
  };

  // Light modal (no glass)
  const modal: React.CSSProperties = {
    width: "min(980px, 100%)",
    maxHeight: "min(88vh, 860px)",
    overflow: "hidden",
    borderRadius: 20,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.96)",
    boxShadow: "0 20px 70px rgba(0,0,0,0.30)",
    color: "rgba(20,20,28,0.92)",
  };

  const header: React.CSSProperties = {
    padding: 18,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  };

  const title: React.CSSProperties = {
    margin: 0,
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: 0.2,
  };

  const subtitle: React.CSSProperties = {
    marginTop: 6,
    fontSize: 13,
    opacity: 0.75,
    lineHeight: 1.4,
  };

  const closeBtn: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.90)",
    borderRadius: 12,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 900,
  };

  const body: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1.05fr 0.95fr",
    gap: 14,
    padding: 14,
    overflow: "auto",
    maxHeight: "calc(min(88vh, 860px) - 78px)",
  };

  const sectionBase: React.CSSProperties = {
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.06)",
    padding: 14,
  };

  const secA: React.CSSProperties = { ...sectionBase, background: "rgba(245,247,255,0.9)" };
  const secB: React.CSSProperties = { ...sectionBase, background: "rgba(245,255,248,0.9)" };
  const secC: React.CSSProperties = { ...sectionBase, background: "rgba(255,248,245,0.9)" };
  const secD: React.CSSProperties = { ...sectionBase, background: "rgba(250,250,252,0.95)" };

  const secTitle: React.CSSProperties = {
    fontWeight: 950,
    fontSize: 13,
    letterSpacing: 0.2,
    marginBottom: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  };

  const tinyToggle: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.80)",
    borderRadius: 999,
    padding: "6px 10px",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };

  const inputLabel: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  };

  const tip: React.CSSProperties = {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.75,
    lineHeight: 1.35,
  };

  const input: React.CSSProperties = {
    width: "100%",
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.92)",
    borderRadius: 12,
    padding: "12px 12px",
    outline: "none",
    color: "rgba(20,20,28,0.92)",
    fontWeight: 800,
  };

  const selectStyle: React.CSSProperties = {
    ...input,
    cursor: "pointer",
  };

  const grid2: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  };

  // condensed duration row (no wasted space)
  const gridDuration: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "0.85fr 1.15fr",
    gap: 10,
    alignItems: "start",
  };

  const pill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    padding: "6px 10px",
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };

  const pillGood: React.CSSProperties = {
    ...pill,
    border: "1px solid rgba(20,140,80,0.25)",
    background: "rgba(210,255,230,0.65)",
  };

  const pillWarn: React.CSSProperties = {
    ...pill,
    border: "1px solid rgba(180,40,40,0.22)",
    background: "rgba(255,220,220,0.70)",
  };

  const btnRow: React.CSSProperties = { display: "grid", gap: 10, marginTop: 12 };

  const btnBase: React.CSSProperties = {
    width: "100%",
    borderRadius: 14,
    padding: "12px 14px",
    fontWeight: 950,
    cursor: "pointer",
    border: "1px solid rgba(0,0,0,0.10)",
  };

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: "rgba(25,25,35,0.92)",
    color: "white",
    border: "1px solid rgba(0,0,0,0.10)",
  };

  const btnSecondary: React.CSSProperties = {
    ...btnBase,
    background: "rgba(255,255,255,0.90)",
    color: "rgba(20,20,28,0.92)",
  };

  const btnDisabled: React.CSSProperties = {
    ...btnBase,
    background: "rgba(240,240,242,1)",
    color: "rgba(20,20,28,0.45)",
    cursor: "not-allowed",
  };

  const linkBtn: React.CSSProperties = {
    ...btnSecondary,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };

  const centeredNote: React.CSSProperties = {
    marginTop: 10,
    fontSize: 12,
    opacity: 0.78,
    textAlign: "center",
    lineHeight: 1.35,
  };

  const redCentered: React.CSSProperties = {
    marginTop: 10,
    fontSize: 13,
    textAlign: "center",
    fontWeight: 900,
    color: "rgba(180,40,40,0.95)",
  };

  const addrLink: React.CSSProperties = {
    fontWeight: 900,
    color: "rgba(20,20,28,0.92)",
    textDecoration: "none",
    borderBottom: "1px dotted rgba(20,20,28,0.35)",
  };

  // ----------------- PREVIEW (use real RaffleCard) -----------------
  const previewRaffle: RaffleListItem = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const end = durOk ? now + durationSecondsN : now + 3600;

    return {
      id: "0x0000000000000000000000000000000000000000",
      name: name.trim() || "Your raffle",
      status: "OPEN" as any,
      winningPot: String(winningPotU),
      ticketPrice: String(ticketPriceU),
      deadline: String(end),
      sold: "0",
      maxTickets: String(maxT),
      minTickets: String(minT),
      protocolFeePercent: String(data?.protocolFeePercent ?? "0"),
      feeRecipient: String(data?.feeRecipient || "0x0000000000000000000000000000000000000000"),
      deployer: ADDRESSES.SingleWinnerDeployer,
      creator: me ?? "0x0000000000000000000000000000000000000000",
      lastUpdatedTimestamp: String(now),
      // optional fields that your card might read:
      finalizedAt: "0",
      completedAt: "0",
      canceledAt: "0",
    } as any;
  }, [
    name,
    durOk,
    durationSecondsN,
    winningPotU,
    ticketPriceU,
    maxT,
    minT,
    data?.protocolFeePercent,
    data?.feeRecipient,
    me,
  ]);

  const approvalPill = useMemo(() => {
    if (!me) return null;
    if (allowLoading) return <span style={pill}>Checking…</span>;
    if (requiredAllowanceU <= 0n) return <span style={pill}>Enter prize</span>;
    if (hasEnoughAllowance) return <span style={pillGood}>Approved ✓</span>;
    if (approvedOnce) return <span style={pillWarn}>Approval pending?</span>;
    return <span style={pill}>Not approved</span>;
  }, [me, allowLoading, requiredAllowanceU, hasEnoughAllowance, approvedOnce, pill, pillGood, pillWarn]);

  const balancePill = useMemo(() => {
    if (!me) return null;
    if (allowLoading) return <span style={pill}>USDC: …</span>;
    if (usdcBal === null) return <span style={pill}>USDC: —</span>;
    return <span style={pill}>USDC: {fmtUsdc(usdcBal)}</span>;
  }, [me, allowLoading, usdcBal, pill]);

  // ✅ IMPORTANT: only return null AFTER all hooks have run (prevents hook order crash)
  if (!open) return null;

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={modal} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Header */}
        <div style={header}>
          <div>
            <h3 style={title}>Create a raffle</h3>
            <div style={subtitle}>You’ll always confirm in your wallet. We’ll never do anything silently.</div>
          </div>

          <button onClick={onClose} style={closeBtn} aria-label="Close">
            Close
          </button>
        </div>

        <div style={body}>
          {/* LEFT: form */}
          <div style={{ display: "grid", gap: 12 }}>
            {/* Main details */}
            <div style={secA}>
              <div style={secTitle}>
                <span>Raffle details</span>
                <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {balancePill}
                  {approvalPill}
                </span>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <div style={inputLabel}>
                    <span>Name</span>
                  </div>
                  <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ppopgi #12" />
                  <div style={tip}>This is what people will see on the raffle card.</div>
                </div>

                <div style={grid2}>
                  <div>
                    <div style={inputLabel}>
                      <span>Ticket price (USDC)</span>
                    </div>
                    <input
                      style={input}
                      value={ticketPrice}
                      onChange={(e) => setTicketPrice(sanitizeUsdcInt(e.target.value))}
                      inputMode="numeric"
                      placeholder="e.g. 1"
                    />
                    <div style={tip}>Whole numbers only for now.</div>
                  </div>

                  <div>
                    <div style={inputLabel}>
                      <span>Prize (USDC)</span>
                    </div>
                    <input
                      style={input}
                      value={winningPot}
                      onChange={(e) => setWinningPot(sanitizeUsdcInt(e.target.value))}
                      inputMode="numeric"
                      placeholder="e.g. 100"
                    />
                    <div style={tip}>You’ll fund this prize when creating.</div>
                  </div>
                </div>

                {/* Condensed duration row */}
                <div style={gridDuration}>
                  <div>
                    <div style={inputLabel}>
                      <span>Duration</span>
                    </div>
                    <input
                      style={input}
                      value={durationValue}
                      onChange={(e) => setDurationValue(sanitizeIntInput(e.target.value))}
                      inputMode="numeric"
                      placeholder="e.g. 24"
                    />
                  </div>

                  <div>
                    <div style={inputLabel}>
                      <span>Unit</span>
                    </div>
                    <select
                      style={{ ...selectStyle, paddingRight: 30 }}
                      value={durationUnit}
                      onChange={(e) => setDurationUnit(e.target.value as any)}
                    >
                      <option value="minutes">minutes</option>
                      <option value="hours">hours</option>
                      <option value="days">days</option>
                    </select>
                    <div style={tip}>{durationHint}</div>
                  </div>
                </div>

                {/* Min tickets is NOT advanced */}
                <div style={grid2}>
                  <div>
                    <div style={inputLabel}>
                      <span>Minimum tickets</span>
                    </div>
                    <input
                      style={input}
                      value={minTickets}
                      onChange={(e) => setMinTickets(sanitizeIntInput(e.target.value))}
                      inputMode="numeric"
                      placeholder="1"
                    />
                    <div style={tip}>If fewer are sold, the raffle won’t finalize.</div>
                  </div>

                  {/* advanced toggle placed under duration area vibes, but still within this section */}
                  <div style={{ display: "grid", alignContent: "end" }}>
                    <button
                      style={{
                        ...tinyToggle,
                        justifyContent: "center",
                        width: "100%",
                        fontSize: 12,
                      }}
                      onClick={() => setAdvancedOpen((v) => !v)}
                      type="button"
                      aria-expanded={advancedOpen}
                    >
                      <span style={{ fontSize: 14, lineHeight: 1 }}>{advancedOpen ? "−" : "+"}</span>
                      <span>{advancedOpen ? "Hide advanced" : "Advanced settings"}</span>
                    </button>
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.72, textAlign: "center" }}>
                      Optional caps & purchase rules.
                    </div>
                  </div>
                </div>

                {/* Advanced */}
                {advancedOpen && (
                  <div style={secD}>
                    <div style={secTitle}>
                      <span>Advanced settings</span>
                      <span style={pill}>Optional</span>
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={grid2}>
                        <div>
                          <div style={inputLabel}>
                            <span>Max tickets (optional)</span>
                          </div>
                          <input
                            style={input}
                            value={maxTickets}
                            onChange={(e) => setMaxTickets(sanitizeIntInput(e.target.value))}
                            inputMode="numeric"
                            placeholder="Unlimited"
                          />
                          <div style={tip}>{maxTickets.trim() === "" ? "Unlimited (recommended)" : `Cap: ${maxTickets}`}</div>
                        </div>

                        <div>
                          <div style={inputLabel}>
                            <span>Min purchase</span>
                          </div>
                          <input
                            style={input}
                            value={minPurchaseAmount}
                            onChange={(e) => setMinPurchaseAmount(sanitizeIntInput(e.target.value))}
                            inputMode="numeric"
                            placeholder="1"
                          />
                          <div style={tip}>Minimum tickets someone must buy per purchase.</div>
                        </div>
                      </div>

                      {!ticketsOk && <div style={pillWarn}>Max tickets must be ≥ minimum tickets.</div>}
                      {!minPurchaseOk && <div style={pillWarn}>Min purchase must be ≤ max tickets (or keep max unlimited).</div>}
                    </div>
                  </div>
                )}

                {/* Not enough USDC warning (red & centered in this section) */}
                {!hasEnoughBalance && requiredAllowanceU > 0n && (
                  <div style={redCentered}>Not enough USDC for the prize amount.</div>
                )}
              </div>
            </div>

            {/* Payment & create */}
            <div style={secB}>
              <div style={secTitle}>
                <span>Payment & create</span>
                <span style={pill}>{me ? short(me) : "Not signed in"}</span>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <div style={tip}>
                  <b>Step 1:</b> Approve the prize payment (one-time per amount).
                  <br />
                  <b>Step 2:</b> Create the raffle.
                </div>

                <div style={btnRow}>
                  <button
                    style={needsAllow ? btnSecondary : btnDisabled}
                    disabled={!needsAllow}
                    onClick={onApproveUsdc}
                    title="Approve the prize payment"
                  >
                    {isPending ? "Confirm in wallet…" : me ? "Approve prize payment" : "Sign in to continue"}
                  </button>

                  <button style={canSubmit ? btnPrimary : btnDisabled} disabled={!canSubmit} onClick={onCreate}>
                    {isPending ? "Creating…" : me ? "Create raffle" : "Sign in to create"}
                  </button>

                  {createdRaffleAddr && (
                    <button style={linkBtn} onClick={copyShareLink} type="button">
                      Copy share link
                    </button>
                  )}
                </div>

                {msg && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 12,
                      borderRadius: 14,
                      border: "1px solid rgba(0,0,0,0.08)",
                      background: "rgba(255,255,255,0.85)",
                      fontSize: 13,
                      fontWeight: 900,
                    }}
                  >
                    {msg}
                  </div>
                )}

                <div style={centeredNote}>Nothing happens automatically — you always confirm in your wallet.</div>
              </div>
            </div>

            {/* Network settings (collapsed by default) */}
            <div style={secC}>
              <div style={secTitle}>
                <span>Network details</span>

                <button style={tinyToggle} onClick={() => setNetOpen((v) => !v)} type="button" aria-expanded={netOpen}>
                  <span style={{ fontSize: 14, lineHeight: 1 }}>{netOpen ? "−" : "+"}</span>
                  <span>{netOpen ? "Hide" : "Show"}</span>
                </button>
              </div>

              {!netOpen ? (
                <div style={tip}>
                  Powered by <b>{ETHERLINK_MAINNET.chainName}</b>. Tap “Show” if you want the contract addresses.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={tip}>These are the on-chain contracts used to create raffles.</div>

                  <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ opacity: 0.75, fontWeight: 800 }}>Deployer</span>
                      <a
                        style={addrLink}
                        href={etherlinkExplorerAddrUrl(ADDRESSES.SingleWinnerDeployer)}
                        target="_blank"
                        rel="noreferrer"
                        title="Open in explorer"
                      >
                        {short(ADDRESSES.SingleWinnerDeployer)}
                      </a>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ opacity: 0.75, fontWeight: 800 }}>USDC</span>
                      <a
                        style={addrLink}
                        href={etherlinkExplorerAddrUrl(data?.usdc || ADDRESSES.USDC)}
                        target="_blank"
                        rel="noreferrer"
                        title="Open in explorer"
                      >
                        {short(String(data?.usdc || ADDRESSES.USDC))}
                      </a>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ opacity: 0.75, fontWeight: 800 }}>Entropy</span>
                      <a
                        style={addrLink}
                        href={etherlinkExplorerAddrUrl(String(data?.entropy || "0x0000000000000000000000000000000000000000"))}
                        target="_blank"
                        rel="noreferrer"
                        title="Open in explorer"
                      >
                        {data?.entropy ? short(String(data.entropy)) : "—"}
                      </a>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ opacity: 0.75, fontWeight: 800 }}>Entropy provider</span>
                      <a
                        style={addrLink}
                        href={etherlinkExplorerAddrUrl(String(data?.entropyProvider || "0x0000000000000000000000000000000000000000"))}
                        target="_blank"
                        rel="noreferrer"
                        title="Open in explorer"
                      >
                        {data?.entropyProvider ? short(String(data.entropyProvider)) : "—"}
                      </a>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                    <span style={pill}>{loading ? "Syncing…" : "Up to date"}</span>
                    {hasEnoughAllowance && <span style={pillGood}>Approved ✓</span>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: preview */}
          <div style={{ display: "grid", gap: 12 }}>
            <div style={secD}>
              <div style={secTitle}>
                <span>Preview</span>
                <span style={pill}>How it will look</span>
              </div>

              <div style={{ marginTop: 10 }}>
                {/* wrapper prevents cropping issues */}
                <div style={{ padding: 6 }}>
                  <RaffleCard raffle={previewRaffle as any} onOpen={() => {}} />
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.78, lineHeight: 1.35 }}>
                Keep typing — the preview updates instantly.
              </div>
            </div>

            <div style={secA}>
              <div style={secTitle}>
                <span>Quick tips</span>
                <span style={pill}>Simple</span>
              </div>

              <div style={{ display: "grid", gap: 10, fontSize: 13, lineHeight: 1.45 }}>
                <div>
                  <b>Prize</b> is funded when you create the raffle.
                </div>
                <div>
                  <b>Ticket price</b> is what people pay per ticket.
                </div>
                <div>
                  <b>Minimum tickets</b> is the minimum sold before it can finalize.
                </div>
                <div style={{ opacity: 0.85 }}>
                  Advanced settings are optional — you can leave them alone for a clean default.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}