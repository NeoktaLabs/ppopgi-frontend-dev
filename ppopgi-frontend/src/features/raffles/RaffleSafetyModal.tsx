// src/features/raffles/RaffleSafetyModal.tsx
import React, { useMemo } from "react";
import { Modal } from "../../ui/Modal";
import {
  Shield,
  BadgeCheck,
  AlertTriangle,
  ExternalLink,
  Copy,
  Info,
} from "lucide-react";

import { ADDR } from "../../lib/contracts";
import { addrUrl, txUrl } from "../../lib/explorer";

function shortAddr(a?: string | null) {
  if (!a) return "—";
  const s = String(a);
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function lower(a?: string | null) {
  return (a ?? "").toLowerCase();
}

function pillClass(tone: "ok" | "warn") {
  const base =
    "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black border shadow-sm";
  return tone === "ok"
    ? `${base} bg-green-100 text-green-800 border-green-200`
    : `${base} bg-amber-100 text-amber-900 border-amber-200`;
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

export function RaffleSafetyModal({
  open,
  onClose,
  raffleId,
  raffle,
}: {
  open: boolean;
  onClose: () => void;
  raffleId: string | null;
  raffle?: {
    deployer?: string | null;
    registry?: string | null;
    isRegistered?: boolean;
    creationTx?: string | null;
    creator?: string | null;
  } | null;
}) {
  const dep = lower(raffle?.deployer);
  const reg = lower(raffle?.registry);
  const isRegistered = raffle?.isRegistered === true;

  const matchesDeployer = !!dep && dep === ADDR.deployer.toLowerCase();
  const matchesRegistry = !!reg && reg === ADDR.registry.toLowerCase();

  const hasVerificationData =
    !!raffle?.deployer ||
    !!raffle?.registry ||
    raffle?.isRegistered !== undefined ||
    !!raffle?.creator;

  // "Official" = registered AND deployer matches AND registry matches (strongest, safest definition)
  const isOfficial = isRegistered && matchesDeployer && matchesRegistry;

  const reasons = useMemo(() => {
    const lines: { ok: boolean; text: string }[] = [];

    // Deployer check
    if (!raffle?.deployer) {
      lines.push({ ok: false, text: "Missing deployer data from subgraph." });
    } else if (matchesDeployer) {
      lines.push({ ok: true, text: "Deployer matches the official Ppopgi deployer." });
    } else {
      lines.push({ ok: false, text: "Deployer does not match the official Ppopgi deployer." });
    }

    // Registry check
    if (!raffle?.registry) {
      lines.push({ ok: false, text: "Missing registry data from subgraph." });
    } else if (matchesRegistry) {
      lines.push({ ok: true, text: "Registry matches the official registry." });
    } else {
      lines.push({ ok: false, text: "Registry does not match the official registry." });
    }

    // Registered flag
    if (raffle?.isRegistered === undefined) {
      lines.push({ ok: false, text: "Missing registered flag from subgraph." });
    } else if (isRegistered) {
      lines.push({ ok: true, text: "Raffle is registered in the registry." });
    } else {
      lines.push({ ok: false, text: "Raffle is not registered in the registry." });
    }

    return lines;
  }, [
    raffle?.deployer,
    raffle?.registry,
    raffle?.isRegistered,
    matchesDeployer,
    matchesRegistry,
    isRegistered,
  ]);

  const headline = isOfficial
    ? "Official raffle"
    : hasVerificationData
      ? "Unverified / use caution"
      : "Verification unavailable";

  const explainer = isOfficial
    ? "This raffle matches the official deployer + registry and is registered."
    : "This raffle does not match the official Ppopgi deployment signals. It may still function, but it was not created through the official Ppopgi site.";

  return (
    <Modal open={open} onClose={onClose} title="Safety & Proof">
      {!raffleId ? (
        <div className="font-black text-gray-800">No raffle selected.</div>
      ) : (
        <div className="grid gap-4">
          {/* HERO */}
          <div className="rounded-3xl border border-white/60 bg-white/20 backdrop-blur-md p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black text-gray-700/80 uppercase tracking-wider">
                  Verification
                </div>
                <div className="mt-1 text-lg font-black text-gray-900 flex items-center gap-2">
                  {headline} <Shield size={16} />
                </div>
                <div className="mt-1 text-xs font-bold text-gray-700/80">
                  {explainer}
                </div>
              </div>

              <div className="shrink-0">
                {isOfficial ? (
                  <span className={pillClass("ok")} title="Verified as official">
                    <BadgeCheck size={14} /> Official
                  </span>
                ) : (
                  <span className={pillClass("warn")} title="Unverified / use caution">
                    <AlertTriangle size={14} /> Unverified
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* CHECKS */}
          <div className="rounded-3xl bg-white/60 border border-white/60 p-4">
            <div className="font-black text-gray-900 mb-2 flex items-center gap-2">
              <Info size={16} /> What we checked
            </div>

            <ul className="text-sm font-bold text-gray-700 space-y-2">
              {reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-[2px]">
                    {r.ok ? (
                      <BadgeCheck size={16} className="text-green-700" />
                    ) : (
                      <AlertTriangle size={16} className="text-amber-700" />
                    )}
                  </span>
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>

            {!isOfficial ? (
              <div className="mt-3 text-xs font-bold text-gray-700/80">
                Showing unverified raffles is intentional — you can still inspect and
                interact, but you should use caution and verify links/addresses
                before sending funds.
              </div>
            ) : null}
          </div>

          {/* PROOF LINKS */}
          <div className="grid gap-2">
            <Row
              label="Raffle contract"
              value={shortAddr(raffleId)}
              href={addrUrl(raffleId)}
              copyValue={raffleId}
              right={
                isOfficial ? (
                  <span className={pillClass("ok")}>
                    <BadgeCheck size={14} /> Official
                  </span>
                ) : (
                  <span className={pillClass("warn")}>
                    <AlertTriangle size={14} /> Unverified
                  </span>
                )
              }
            />

            <Row
              label="Deployer"
              value={raffle?.deployer ? shortAddr(raffle.deployer) : "—"}
              href={raffle?.deployer ? addrUrl(String(raffle.deployer)) : undefined}
              copyValue={raffle?.deployer ? String(raffle.deployer) : undefined}
            />

            <Row
              label="Registry"
              value={raffle?.registry ? shortAddr(raffle.registry) : "—"}
              href={raffle?.registry ? addrUrl(String(raffle.registry)) : undefined}
              copyValue={raffle?.registry ? String(raffle.registry) : undefined}
            />

            {raffle?.creationTx ? (
              <Row
                label="Creation tx"
                value={shortAddr(raffle.creationTx)}
                href={txUrl(String(raffle.creationTx))}
                copyValue={String(raffle.creationTx)}
              />
            ) : null}

            {raffle?.creator ? (
              <Row
                label="Creator"
                value={shortAddr(raffle.creator)}
                href={addrUrl(String(raffle.creator))}
                copyValue={String(raffle.creator)}
              />
            ) : null}
          </div>
        </div>
      )}
    </Modal>
  );
}