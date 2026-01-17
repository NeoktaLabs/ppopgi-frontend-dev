// src/features/create/CreateRaffleModal.tsx
import React, { useMemo, useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { parseUnits, formatUnits, parseEventLogs } from "viem";
import { ExternalLink, Loader2, Sparkles, Copy, Check } from "lucide-react";

import { Modal } from "../../ui/Modal";
import { ADDR, ERC20_ABI, SINGLE_WINNER_DEPLOYER_ABI } from "../../lib/contracts";
import { txUrl } from "../../lib/explorer";
import { EditableRaffleCard, type EditableRaffleCardValue } from "./EditableRaffleCard";

function shortAddr(a?: string) {
  if (!a) return "—";
  const s = String(a);
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Accept numeric inputs like: "1", "0.5", "10.00"
function isNumericInput(s: string) {
  const v = (s ?? "").trim();
  if (!v) return false;
  return /^\d+(\.\d+)?$/.test(v);
}

// Never throw during render; invalid inputs => 0n (UI shows errors + disables submit)
function safeParseUnits(value: string, decimals: number): bigint {
  try {
    if (!isNumericInput(value)) return 0n;
    return parseUnits(value, decimals);
  } catch {
    return 0n;
  }
}

/**
 * Accepts:
 * - "90m", "1h", "1h30", "2d", "5400s"
 * - plain number => minutes by default (e.g. "90" => 90m)
 */
function parseDurationToSeconds(input: string): number | null {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) return null;

  // If only digits => treat as minutes (user-friendly)
  if (/^\d+$/.test(raw)) {
    const mins = Number(raw);
    if (!Number.isFinite(mins) || mins <= 0) return null;
    return Math.floor(mins * 60);
  }

  // Patterns: 2d, 3h, 15m, 30s
  const unitMap: Record<string, number> = { d: 86400, h: 3600, m: 60, s: 1 };

  // Special: "1h30" (no 'm' suffix on minutes part)
  const hThenMin = raw.match(/^(\d+)\s*h\s*(\d+)\s*$/);
  if (hThenMin) {
    const h = Number(hThenMin[1]);
    const m = Number(hThenMin[2]);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const sec = h * 3600 + m * 60;
    return sec > 0 ? Math.floor(sec) : null;
  }

  // General: sum of chunks like "1h30m", "2d4h", "10m30s"
  const re = /(\d+)\s*([dhms])/g;
  let total = 0;
  let matched = false;

  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    matched = true;
    const num = Number(m[1]);
    const u = m[2];
    const mul = unitMap[u] ?? 0;
    if (!Number.isFinite(num) || mul <= 0) return null;
    total += num * mul;
  }

  if (!matched) return null;
  if (total <= 0) return null;
  return Math.floor(total);
}

