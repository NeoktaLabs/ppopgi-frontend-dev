// src/features/create/CreateRaffleModal.tsx
import React, { useMemo, useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { ExternalLink, Loader2, Sparkles, Copy, Check, Ticket } from "lucide-react";

import { Modal } from "../../ui/Modal";
import { ADDR, ERC20_ABI, SINGLE_WINNER_DEPLOYER_ABI } from "../../lib/contracts";
import { txUrl } from "../../lib/explorer";

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

type DurationUnit = "seconds" | "minutes" | "hours" | "days";

function unitToSeconds(u: DurationUnit) {
  switch (u) {
    case "seconds":
      return 1;
    case "minutes":
      return 60;
    case "hours":
      return 3600;
    case "days":
      return 86400;
  }
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

  // --- form ---
  const [name, setName] = useState("My raffle");

  const [ticketPrice, setTicketPrice] = useState("1"); // USDC
  const [winningPot, setWinningPot] = useState("10"); // USDC

  const [durationValue, setDurationValue] = useState("24");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("hours");

  const [minTickets, setMinTickets] = useState("1");
  const [maxTickets, setMaxTickets] = useState(""); // optional

  const [minPurchaseAmount, setMinPurchaseAmount] = useState("1"); // uint32 raw

  const [createdAddr, setCreatedAddr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset local "created" state when modal re-opens
  useEffect(() => {
    if (!open) return;
    setCreatedAddr(null);
    setCopied(false);
  }, [open]);

  // derived
  const parsed = useMemo(() => {
    const tp = parseUnits(ticketPrice || "0", d);
    const wp = parseUnits(winningPot || "0", d);

    // duration
    const v = clampInt(Math.floor(safeNum(durationValue) || 1), 1, 60 * 60 * 24 * 365 * 10);
    const secMul = unitToSeconds(durationUnit);

    // Cap duration to 10 years in seconds
    const durationSecondsNum = clampInt(v * secMul, 1, 60 * 60 * 24 * 365 * 10);
    const durationSeconds = BigInt(durationSecondsNum);

    const minT = BigInt(clampInt(Math.floor(safeNum(minTickets) || 1), 1, 10_000_000));
    const maxTNum = Math.floor(safeNum(maxTickets));
    const maxT = BigInt(maxTickets ? clampInt(maxTNum, 0, 10_000_000) : 0);

    const minBuyRaw = clampInt(Math.floor(safeNum(minPurchaseAmount) || 1), 1, 0xffffffff);
    const minBuyU32 = minBuyRaw;

    return { tp, wp, durationSeconds, minT, maxT, minBuyU32 };
  }, [ticketPrice, winningPot, durationValue, durationUnit, minTickets, maxTickets, minPurchaseAmount, d]);

  const feePreview = useMemo(() => {
    if (percent === null) return null;
    const wp = parsed.wp;
    const fee = (wp * BigInt(percent)) / BigInt(100);
    const net = wp - fee;
    return {
      percent,
      fee: formatUnits(fee, d),
      net: formatUnits(net, d),
    };
  }, [percent, parsed.wp, d]);

  // --- tx ---
  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const tx = useWaitForTransactionReceipt({ hash: txHash });

  const canSubmit =
    isConnected &&
    !isPending &&
    !tx.isLoading &&
    name.trim().length > 0 &&
    parsed.tp > 0n &&
    parsed.wp > 0n &&
    parsed.minT > 0n &&
    parsed.durationSeconds > 0n;

  async function onCreate() {
    setCreatedAddr(null);
    setCopied(false);

    const hash = await writeContractAsync({
      address: ADDR.deployer,
      abi: SINGLE_WINNER_DEPLOYER_ABI,
      functionName: "createSingleWinnerLottery",
      args: [
        name.trim(),
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

  // When confirmed, extract created raffle address from the receipt logs
  useEffect(() => {
    if (!tx.isSuccess || !txHash || !publicClient || createdAddr) return;

    (async () => {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
        const event = publicClient.parseEventLogs({
          abi: SINGLE_WINNER_DEPLOYER_ABI as any,
          logs: receipt.logs,
          eventName: "LotteryCreated",
        })?.[0];

        const addr =
          (event as any)?.args?.lottery ||
          (event as any)?.args?.lotteryAddress ||
          (event as any)?.args?.addr ||
          null;

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

  return (
    <Modal open={open} onClose={onClose} title="Create raffle" width="wide" height="auto">
      {!isConnected ? (
        <div className="rounded-3xl bg-white/10 border border-white/20 p-5 text-white">
          <div className="font-black text-lg">Connect your wallet</div>
          <div className="mt-1 text-sm font-bold text-white/80">
            You need to connect to create a raffle.
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {/* Cashier-like header card */}
          <div className="rounded-3xl overflow-hidden border border-white/20">
            <div className="bg-[#FFD700] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-black text-amber-900/70 uppercase tracking-wider">
                    Create
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-md">
                      <Ticket className="text-amber-600" size={20} />
                    </div>
                    <div>
                      <div className="text-xl font-black text-amber-900 leading-tight">
                        New raffle
                      </div>
                      <div className="text-[12px] font-bold text-amber-900/80">
                        Set the rules, then deploy on-chain.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] font-black text-amber-900/70 uppercase tracking-wider">
                    Creator
                  </div>
                  <div className="mt-1 font-black text-amber-900">
                    {address ? shortAddr(address) : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Fee area (clean + readable) */}
            <div className="bg-white/10 backdrop-blur-md p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-black text-white/70 uppercase tracking-wider">
                  Prize breakdown
                </div>
                <div className="text-[11px] font-black text-white/60">
                  {feePreview ? `${feePreview.percent}% platform fee` : "Fee loading…"}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Net prize (big) */}
                <div className="md:col-span-2 rounded-3xl bg-white/10 border border-white/15 p-4">
                  <div className="text-xs font-black text-white/70">Net prize (winner receives)</div>
                  <div className="mt-2 text-3xl font-black text-white leading-none">
                    {feePreview ? feePreview.net : "…"}{" "}
                    <span className="text-sm font-black text-white/70">USDC</span>
                  </div>
                  <div className="mt-2 text-[12px] font-bold text-white/60">
                    Calculated from winning pot minus platform fee.
                  </div>
                </div>

                {/* Platform fee (smaller) */}
                <div className="rounded-3xl bg-white/10 border border-white/15 p-4">
                  <div className="text-xs font-black text-white/70">Platform fee</div>
                  <div className="mt-2 text-lg font-black text-white/90">
                    {feePreview ? feePreview.fee : "…"}{" "}
                    <span className="text-xs font-black text-white/60">USDC</span>
                  </div>
                  <div className="mt-2 text-[11px] font-bold text-white/55">
                    Taken from pot at payout.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="rounded-3xl bg-white/10 border border-white/20 p-5">
            <div className="grid gap-5">
              {/* Section: Basics */}
              <section>
                <div className="text-[11px] font-black text-white/70 uppercase tracking-wider">Basics</div>
                <div className="mt-3 grid gap-3">
                  <Field label="Raffle name">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputDark()}
                      placeholder="My raffle"
                    />
                  </Field>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Ticket price (USDC)">
                      <input
                        value={ticketPrice}
                        onChange={(e) => setTicketPrice(e.target.value)}
                        className={inputDark()}
                        inputMode="decimal"
                      />
                    </Field>

                    <Field label="Winning pot (USDC)">
                      <input
                        value={winningPot}
                        onChange={(e) => setWinningPot(e.target.value)}
                        className={inputDark()}
                        inputMode="decimal"
                      />
                    </Field>
                  </div>
                </div>
              </section>

              {/* Section: Timing */}
              <section className="pt-4 border-t border-white/15">
                <div className="text-[11px] font-black text-white/70 uppercase tracking-wider">Timing</div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Duration">
                    <div className="flex gap-2">
                      <input
                        value={durationValue}
                        onChange={(e) => setDurationValue(e.target.value)}
                        className={inputDark()}
                        inputMode="numeric"
                      />
                      <select
                        value={durationUnit}
                        onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
                        className={selectDark()}
                      >
                        <option value="seconds">sec</option>
                        <option value="minutes">min</option>
                        <option value="hours">hours</option>
                        <option value="days">days</option>
                      </select>
                    </div>
                    <div className="mt-1 text-[11px] font-bold text-white/60">
                      Sent to contract as seconds:{" "}
                      <span className="font-black text-white">{String(parsed.durationSeconds)}</span>
                    </div>
                  </Field>

                  <Field label="Min tickets">
                    <input
                      value={minTickets}
                      onChange={(e) => setMinTickets(e.target.value)}
                      className={inputDark()}
                      inputMode="numeric"
                    />
                  </Field>

                  <Field label="Max tickets (optional)">
                    <input
                      value={maxTickets}
                      onChange={(e) => setMaxTickets(e.target.value)}
                      className={inputDark()}
                      inputMode="numeric"
                      placeholder="No limit"
                    />
                  </Field>
                </div>
              </section>

              {/* Section: Purchase rules */}
              <section className="pt-4 border-t border-white/15">
                <div className="text-[11px] font-black text-white/70 uppercase tracking-wider">Purchase rules</div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Minimum buy amount (raw)">
                    <input
                      value={minPurchaseAmount}
                      onChange={(e) => setMinPurchaseAmount(e.target.value)}
                      className={inputDark()}
                      inputMode="numeric"
                    />
                    <div className="mt-1 text-[11px] font-bold text-white/60">
                      This is a uint32 raw value (as your contract expects).
                    </div>
                  </Field>

                  <div className="rounded-3xl bg-white/10 border border-white/15 p-4">
                    <div className="text-[11px] font-black text-white/70 uppercase tracking-wider">
                      Quick preview
                    </div>
                    <div className="mt-2 text-sm font-bold text-white/75">
                      Ticket price:{" "}
                      <span className="font-black text-white">{ticketPrice || "0"} USDC</span>
                    </div>
                    <div className="mt-1 text-sm font-bold text-white/75">
                      Winning pot:{" "}
                      <span className="font-black text-white">{winningPot || "0"} USDC</span>
                    </div>
                    <div className="mt-1 text-sm font-bold text-white/75">
                      Duration:{" "}
                      <span className="font-black text-white">
                        {durationValue || "0"} {durationUnit}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* CTA */}
              <section className="pt-1">
                <button
                  onClick={onCreate}
                  disabled={!canSubmit}
                  type="button"
                  className={primaryBtnDark(!canSubmit)}
                >
                  {isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="animate-spin" size={16} /> Confirm in wallet…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Sparkles size={16} /> Create raffle
                    </span>
                  )}
                </button>

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

                {tx.isSuccess ? (
                  <div className="mt-3 rounded-2xl bg-emerald-400/10 border border-emerald-300/20 p-3 text-sm font-black text-emerald-100">
                    Created. It should appear on the home list soon.
                  </div>
                ) : null}

                {shareLink ? (
                  <div className="mt-3 rounded-2xl bg-white/10 border border-white/15 p-3">
                    <div className="text-xs font-black text-white/70 uppercase tracking-wider">Share link</div>
                    <div className="mt-2 flex items-center gap-2">
                      <input className={inputDark()} value={shareLink} readOnly />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(shareLink);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 900);
                        }}
                        className="shrink-0 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-3 text-white shadow-sm"
                        title="Copy link"
                        aria-label="Copy link"
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                    <div className="mt-2 text-xs font-bold text-white/70">
                      Raffle:{" "}
                      <span className="font-black text-white">{shortAddr(createdAddr || "")}</span>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 text-[12px] font-bold text-white/70">
                  Creating doesn’t pick a winner. The draw happens later.
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-black text-sm text-white mb-2">{label}</div>
      {children}
    </div>
  );
}

function inputDark() {
  return [
    "w-full px-4 py-3 rounded-2xl",
    "border border-white/15",
    "bg-white/10",
    "backdrop-blur-md",
    "font-black text-white placeholder:text-white/50",
    "outline-none focus:ring-2 focus:ring-sky-300/40",
  ].join(" ");
}

function selectDark() {
  return [
    "shrink-0 px-3 py-3 rounded-2xl",
    "border border-white/15",
    "bg-white/10",
    "text-white font-black",
    "outline-none focus:ring-2 focus:ring-sky-300/40",
  ].join(" ");
}

function primaryBtnDark(disabled: boolean) {
  return [
    "w-full rounded-2xl px-4 py-3 font-black transition-all",
    "border border-white/15",
    disabled
      ? "bg-white/10 text-white/50 cursor-not-allowed"
      : "bg-sky-500 hover:bg-sky-600 text-white shadow-[0_10px_30px_rgba(56,189,248,0.25)] active:translate-y-0.5",
  ].join(" ");
}