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
import {
  ExternalLink,
  Loader2,
  Sparkles,
  Copy,
  Check,
  Ticket,
  Timer,
  Coins,
  ShieldCheck,
} from "lucide-react";

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

function fmtMoney(v?: string) {
  if (!v) return "0";
  const [a, b] = v.split(".");
  if (!b) return a;
  return `${a}.${b.slice(0, 4)}`;
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
  const [maxTickets, setMaxTickets] = useState(""); // optional => 0
  const [minPurchaseAmount, setMinPurchaseAmount] = useState("1"); // uint32 raw

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

    const v = clampInt(Math.floor(safeNum(durationValue) || 1), 1, 60 * 60 * 24 * 365 * 10);
    const secMul = unitToSeconds(durationUnit);

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
      pot: formatUnits(wp, d),
      ticket: formatUnits(parsed.tp, d),
    };
  }, [percent, parsed.wp, parsed.tp, d]);

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

  const shareLink = createdAddr
    ? `${window.location.origin}/#raffle=${encodeURIComponent(createdAddr)}`
    : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="solid"
      width="wide"
      height="auto"
      bodyClassName="p-0"
      header={
        <div className="bg-[#FFD700] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/90 border border-amber-200 flex items-center justify-center shadow-sm">
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

            <div className="hidden sm:block text-right">
              <div className="text-[11px] font-black text-amber-900/70 uppercase tracking-wider">
                Creator
              </div>
              <div className="mt-1 font-black text-amber-950">
                {address ? shortAddr(address) : "—"}
              </div>
            </div>
          </div>
        </div>
      }
    >
      <div className="p-6">
        {!isConnected ? (
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
            <div className="font-black text-lg text-gray-900">Connect your wallet</div>
            <div className="mt-1 text-sm font-bold text-gray-600">
              You need to connect to create a raffle.
            </div>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-5">
            {/* LEFT: form */}
            <div className="lg:col-span-3 grid gap-5">
              {/* Basics */}
              <Card title="Basics" subtitle="Name + economics" icon={<Coins size={16} />}>
                <div className="grid gap-3">
                  <Field label="Raffle name">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={input()}
                      placeholder="e.g. Weekend giveaway"
                    />
                  </Field>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Ticket price (USDC)">
                      <input
                        value={ticketPrice}
                        onChange={(e) => setTicketPrice(e.target.value)}
                        className={input()}
                        inputMode="decimal"
                      />
                    </Field>

                    <Field label="Winning pot (USDC)">
                      <input
                        value={winningPot}
                        onChange={(e) => setWinningPot(e.target.value)}
                        className={input()}
                        inputMode="decimal"
                      />
                    </Field>
                  </div>
                </div>
              </Card>

              {/* Rules */}
              <Card title="Rules" subtitle="Timing + limits" icon={<Timer size={16} />}>
                <div className="grid gap-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="Duration">
                      <div className="flex gap-2">
                        <input
                          value={durationValue}
                          onChange={(e) => setDurationValue(e.target.value)}
                          className={input()}
                          inputMode="numeric"
                        />
                        <select
                          value={durationUnit}
                          onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
                          className={select()}
                        >
                          <option value="seconds">sec</option>
                          <option value="minutes">min</option>
                          <option value="hours">hours</option>
                          <option value="days">days</option>
                        </select>
                      </div>
                      <div className="mt-1 text-[11px] font-bold text-gray-500">
                        Sent as seconds:{" "}
                        <span className="font-black text-gray-900">
                          {String(parsed.durationSeconds)}
                        </span>
                      </div>
                    </Field>

                    <Field label="Min tickets">
                      <input
                        value={minTickets}
                        onChange={(e) => setMinTickets(e.target.value)}
                        className={input()}
                        inputMode="numeric"
                      />
                    </Field>

                    <Field label="Max tickets (optional)">
                      <input
                        value={maxTickets}
                        onChange={(e) => setMaxTickets(e.target.value)}
                        className={input()}
                        inputMode="numeric"
                        placeholder="Empty = no limit"
                      />
                      <div className="mt-1 text-[11px] font-bold text-gray-500">
                        Empty or 0 means unlimited.
                      </div>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Min buy amount (raw uint32)">
                      <input
                        value={minPurchaseAmount}
                        onChange={(e) => setMinPurchaseAmount(e.target.value)}
                        className={input()}
                        inputMode="numeric"
                      />
                      <div className="mt-1 text-[11px] font-bold text-gray-500">
                        Must match what your contract expects.
                      </div>
                    </Field>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-[11px] font-black text-gray-700 uppercase tracking-wider">
                        Quick summary
                      </div>
                      <div className="mt-2 grid gap-1 text-sm font-bold text-gray-700">
                        <div>
                          Ticket:{" "}
                          <span className="font-black text-gray-900">
                            {ticketPrice || "0"} USDC
                          </span>
                        </div>
                        <div>
                          Pot:{" "}
                          <span className="font-black text-gray-900">
                            {winningPot || "0"} USDC
                          </span>
                        </div>
                        <div>
                          Duration:{" "}
                          <span className="font-black text-gray-900">
                            {durationValue || "0"} {durationUnit}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* RIGHT: live preview + actions */}
            <div className="lg:col-span-2 grid gap-5">
              <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 bg-gradient-to-r from-amber-100 to-yellow-50 border-b border-gray-200">
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2">
                      <ShieldCheck className="text-amber-700" size={18} />
                      <div className="text-sm font-black text-amber-950">Prize breakdown</div>
                    </div>
                    <div className="text-[11px] font-black text-amber-900/70">
                      {feePreview ? `${feePreview.percent}% fee` : "Loading…"}
                    </div>
                  </div>
                  <div className="mt-1 text-[12px] font-bold text-amber-900/70">
                    Winner receives net prize. Fee is taken at payout.
                  </div>
                </div>

                <div className="p-5 grid gap-3">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-[11px] font-black text-gray-600 uppercase tracking-wider">
                      Net prize
                    </div>
                    <div className="mt-1 text-3xl font-black text-gray-900 leading-none">
                      {feePreview ? fmtMoney(feePreview.net) : "…"}{" "}
                      <span className="text-sm font-black text-gray-500">USDC</span>
                    </div>
                    <div className="mt-2 text-[12px] font-bold text-gray-500">
                      Winning pot minus platform fee.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] font-black text-gray-600 uppercase tracking-wider">
                        Platform fee
                      </div>
                      <div className="text-[11px] font-bold text-gray-500">
                        {feePreview ? `${feePreview.percent}%` : ""}
                      </div>
                    </div>
                    <div className="mt-1 text-xl font-black text-gray-900">
                      {feePreview ? fmtMoney(feePreview.fee) : "…"}{" "}
                      <span className="text-xs font-black text-gray-500">USDC</span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] font-bold text-gray-600">
                      <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                        Ticket:{" "}
                        <span className="font-black text-gray-900">
                          {feePreview ? fmtMoney(feePreview.ticket) : "…"}
                        </span>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                        Pot:{" "}
                        <span className="font-black text-gray-900">
                          {feePreview ? fmtMoney(feePreview.pot) : "…"}
                        </span>
                      </div>
                    </div>
                  </div>

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
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                      <div className="text-xs font-bold text-gray-600">
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
                        className="text-xs font-black text-amber-700 hover:underline inline-flex items-center gap-1"
                      >
                        View <ExternalLink size={12} />
                      </a>
                    </div>
                  ) : null}

                  {tx.isSuccess ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-900">
                      Created. It should appear on the home list soon.
                    </div>
                  ) : null}

                  {shareLink ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-3">
                      <div className="text-[11px] font-black text-gray-600 uppercase tracking-wider">
                        Share link
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <input className={input()} value={shareLink} readOnly />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(shareLink);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 900);
                          }}
                          className="shrink-0 rounded-2xl border border-gray-200 bg-gray-50 hover:bg-gray-100 px-3 py-3 text-gray-900 transition"
                          title="Copy link"
                          aria-label="Copy link"
                        >
                          {copied ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                      <div className="mt-2 text-xs font-bold text-gray-600">
                        Raffle:{" "}
                        <span className="font-black text-gray-900">
                          {shortAddr(createdAddr || "")}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <div className="text-[12px] font-bold text-gray-500">
                    Creating doesn’t pick a winner — the draw happens later.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Card({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/70 rounded-t-3xl">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-700">
              {icon}
            </div>
            <div>
              <div className="text-sm font-black text-gray-900">{title}</div>
              {subtitle ? (
                <div className="text-[12px] font-bold text-gray-500">{subtitle}</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-black text-sm text-gray-900 mb-2">{label}</div>
      {children}
    </div>
  );
}

function input() {
  return [
    "w-full px-4 py-3 rounded-2xl",
    "border border-gray-200",
    "bg-white",
    "text-gray-900 font-black placeholder:text-gray-400",
    "outline-none focus:ring-2 focus:ring-amber-300/50 focus:border-amber-300",
  ].join(" ");
}

function select() {
  return [
    "shrink-0 px-3 py-3 rounded-2xl",
    "border border-gray-200",
    "bg-white",
    "text-gray-900 font-black",
    "outline-none focus:ring-2 focus:ring-amber-300/50 focus:border-amber-300",
  ].join(" ");
}

function primaryBtn(disabled: boolean) {
  return [
    "w-full rounded-2xl px-4 py-3 font-black transition-all",
    disabled
      ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
      : "bg-[#FFD700] hover:bg-amber-300 text-amber-950 border border-amber-200 shadow-[0_12px_35px_rgba(251,191,36,0.25)] active:translate-y-0.5",
  ].join(" ");
}