export function CreateRaffleModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (raffleAddress: string) => void;
}) {
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();

  // --- USDC decimals ---
  const usdcDecimals = useReadContract({
    address: ADDR.usdc,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: true },
  });
  const d = Number(usdcDecimals.data ?? 6);

  // --- Fee percent (from deployer) ---
  const qPercent = useReadContract({
    address: ADDR.deployer,
    abi: SINGLE_WINNER_DEPLOYER_ABI,
    functionName: "protocolFeePercent",
    query: { enabled: open },
  });
  const percent = qPercent.data ? Number(qPercent.data as bigint) : null;

  // --- Draft state (drives the editable card) ---
  const [draft, setDraft] = useState<EditableRaffleCardValue>({
    name: "My raffle",
    ticketPrice: "1",
    winningPot: "10",
    durationText: "1h",
    minTickets: "1",
    maxTickets: "",
    minPurchaseAmount: "1",
  });

  const [createdAddr, setCreatedAddr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset local state when modal re-opens
  useEffect(() => {
    if (!open) return;
    setCreatedAddr(null);
    setCopied(false);
  }, [open]);

  const errors = useMemo(() => {
    const e: Partial<Record<keyof EditableRaffleCardValue, string>> = {};

    if (!draft.name.trim()) e.name = "Name is required.";

    // ticketPrice / winningPot must parse > 0, but must not crash if user types letters
    const tpStr = (draft.ticketPrice ?? "").trim();
    const wpStr = (draft.winningPot ?? "").trim();

    if (!isNumericInput(tpStr)) e.ticketPrice = "Enter a number (ex: 1 or 0.5).";
    if (!isNumericInput(wpStr)) e.winningPot = "Enter a number (ex: 10 or 2.5).";

    const tp = safeNum(tpStr);
    const wp = safeNum(wpStr);
    if (isNumericInput(tpStr) && !(tp > 0)) e.ticketPrice = "Ticket price must be > 0.";
    if (isNumericInput(wpStr) && !(wp > 0)) e.winningPot = "Winning pot must be > 0.";

    const durSec = parseDurationToSeconds(draft.durationText);
    if (!durSec || durSec <= 0) e.durationText = "Enter a valid duration (ex: 90m or 1h30).";

    const minT = Math.floor(safeNum(draft.minTickets));
    if (!(minT > 0)) e.minTickets = "Min tickets must be at least 1.";

    return e;
  }, [draft]);

  // derived (contract-ready) — safe parsing (no throw)
  const parsed = useMemo(() => {
    const tp = safeParseUnits(draft.ticketPrice || "", d);
    const wp = safeParseUnits(draft.winningPot || "", d);

    const durSecRaw = parseDurationToSeconds(draft.durationText) ?? 0;

    // Cap duration to 10 years in seconds (same as before)
    const durationSecondsNum = clampInt(durSecRaw, 1, 60 * 60 * 24 * 365 * 10);
    const durationSeconds = BigInt(durationSecondsNum);

    const minT = BigInt(clampInt(Math.floor(safeNum(draft.minTickets) || 1), 1, 10_000_000));

    const maxTNum = Math.floor(safeNum(draft.maxTickets));
    const maxT = BigInt(draft.maxTickets ? clampInt(maxTNum, 0, 10_000_000) : 0);

    const minBuyRaw = clampInt(Math.floor(safeNum(draft.minPurchaseAmount) || 1), 1, 0xffffffff);
    const minBuyU32 = minBuyRaw;

    return { tp, wp, durationSeconds, minT, maxT, minBuyU32 };
  }, [draft, d]);

  const feePreview = useMemo(() => {
    if (percent === null) return null;
    const wp = parsed.wp;
    if (wp <= 0n) {
      return { percent, fee: "0", net: "0" };
    }
    const fee = (wp * BigInt(percent)) / BigInt(100);
    const net = wp - fee;
    return {
      percent,
      fee: formatUnits(fee, d),
      net: formatUnits(net, d),
    };
  }, [percent, parsed.wp, d]);

  // --- Allowance check (creator must approve USDC to the deployer for winningPot) ---
  const qAllowance = useReadContract({
    address: ADDR.usdc,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, ADDR.deployer] : undefined,
    query: { enabled: open && !!address },
  });
  const allowance = (qAllowance.data ?? 0n) as bigint;
  const needsApproval = isConnected && parsed.wp > 0n && allowance < parsed.wp;

  // --- tx ---
  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const tx = useWaitForTransactionReceipt({ hash: txHash });

  // Separate tx state for approve (so UI isn't confusing)
  const [approveHash, setApproveHash] = useState<`0x${string}` | null>(null);
  const approveTx = useWaitForTransactionReceipt({ hash: approveHash ?? undefined });

  // Reset approve state when modal re-opens
  useEffect(() => {
    if (!open) return;
    setApproveHash(null);
  }, [open]);

  const canSubmit =
    isConnected &&
    !needsApproval && // must approve first
    !isPending &&
    !tx.isLoading &&
    !approveTx.isLoading &&
    Object.keys(errors).length === 0 &&
    parsed.tp > 0n &&
    parsed.wp > 0n &&
    parsed.minT > 0n &&
    parsed.durationSeconds > 0n;

  async function onApprove() {
    const h = await writeContractAsync({
      address: ADDR.usdc,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ADDR.deployer, parsed.wp],
    });
    setApproveHash(h);
    return h;
  }

  async function onCreate() {
    setCreatedAddr(null);
    setCopied(false);

    const hash = await writeContractAsync({
      address: ADDR.deployer,
      abi: SINGLE_WINNER_DEPLOYER_ABI,
      functionName: "createSingleWinnerLottery",
      args: [
        draft.name.trim(),
        parsed.tp,
        parsed.wp,
        parsed.minT,
        parsed.maxT,
        parsed.durationSeconds,
        parsed.minBuyU32,
      ] as any,
    });

    return hash;
  }

  // When confirmed, extract created raffle address from receipt logs
  useEffect(() => {
    if (!tx.isSuccess || !txHash || !publicClient || createdAddr) return;

    (async () => {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

        const decoded = parseEventLogs({
          abi: SINGLE_WINNER_DEPLOYER_ABI as any,
          logs: receipt.logs,
          eventName: "LotteryDeployed",
        });

        // Prefer the log emitted by the deployer address (hardening)
        const fromDeployer =
          decoded.find((e: any) => String(e.address).toLowerCase() === ADDR.deployer.toLowerCase()) ?? decoded[0];

        const addr = (fromDeployer as any)?.args?.lottery ?? null;

        if (addr && typeof addr === "string") {
          const lower = addr.toLowerCase();
          setCreatedAddr(lower);
          onCreated(lower);
        }
      } catch {
        // ok
      }
    })();
  }, [tx.isSuccess, txHash, publicClient, createdAddr, onCreated]);

  const shareLink = createdAddr ? `${window.location.origin}/#raffle=${encodeURIComponent(createdAddr)}` : null;

  const approveBusy = approveTx.isLoading || isPending;
  const createBusy = tx.isLoading || isPending;

  return (
    <Modal open={open} onClose={onClose} title="Create raffle" width="wide" height="auto">
      {!isConnected ? (
        <div className="rounded-3xl bg-white/10 border border-white/15 p-5 text-white">
          <div className="font-black text-lg">Connect your wallet</div>
          <div className="mt-1 text-sm font-bold text-white/70">You need to connect to create a raffle.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
          {/* LEFT: Editable raffle card */}
          <EditableRaffleCard
            value={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            feePercent={feePreview?.percent ?? null}
            errors={errors}
            creatorLabel={address ? shortAddr(address) : undefined}
          />

          {/* RIGHT: Clean action panel */}
          <div className="rounded-3xl bg-white/10 border border-white/15 p-5 text-white h-fit">
            <div className="text-[11px] font-black text-white/70 uppercase tracking-wider">Prize breakdown</div>

            <div className="mt-3 rounded-3xl bg-white/10 border border-white/15 p-4">
              <div className="text-xs font-black text-white/70">Net prize (winner receives)</div>
              <div className="mt-2 text-4xl font-black text-white leading-none">
                {feePreview ? feePreview.net : "…"}{" "}
                <span className="text-sm font-black text-white/70">USDC</span>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/10 border border-white/15 px-4 py-3">
                <span className="text-[11px] font-bold text-white/60">Platform fee</span>
                <span className="text-sm font-black text-white">
                  {feePreview ? `${feePreview.fee} USDC` : "…"}
                </span>
              </div>

              <div className="mt-2 text-[11px] font-bold text-white/60">
                {feePreview ? `${feePreview.percent}% fee taken at payout.` : "Loading fee…"}
              </div>
            </div>

            {/* Approve step (shown only when needed) */}
            {needsApproval ? (
              <div className="mt-4 rounded-2xl bg-white/10 border border-white/15 p-3">
                <div className="text-xs font-black text-white/80">Approve USDC first</div>
                <div className="mt-1 text-[12px] font-bold text-white/60">
                  The deployer needs permission to transfer the winning pot ({formatUnits(parsed.wp, d)} USDC).
                </div>

                <button
                  onClick={onApprove}
                  disabled={approveBusy || Object.keys(errors).length > 0 || parsed.wp <= 0n}
                  type="button"
                  className={[
                    "mt-3 w-full rounded-2xl px-4 py-3 font-black transition-all",
                    "border border-white/15",
                    approveBusy || Object.keys(errors).length > 0 || parsed.wp <= 0n
                      ? "bg-white/10 text-white/45 cursor-not-allowed"
                      : "bg-white/15 hover:bg-white/20 text-white shadow-[0_12px_35px_rgba(255,255,255,0.08)] active:translate-y-0.5",
                  ].join(" ")}
                >
                  {approveTx.isLoading || isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="animate-spin" size={16} /> Confirm approve…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Sparkles size={16} /> Approve USDC
                    </span>
                  )}
                </button>

                {approveHash ? (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl bg-white/10 border border-white/15 p-3">
                    <div className="text-xs font-bold text-white/75">
                      {approveTx.isLoading
                        ? "Approval pending…"
                        : approveTx.isSuccess
                        ? "Approval confirmed"
                        : "Approval sent"}
                    </div>
                    <a
                      href={txUrl(String(approveHash))}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-black text-sky-200 hover:underline inline-flex items-center gap-1"
                    >
                      View <ExternalLink size={12} />
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              onClick={onCreate}
              disabled={!canSubmit}
              type="button"
              className={[
                "mt-4 w-full rounded-2xl px-4 py-3 font-black transition-all",
                "border border-white/15",
                !canSubmit
                  ? "bg-white/10 text-white/45 cursor-not-allowed"
                  : "bg-amber-300 hover:bg-amber-200 text-amber-950 shadow-[0_12px_35px_rgba(251,191,36,0.22)] active:translate-y-0.5",
              ].join(" ")}
            >
              {createBusy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} /> Confirm in wallet…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Sparkles size={16} /> Create raffle
                </span>
              )}
            </button>

            {/* tx status */}
            {txHash ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white/10 border border-white/15 p-3">
                <div className="text-xs font-bold text-white/75">
                  {tx.isLoading ? "Transaction pending…" : tx.isSuccess ? "Transaction confirmed" : "Transaction sent"}
                </div>
                <a
                  href={txUrl(String(txHash))}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-black text-sky-200 hover:underline inline-flex items-center gap-1"
                >
                  View <ExternalLink size={12} />
                </a>
              </div>
            ) : null}

            {shareLink ? (
              <div className="mt-3 rounded-2xl bg-white/10 border border-white/15 p-3">
                <div className="text-xs font-black text-white/70 uppercase tracking-wider">Share link</div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    className="w-fullR-full px-4 py-3 rounded-2xl border border-white/15 bg-white/10 text-white font-black placeholder:text-white/50 outline-none"
                    value={shareLink}
                    readOnly
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(shareLink);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 900);
                    }}
                    className="shrink-0 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-3 text-white transition"
                    title="Copy link"
                    aria-label="Copy link"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <div className="mt-2 text-xs font-bold text-white/70">
                  Raffle: <span className="font-black text-white">{shortAddr(createdAddr || "")}</span>
                </div>
              </div>
            ) : null}

            {/* error hint */}
            {Object.keys(errors).length > 0 ? (
              <div className="mt-3 text-[12px] font-bold text-white/60">
                Fix required fields on the left to enable creation.
              </div>
            ) : needsApproval ? (
              <div className="mt-3 text-[12px] font-bold text-white/60">Approve USDC first to avoid estimation errors.</div>
            ) : (
              <div className="mt-3 text-[12px] font-bold text-white/60">
                Creating doesn’t pick a winner — the draw happens later.
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}