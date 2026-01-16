// src/features/create/CreateRaffleModal.tsx
import React, { useMemo, useState, useEffect } from "react";
import { Modal } from "../../ui/Modal";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { parseUnits, formatUnits, isAddress } from "viem";
import { Shield, ExternalLink, Loader2, Sparkles, Copy, Check } from "lucide-react";

import { ADDR, ERC20_ABI, SINGLE_WINNER_DEPLOYER_ABI } from "../../lib/contracts";
import { addrUrl, txUrl } from "../../lib/explorer";

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

export function CreateRaffleModal({
  open,
  onClose,
  onCreated,
  onOpenSafety,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (raffleAddress: string) => void;
  onOpenSafety?: () => void;
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

  // --- Deployer config reads ---
  const qUsdc = useReadContract({
    address: ADDR.deployer,
    abi: SINGLE_WINNER_DEPLOYER_ABI,
    functionName: "usdc",
    query: { enabled: open },
  });
  const qEntropy = useReadContract({
    address: ADDR.deployer,
    abi: SINGLE_WINNER_DEPLOYER_ABI,
    functionName: "entropy",
    query: { enabled: open },
  });
  const qProvider = useReadContract({
    address: ADDR.deployer,
    abi: SINGLE_WINNER_DEPLOYER_ABI,
    functionName: "entropyProvider",
    query: { enabled: open },
  });
  const qFee = useReadContract({
    address: ADDR.deployer,
    abi: SINGLE_WINNER_DEPLOYER_ABI,
    functionName: "feeRecipient",
    query: { enabled: open },
  });
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
  const [durationHours, setDurationHours] = useState("24");
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

    const durationSeconds = BigInt(
      clampInt(Math.floor(safeNum(durationHours) || 1), 1, 24 * 365 * 10) * 3600
    );
    const minT = BigInt(clampInt(Math.floor(safeNum(minTickets) || 1), 1, 10_000_000));
    const maxTNum = Math.floor(safeNum(maxTickets));
    const maxT = BigInt(maxTickets ? clampInt(maxTNum, 0, 10_000_000) : 0);

    const minBuyRaw = clampInt(Math.floor(safeNum(minPurchaseAmount) || 1), 1, 0xffffffff);
    const minBuyU32 = minBuyRaw;

    return { tp, wp, durationSeconds, minT, maxT, minBuyU32 };
  }, [ticketPrice, winningPot, durationHours, minTickets, maxTickets, minPurchaseAmount, d]);

  const feePreview = useMemo(() => {
    if (percent === null) return null;
    const wp = parsed.wp;
    const fee = (wp * BigInt(percent)) / BigInt(100);
    const net = wp - fee;
    return {
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
    parsed.minT > 0n;

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
        // If the deployer doesn't emit LotteryCreated, we still show confirmed state.
      }
    })();
  }, [tx.isSuccess, txHash, publicClient, createdAddr, onCreated]);

  const configRows = [
    { label: "Coins used", v: qUsdc.data ? String(qUsdc.data) : "…" },
    { label: "Randomness system", v: qEntropy.data ? String(qEntropy.data) : "…" },
    { label: "Randomness provider", v: qProvider.data ? String(qProvider.data) : "…" },
    { label: "Fee receiver", v: qFee.data ? String(qFee.data) : "…" },
    { label: "Ppopgi fee", v: percent === null ? "…" : `${percent}%` },
  ];

  const shareLink = createdAddr ? `${window.location.origin}/#raffle=${encodeURIComponent(createdAddr)}` : null;

  return (
    <Modal open={open} onClose={onClose} title="Create Raffle">
      {!isConnected ? (
        <div className="font-black text-gray-800">Connect your wallet to create a raffle.</div>
      ) : (
        <div className="grid gap-4">
          {/* Safety/Proof header */}
          <div className="rounded-2xl border border-white/60 bg-white/20 backdrop-blur-md p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black text-gray-700/80 uppercase tracking-wider">
                  On-chain defaults
                </div>
                <div className="text-lg font-black text-gray-900 flex items-center gap-2">
                  Transparency <Shield size={16} />
                </div>
                <div className="text-xs font-bold text-gray-600 mt-1">
                  These come from your deployer contract.
                </div>
              </div>

              {onOpenSafety ? (
                <button
                  type="button"
                  onClick={onOpenSafety}
                  className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white/80 hover:bg-white border border-white/60 px-3 py-2 text-xs font-black text-gray-800 shadow-sm"
                >
                  <Shield size={14} /> Safety &amp; Proof
                </button>
              ) : null}
            </div>

            <div className="mt-3 grid gap-2 text-xs font-bold text-gray-700">
              {configRows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-3">
                  <span className="text-gray-600">{r.label}</span>
                  <span className="font-black text-gray-900">
                    {isAddress(String(r.v)) ? shortAddr(String(r.v)) : r.v}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {qFee.data ? (
                <a
                  className="inline-flex items-center gap-1 rounded-xl bg-white/70 hover:bg-white border border-white/60 px-3 py-2 text-xs font-black text-blue-700"
                  href={addrUrl(String(qFee.data))}
                  target="_blank"
                  rel="noreferrer"
                >
                  Fee receiver <ExternalLink size={12} />
                </a>
              ) : null}
              {qProvider.data ? (
                <a
                  className="inline-flex items-center gap-1 rounded-xl bg-white/70 hover:bg-white border border-white/60 px-3 py-2 text-xs font-black text-blue-700"
                  href={addrUrl(String(qProvider.data))}
                  target="_blank"
                  rel="noreferrer"
                >
                  Provider <ExternalLink size={12} />
                </a>
              ) : null}
            </div>
          </div>

          {/* Form */}
          <div className="rounded-2xl border border-white/60 bg-white/20 backdrop-blur-md p-4">
            <div className="grid gap-3">
              <Field label="Name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={input()}
                  placeholder="My raffle"
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              {feePreview ? (
                <div className="rounded-2xl bg-white/70 border border-white/60 p-3">
                  <div className="text-xs font-black text-gray-700 uppercase tracking-wider">
                    Fee preview
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm font-black text-gray-900">
                    <span>Platform fee</span>
                    <span>{feePreview.fee} USDC</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs font-bold text-gray-700">
                    <span>Net pot after fee</span>
                    <span className="font-black">{feePreview.net} USDC</span>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Duration (hours)">
                  <input
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                    className={input()}
                    inputMode="numeric"
                  />
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
                    placeholder="No limit"
                  />
                </Field>
              </div>

              <Field label="Minimum buy amount (raw)">
                <input
                  value={minPurchaseAmount}
                  onChange={(e) => setMinPurchaseAmount(e.target.value)}
                  className={input()}
                  inputMode="numeric"
                />
              </Field>

              <div className="rounded-2xl bg-white/60 border border-white/60 p-3 text-xs font-bold text-gray-700">
                <div className="flex items-center justify-between gap-2">
                  <span>Creator</span>
                  <span className="font-black">{address ? shortAddr(address) : "—"}</span>
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
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 border border-white/60 p-3">
                  <div className="text-xs font-bold text-gray-700">
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
                    className="text-xs font-black text-blue-700 hover:underline inline-flex items-center gap-1"
                  >
                    View <ExternalLink size={12} />
                  </a>
                </div>
              ) : null}

              {tx.isSuccess ? (
                <div className="rounded-2xl bg-green-50 border border-green-200 p-3 text-sm font-black text-green-900">
                  Created. It should appear on the home list soon.
                </div>
              ) : null}

              {shareLink ? (
                <div className="rounded-2xl bg-white/80 border border-white/60 p-3">
                  <div className="text-xs font-black text-gray-700 uppercase tracking-wider">
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
                      className="shrink-0 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 px-3 py-3 text-gray-800 shadow-sm"
                      title="Copy link"
                      aria-label="Copy link"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                  <div className="mt-2 text-xs font-bold text-gray-600">
                    Raffle: <span className="font-black">{shortAddr(createdAddr || "")}</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="text-xs font-bold text-gray-700/80">
            Creating doesn’t pick a winner. The draw happens later.
          </div>
        </div>
      )}
    </Modal>
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
  return "w-full px-4 py-3 rounded-2xl border border-white/60 bg-white/25 backdrop-blur-md font-black text-gray-900 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-amber-400/60";
}

function primaryBtn(disabled: boolean) {
  return [
    "w-full rounded-2xl px-4 py-3 font-black shadow-lg transition-all",
    "border border-white/60",
    disabled
      ? "bg-white/30 text-gray-500 cursor-not-allowed"
      : "bg-amber-500 hover:bg-amber-600 text-white active:translate-y-0.5",
  ].join(" ");
}