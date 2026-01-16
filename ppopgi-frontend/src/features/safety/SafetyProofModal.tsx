// src/features/safety/SafetyProofModal.tsx
import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { isAddress } from "viem";
import { Shield, ExternalLink, Copy, CheckCircle2, AlertTriangle } from "lucide-react";

import { Modal } from "../../ui/Modal";
import { addrUrl } from "../../lib/explorer";
import {
  ADDR,
  LOTTERY_SINGLE_WINNER_ABI,
  SINGLE_WINNER_DEPLOYER_ABI,
} from "../../lib/contracts";

function shortAddr(a?: string | null) {
  if (!a) return "—";
  const s = String(a);
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function Row({
  label,
  value,
  href,
  copyValue,
  right,
}: {
  label: string;
  value: string;
  href?: string;
  copyValue?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 border border-white/60 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[11px] font-black text-gray-600 uppercase tracking-wider">
          {label}
        </div>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-2 font-black text-gray-900 hover:underline truncate"
            title={value}
          >
            <span className="truncate">{value}</span>
            <ExternalLink size={14} className="shrink-0 text-blue-700" />
          </a>
        ) : (
          <div className="mt-1 font-black text-gray-900 truncate" title={value}>
            {value}
          </div>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-2">
        {right}
        {copyValue ? (
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(copyValue)}
            className="p-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700"
            title="Copy"
            aria-label="Copy"
          >
            <Copy size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function SafetyProofModal({
  open,
  onClose,
  raffleId,
  creator,
}: {
  open: boolean;
  onClose: () => void;
  raffleId: string;
  creator?: string | null;
}) {
  const enabled = open && !!raffleId;

  // --- Deployer defaults (canonical)
  const dUsdc = useReadContract({
    address: ADDR.deployer,
    abi: SINGLE_WINNER_DEPLOYER_ABI,
    functionName: "usdc",
    query: { enabled: open },
  });
  const dEntropy = useReadContract({
    address: ADDR.deployer,
    abi: SINGLE_WINNER_DEPLOYER_ABI,
    functionName: "entropy",
    query: { enabled: open },
  });
  const dProvider = useReadContract({
    address: ADDR.deployer,
    abi: SINGLE_WINNER_DEPLOYER_ABI,
    functionName: "entropyProvider",
    query: { enabled: open },
  });
  const dFeeRecipient = useReadContract({
    address: ADDR.deployer,
    abi: SINGLE_WINNER_DEPLOYER_ABI,
    functionName: "feeRecipient",
    query: { enabled: open },
  });
  const dFeePercent = useReadContract({
    address: ADDR.deployer,
    abi: SINGLE_WINNER_DEPLOYER_ABI,
    functionName: "protocolFeePercent",
    query: { enabled: open },
  });

  // --- Raffle live reads (prove this raffle matches defaults)
  const rDeployer = useReadContract({
    address: raffleId as any,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "deployer",
    query: { enabled },
  });
  const rUsdc = useReadContract({
    address: raffleId as any,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "usdcToken",
    query: { enabled },
  });
  const rEntropy = useReadContract({
    address: raffleId as any,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "entropy",
    query: { enabled },
  });
  const rProvider = useReadContract({
    address: raffleId as any,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "entropyProvider",
    query: { enabled },
  });
  const rFeeRecipient = useReadContract({
    address: raffleId as any,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "feeRecipient",
    query: { enabled },
  });
  const rFeePercent = useReadContract({
    address: raffleId as any,
    abi: LOTTERY_SINGLE_WINNER_ABI,
    functionName: "protocolFeePercent",
    query: { enabled },
  });

  const deployerAddr = (rDeployer.data ? String(rDeployer.data) : "").toLowerCase();
  const isOfficial = deployerAddr && deployerAddr === ADDR.deployer.toLowerCase();

  const match = useMemo(() => {
    // if raffle reads missing, don’t claim mismatch
    const ru = rUsdc.data ? String(rUsdc.data).toLowerCase() : "";
    const re = rEntropy.data ? String(rEntropy.data).toLowerCase() : "";
    const rp = rProvider.data ? String(rProvider.data).toLowerCase() : "";
    const rr = rFeeRecipient.data ? String(rFeeRecipient.data).toLowerCase() : "";
    const rf = rFeePercent.data ? String(rFeePercent.data) : "";

    const du = dUsdc.data ? String(dUsdc.data).toLowerCase() : "";
    const de = dEntropy.data ? String(dEntropy.data).toLowerCase() : "";
    const dp = dProvider.data ? String(dProvider.data).toLowerCase() : "";
    const dr = dFeeRecipient.data ? String(dFeeRecipient.data).toLowerCase() : "";
    const df = dFeePercent.data ? String(dFeePercent.data) : "";

    const enoughRaffle = !!(ru && re && rp && rr && rf);
    const enoughDeployer = !!(du && de && dp && dr && df);

    if (!enoughRaffle || !enoughDeployer) return { known: false, ok: false };

    const ok =
      ru === du &&
      re === de &&
      rp === dp &&
      rr === dr &&
      rf === df;

    return { known: true, ok };
  }, [
    rUsdc.data,
    rEntropy.data,
    rProvider.data,
    rFeeRecipient.data,
    rFeePercent.data,
    dUsdc.data,
    dEntropy.data,
    dProvider.data,
    dFeeRecipient.data,
    dFeePercent.data,
  ]);

  const headerBadge = useMemo(() => {
    if (!isOfficial) {
      return (
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-gray-100 text-gray-800 border border-gray-200">
          <AlertTriangle size={14} /> Unverified deployer
        </span>
      );
    }
    if (!match.known) {
      return (
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-900 border border-blue-200">
          <Shield size={14} /> Official • Loading checks…
        </span>
      );
    }
    if (match.ok) {
      return (
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-green-100 text-green-900 border border-green-200">
          <CheckCircle2 size={14} /> Official • Matches defaults
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-200">
        <AlertTriangle size={14} /> Official • Config differs
      </span>
    );
  }, [isOfficial, match.known, match.ok]);

  return (
    <Modal open={open} onClose={onClose} title="Safety & Proof">
      <div className="grid gap-4">
        {/* Hero */}
        <div className="rounded-3xl border border-white/60 bg-white/20 backdrop-blur-md p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black text-gray-700/80 uppercase tracking-wider">
                On-chain proofs
              </div>
              <div className="mt-1 text-lg font-black text-gray-900 flex items-center gap-2">
                Shield Check <Shield size={16} />
              </div>
              <div className="mt-1 text-xs font-bold text-gray-700/80">
                This modal reads live contract values (not UI settings).
              </div>
            </div>
            <div className="shrink-0">{headerBadge}</div>
          </div>
        </div>

        {/* Proof links */}
        <div className="grid gap-2">
          <Row
            label="Raffle contract"
            value={shortAddr(raffleId)}
            href={addrUrl(raffleId)}
            copyValue={raffleId}
            right={
              isOfficial ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-black bg-green-100 text-green-900 border border-green-200">
                  <CheckCircle2 size={12} /> Official
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-black bg-gray-100 text-gray-800 border border-gray-200">
                  Unverified
                </span>
              )
            }
          />

          {creator && (
            <Row
              label="Creator"
              value={shortAddr(creator)}
              href={addrUrl(creator)}
              copyValue={creator}
            />
          )}

          <Row
            label="Deployer"
            value={
              rDeployer.isLoading
                ? "Loading…"
                : rDeployer.data
                  ? shortAddr(String(rDeployer.data))
                  : "—"
            }
            href={
              rDeployer.data && isAddress(String(rDeployer.data))
                ? addrUrl(String(rDeployer.data))
                : undefined
            }
            copyValue={rDeployer.data ? String(rDeployer.data) : undefined}
          />
        </div>

        {/* Defaults vs live values */}
        <div className="rounded-3xl border border-white/60 bg-white/20 backdrop-blur-md p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black text-gray-700/80 uppercase tracking-wider">
                Verified configuration
              </div>
              <div className="mt-1 text-base font-black text-gray-900">
                Randomness + Fees
              </div>
            </div>

            {match.known ? (
              match.ok ? (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-green-100 text-green-900 border border-green-200">
                  <CheckCircle2 size={14} /> OK
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-200">
                  <AlertTriangle size={14} /> Review
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-gray-100 text-gray-700 border border-gray-200">
                Loading…
              </span>
            )}
          </div>

          <div className="mt-3 grid gap-2">
            <ProofLine
              label="USDC token"
              deployerValue={dUsdc.data ? String(dUsdc.data) : undefined}
              raffleValue={rUsdc.data ? String(rUsdc.data) : undefined}
            />
            <ProofLine
              label="Entropy contract"
              deployerValue={dEntropy.data ? String(dEntropy.data) : undefined}
              raffleValue={rEntropy.data ? String(rEntropy.data) : undefined}
            />
            <ProofLine
              label="Entropy provider"
              deployerValue={dProvider.data ? String(dProvider.data) : undefined}
              raffleValue={rProvider.data ? String(rProvider.data) : undefined}
            />
            <ProofLine
              label="Fee recipient"
              deployerValue={dFeeRecipient.data ? String(dFeeRecipient.data) : undefined}
              raffleValue={rFeeRecipient.data ? String(rFeeRecipient.data) : undefined}
            />
            <ProofLine
              label="Platform fee percent"
              deployerValue={
                dFeePercent.data !== undefined ? `${String(dFeePercent.data)}%` : undefined
              }
              raffleValue={
                rFeePercent.data !== undefined ? `${String(rFeePercent.data)}%` : undefined
              }
              // fee percent isn't an address, keep as is
              isAddr={false}
            />
          </div>

          <div className="mt-3 text-xs font-bold text-gray-700/80">
            Tip: “Official” means this raffle’s <span className="font-black">deployer()</span> equals your known deployer address.
            “Matches defaults” means the live raffle config equals the deployer config.
          </div>
        </div>

        {/* Limits section (simple, honest) */}
        <div className="rounded-3xl bg-white/60 border border-white/60 p-4">
          <div className="font-black text-gray-900 mb-2">What the app cannot do</div>
          <ul className="text-sm font-bold text-gray-700 list-disc pl-5 space-y-1">
            <li>It cannot choose the winner (randomness is external + provable).</li>
            <li>It cannot change a raffle’s rules after it’s deployed.</li>
            <li>It cannot block refunds/claims owed by the contract.</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}

function ProofLine({
  label,
  deployerValue,
  raffleValue,
  isAddr = true,
}: {
  label: string;
  deployerValue?: string;
  raffleValue?: string;
  isAddr?: boolean;
}) {
  const d = deployerValue ? String(deployerValue) : "";
  const r = raffleValue ? String(raffleValue) : "";

  const dNorm = isAddr ? d.toLowerCase() : d;
  const rNorm = isAddr ? r.toLowerCase() : r;

  const known = !!(d && r);
  const ok = known ? dNorm === rNorm : false;

  const right = !known ? (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-black bg-gray-100 text-gray-700 border border-gray-200">
      Loading…
    </span>
  ) : ok ? (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-black bg-green-100 text-green-900 border border-green-200">
      <CheckCircle2 size={12} /> Match
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-200">
      <AlertTriangle size={12} /> Diff
    </span>
  );

  return (
    <div className="rounded-2xl bg-white/70 border border-white/60 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-black text-gray-600 uppercase tracking-wider">
            {label}
          </div>

          <div className="mt-1 text-xs font-bold text-gray-700">
            <span className="text-gray-500">Deployer:</span>{" "}
            {d ? (isAddr ? shortAddr(d) : d) : "…"}
          </div>

          <div className="mt-1 text-xs font-bold text-gray-700">
            <span className="text-gray-500">Raffle:</span>{" "}
            {r ? (isAddr ? shortAddr(r) : r) : "…"}
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {isAddr && d && isAddress(d) ? (
              <a
                className="inline-flex items-center gap-1 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 px-3 py-2 text-[11px] font-black text-blue-700"
                href={addrUrl(d)}
                target="_blank"
                rel="noreferrer"
              >
                Deployer link <ExternalLink size={12} />
              </a>
            ) : null}
            {isAddr && r && isAddress(r) ? (
              <a
                className="inline-flex items-center gap-1 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 px-3 py-2 text-[11px] font-black text-blue-700"
                href={addrUrl(r)}
                target="_blank"
                rel="noreferrer"
              >
                Raffle link <ExternalLink size={12} />
              </a>
            ) : null}
          </div>
        </div>

        <div className="shrink-0">{right}</div>
      </div>
    </div>
  );
}

function shortAddr(a: string) {
  const s = String(a);
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}