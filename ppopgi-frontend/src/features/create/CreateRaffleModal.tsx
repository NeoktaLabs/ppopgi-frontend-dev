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

type DurationUnit = "minutes" | "hours" | "days";

function unitToSeconds(u: DurationUnit) {
  switch (u) {
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

  // duration: supports 90 minutes for 1h30
  const [durationValue, setDurationValue] = useState("24");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("hours");

  const [minTickets, setMinTickets] = useState("1");
  const [maxTickets, setMaxTickets] = useState(""); // optional

  // user-friendly label (still passed as uint32)
  const [minPurchaseAmount, setMinPurchaseAmount] = useState("1");

  const [createdAddr, setCreatedAddr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    const v = clampInt(Math.floor(safeNum(durationValue) || 1), 1, 60 * 24 * 365 * 10); // in chosen unit
    const secMul = unitToSeconds(durationUnit);

    const durationSecondsNum = clampInt(v * secMul, 60, 60 * 60 * 24 * 365 * 10); // min 60s
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

  const shareLink = createdAddr
    ? `${window.location.origin}/#raffle=${encodeURIComponent(createdAddr)}`
    : null;

  return (
    <Modal open={open} onClose={onClose} title="Create raffle" width="wide" height="auto">
      {!isConnected ? (
        <div className="rounded-3xl bg-white/10 border border-white/15 p-5 text-white">
          <div className="font-black text-lg">Connect your wallet</div>
          <div className="mt-1 text-sm font-bold text-white/70">
            You need to connect to create a raffle.
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {/* Banner */}
          <div className="rounded-3xl overflow-hidden border border-white/15 bg-white/10">
            <div className="p-5 bg-gradient-to-r from-amber-300/90 via-yellow-300/90 to-amber-200/90">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/90 rounded-2xl flex items-center justify-center shadow-sm">
                    <Ticket className="text-amber-700" size={22} />
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-amber-900/70 uppercase tracking-wider">
                      Create
                    </div>
                    <div className="mt-1 text-2xl font-black text-amber-950 leading-tight">
                      New raffle
                    </div>
                    <div className="mt-1 text-[12px] font-bold text-amber-950/70">
                      Set the rules, then deploy on-chain.
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] font-black text-amber-900/70 uppercase tracking-wider">
                    Creator
                  </div>
                  <div className="mt-1 font-black text-amber-950">
                    {address ? shortAddr(address) : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main layout: form + summary */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* LEFT: Form */}
            <div className="lg:col-span-3 rounded-3xl bg-white/10 border border-white/15 p-5">
              <div className="grid gap-6">
                {/* Basics */}
                <section className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-black text-white">Basics</div>
                    <div className="text-[11px] font-bold text-white/55">Name + pricing</div>
                  </div>

                  <Field label="Raffle name">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputSoft()}
                      placeholder="e.g. Weekly giveaway"
                    />
                  </Field>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Ticket price (USDC)">
                      <input
                        value={ticketPrice}
                        onChange={(e) => setTicketPrice(e.target.value)}
                        className={inputSoft()}
                        inputMode="decimal"
                      />
                    </Field>

                    <Field label="Winning pot (USDC)">
                      <input
                        value={winningPot}
                        onChange={(e) => setWinningPot(e.target.value)}
                        className={inputSoft()}
                        inputMode="decimal"
                      />
                    </Field>
                  </div>
                </section>

                {/* Rules */}
                <section className="grid gap-3 pt-5 border-t border-white/15">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-black text-white">Rules</div>
                    <div className="text-[11px] font-bold text-white/55">Duration + limits</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Duration">
                      <div className="flex gap-2">
                        <input
                          value={durationValue}
                          onChange={(e) => setDurationValue(e.target.value)}
                          className={[inputSoft(), "flex-1 min-w-0"].join(" ")}
                          inputMode="numeric"
                          placeholder="e.g. 90"
                        />
                        <select
                          value={durationUnit}
                          onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
                          className={selectSoft()}
                        >
                          <option value="minutes">min</option>
                          <option value="hours">hours</option>
                          <option value="days">days</option>
                        </select>
                      </div>
                      <div className="mt-1 text-[11px] font-bold text-white/55">
                        Tip: 1h30 = <span className="font-black text-white/80">90 min</span>
                      </div>
                    </Field>

                    <Field label="Minimum purchase">
                      <input
                        value={minPurchaseAmount}
                        onChange={(e) => setMinPurchaseAmount(e.target.value)}
                        className={inputSoft()}
                        inputMode="numeric"
                        placeholder="e.g. 1"
                      />
                      <div className="mt-1 text-[11px] font-bold text-white/55">
                        Minimum amount required to buy tickets.
                      </div>
                    </Field>
                  </div>

                  {/* aligned ticket limits */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Min tickets">
                      <input
                        value={minTickets}
                        onChange={(e) => setMinTickets(e.target.value)}
                        className={inputSoft()}
                        inputMode="numeric"
                      />
                    </Field>

                    <Field label="Max tickets (optional)">
                      <input
                        value={maxTickets}
                        onChange={(e) => setMaxTickets(e.target.value)}
                        className={inputSoft()}
                        inputMode="numeric"
                        placeholder="Leave empty for no limit"
                      />
                    </Field>
                  </div>
                </section>

                {/* Share link (after created) */}
                {shareLink ? (
                  <section className="pt-5 border-t border-white/15">
                    <div className="text-xs font-black text-white/70 uppercase tracking-wider">
                      Share link
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input className={inputSoft()} value={shareLink} readOnly />
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
                    <div className="mt-2 text-xs font-bold text-white/60">
                      Raffle: <span className="font-black text-white">{shortAddr(createdAddr || "")}</span>
                    </div>
                  </section>
                ) : null}
              </div>
            </div>

            {/* RIGHT: Summary / preview (sticky on desktop) */}
            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-24 grid gap-4">
                {/* Summary card */}
                <div className="rounded-3xl bg-white border border-amber-200 overflow-hidden shadow-sm">
                  <div className="p-4 bg-amber-50 border-b border-amber-200">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-black text-gray-900">Prize breakdown</div>
                      <div className="text-[11px] font-black text-amber-900/80">
                        {feePreview ? `${feePreview.percent}% fee` : "Loading…"}
                      </div>
                    </div>
                    <div className="mt-1 text-[12px] font-bold text-gray-600">
                      Winner receives net prize. Fee is taken at payout.
                    </div>
                  </div>

                  <div className="p-4 grid gap-3">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-[11px] font-black text-gray-500 uppercase tracking-wider">
                        Net prize
                      </div>
                      <div className="mt-1 text-3xl font-black text-gray-900 leading-none">
                        {feePreview ? feePreview.net : "…"}{" "}
                        <span className="text-sm font-black text-gray-500">USDC</span>
                      </div>
                      <div className="mt-2 text-[12px] font-bold text-gray-600">
                        Winning pot minus platform fee.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-black text-gray-500 uppercase tracking-wider">
                          Platform fee
                        </div>
                        <div className="text-[11px] font-black text-gray-400">
                          {feePreview ? `${feePreview.percent}%` : ""}
                        </div>
                      </div>
                      <div className="mt-1 text-lg font-black text-gray-900">
                        {feePreview ? feePreview.fee : "…"}{" "}
                        <span className="text-xs font-black text-gray-500">USDC</span>
                      </div>
                    </div>

                    {/* Useful summary (not tiny / not redundant) */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="text-[11px] font-black text-gray-500 uppercase tracking-wider">
                        Summary
                      </div>
                      <div className="mt-2 grid gap-1 text-sm font-bold text-gray-700">
                        <Row label="Ticket price" value={`${ticketPrice || "0"} USDC`} />
                        <Row label="Winning pot" value={`${winningPot || "0"} USDC`} />
                        <Row
                          label="Duration"
                          value={`${durationValue || "0"} ${durationUnit}`}
                        />
                        <Row label="Min tickets" value={`${minTickets || "0"}`} />
                        <Row
                          label="Max tickets"
                          value={maxTickets ? `${maxTickets}` : "No limit"}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA block */}
                <div className="rounded-3xl bg-white/10 border border-white/15 p-4">
                  <button
                    onClick={onCreate}
                    disabled={!canSubmit}
                    type="button"
                    className={primaryBtn(!canSubmit)}
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
                        {tx.isLoading
                          ? "Transaction pending…"
                          : tx.isSuccess
                            ? "Transaction confirmed"
                            : "Transaction sent"}
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

                  <div className="mt-3 text-[12px] font-bold text-white/60">
                    Creating doesn’t pick a winner — the draw happens later.
                  </div>
                </div>
              </div>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-gray-500">{label}</div>
      <div className="font-black text-gray-900">{value}</div>
    </div>
  );
}

/** Softer/brighter inputs so they don't look grey + dead */
function inputSoft() {
  return [
    "w-full px-4 py-3 rounded-2xl",
    "border border-white/18",
    "bg-white/15 hover:bg-white/20",
    "backdrop-blur-md",
    "font-black text-white placeholder:text-white/45",
    "outline-none focus:ring-2 focus:ring-amber-200/40",
  ].join(" ");
}

function selectSoft() {
  return [
    "shrink-0 px-3 py-3 rounded-2xl",
    "border border-white/18",
    "bg-white/15 hover:bg-white/20",
    "text-white font-black",
    "outline-none focus:ring-2 focus:ring-amber-200/40",
  ].join(" ");
}

function primaryBtn(disabled: boolean) {
  return [
    "w-full rounded-2xl px-4 py-3 font-black transition-all",
    "border border-white/15",
    disabled
      ? "bg-white/10 text-white/45 cursor-not-allowed"
      : "bg-amber-300 hover:bg-amber-200 text-amber-950 shadow-[0_12px_35px_rgba(251,191,36,0.22)] active:translate-y-0.5",
  ].join(" ");
}