// src/pages/DashboardPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { formatUnits } from "ethers";
import { RaffleCard } from "../components/RaffleCard";

import { useClaimableRaffles } from "../hooks/useClaimableRaffles";
import { useDashboardData } from "../hooks/useDashboardData";

import { getContract, prepareContractCall, readContract } from "thirdweb";
import { useSendAndConfirmTransaction } from "thirdweb/react";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";

type Props = {
  account: string | null;
  onOpenRaffle: (id: string) => void;
};

function fmtUsdc(raw: string) {
  try {
    return formatUnits(BigInt(raw || "0"), 6);
  } catch {
    return "0";
  }
}

function fmtNative(raw: string) {
  try {
    return formatUnits(BigInt(raw || "0"), 18);
  } catch {
    return "0";
  }
}

const RAFFLE_MIN_ABI = [
  { type: "function", name: "withdrawFunds", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "withdrawNative", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "claimTicketRefund", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

type MethodName = "withdrawFunds" | "withdrawNative" | "claimTicketRefund";

// ✅ Hatch ABI (minimal)
const RAFFLE_HATCH_ABI = [
  { type: "function", name: "drawingRequestedAt", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "forceCancelStuck", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

// seconds
const PRIVILEGED_HATCH_DELAY = 24 * 60 * 60;

function norm(a: string) {
  return a.trim().toLowerCase();
}

function nowSecFromMs(ms: number) {
  return Math.floor(ms / 1000);
}

function fmtCountdown(secLeft: number) {
  if (!Number.isFinite(secLeft)) return "Unknown";
  if (secLeft <= 0) return "Ready";

  const d = Math.floor(secLeft / 86400);
  const h = Math.floor((secLeft % 86400) / 3600);
  const m = Math.floor((secLeft % 3600) / 60);
  const s = Math.floor(secLeft % 60);

  const pad2 = (x: number) => String(x).padStart(2, "0");
  return d > 0 ? `${d}d ${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function hasAnyClaimable(it: any) {
  try {
    const usdc = BigInt(it?.claimableUsdc || "0");
    const nat = BigInt(it?.claimableNative || "0");
    return usdc > 0n || nat > 0n;
  } catch {
    return false;
  }
}

export function DashboardPage({ account, onOpenRaffle }: Props) {
  const dash = useDashboardData(account, 250);
  const claim = useClaimableRaffles(account, 250);

  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();

  const [msg, setMsg] = useState<string | null>(null);

  // ✅ optimistic hide after successful claim (prevents “still showing after claim”)
  const [hiddenClaimables, setHiddenClaimables] = useState<Record<string, boolean>>({});

  // ✅ shared clock for all cards + countdowns
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const created = dash.created ?? null;
  const joined = dash.joined ?? null;

  const claimablesRaw = claim.items ?? null;

  // ✅ filter: hide items we've claimed + hide zero-amount rows
  const claimables = useMemo(() => {
    if (!claimablesRaw) return null;
    return claimablesRaw
      .filter((it: any) => {
        const id = String(it?.raffle?.id || "");
        if (!id) return false;
        if (hiddenClaimables[id]) return false;
        return hasAnyClaimable(it) || !!it?.roles?.participated;
      })
      .sort((a: any, b: any) => {
        const Au = BigInt(a?.claimableUsdc || "0");
        const Bu = BigInt(b?.claimableUsdc || "0");
        if (Au !== Bu) return Au > Bu ? -1 : 1;

        const An = BigInt(a?.claimableNative || "0");
        const Bn = BigInt(b?.claimableNative || "0");
        if (An !== Bn) return An > Bn ? -1 : 1;

        return String(a?.raffle?.id || "").localeCompare(String(b?.raffle?.id || ""));
      });
  }, [claimablesRaw, hiddenClaimables]);

  // ───────────────── Hatch: rely on-chain drawingRequestedAt (+ 24h) ─────────────────

  // raffleId -> drawingRequestedAt (seconds, as string)
  const [drawingAtById, setDrawingAtById] = useState<Record<string, string>>({});
  const [hatchNoteById, setHatchNoteById] = useState<Record<string, string>>({});
  const [hatchBusyById, setHatchBusyById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!account) {
        setDrawingAtById({});
        setHatchNoteById({});
        return;
      }
      if (!created) return;

      const me = norm(account);

      const targets = created
        .filter((r: any) => norm(String(r?.creator || "")) === me)
        .map((r: any) => String(r.id))
        .filter(Boolean);

      if (!targets.length) return;

      const missing = targets.filter((id) => !(id in drawingAtById));
      if (!missing.length) return;

      try {
        const reads = await Promise.all(
          missing.map(async (raffleId) => {
            try {
              const raffleContract = getContract({
                client: thirdwebClient,
                chain: ETHERLINK_CHAIN,
                address: raffleId,
                abi: RAFFLE_HATCH_ABI,
              });

              const v = await readContract({
                contract: raffleContract,
                method: "drawingRequestedAt",
                params: [] as const,
              });

              return { raffleId, ok: true as const, v: String(v) };
            } catch (e: any) {
              return { raffleId, ok: false as const, err: String(e?.message || e) };
            }
          })
        );

        if (!alive) return;

        setDrawingAtById((prev) => {
          const next = { ...prev };
          for (const r of reads) {
            if (r.ok) next[r.raffleId] = r.v; // store even "0"
            else next[r.raffleId] = "0"; // mark as read -> prevents infinite re-reads
          }
          return next;
        });

        setHatchNoteById((prev) => {
          const next = { ...prev };
          for (const r of reads) {
            if (!r.ok) next[r.raffleId] = "Could not read hatch timer. Try Refresh.";
          }
          return next;
        });
      } catch {
        // ignore
      }
    }

    run();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, created, drawingAtById]);

  async function onHatch(raffleId: string) {
    setMsg(null);
    if (!account) {
      setMsg("Please sign in first.");
      return;
    }

    setHatchBusyById((p) => ({ ...p, [raffleId]: true }));
    setHatchNoteById((p) => ({ ...p, [raffleId]: "" }));

    try {
      const raffleContract = getContract({
        client: thirdwebClient,
        chain: ETHERLINK_CHAIN,
        address: raffleId,
        abi: RAFFLE_HATCH_ABI,
      });

      const tx = prepareContractCall({
        contract: raffleContract,
        method: "forceCancelStuck",
        params: [] as const,
      });

      await sendAndConfirm(tx);

      setMsg("Hatch triggered. This raffle should move to CANCELED shortly.");
      dash.refetch();
      claim.refetch();

      // force a re-read next refresh
      setDrawingAtById((p) => {
        const next = { ...p };
        delete next[raffleId];
        return next;
      });
    } catch (e: any) {
      const m = String(e?.message || "");
      if (m.toLowerCase().includes("rejected")) {
        setHatchNoteById((p) => ({ ...p, [raffleId]: "Action canceled." }));
      } else if (m.toLowerCase().includes("earlycancellationrequest") || m.toLowerCase().includes("locked")) {
        setHatchNoteById((p) => ({ ...p, [raffleId]: "Hatch is still locked. Wait for the countdown." }));
      } else {
        setHatchNoteById((p) => ({ ...p, [raffleId]: "Could not hatch right now. Please try again." }));
      }
    } finally {
      setHatchBusyById((p) => ({ ...p, [raffleId]: false }));
    }
  }

  // ✅ IMPORTANT: return null when NOT shown (fixes TS error)
  function hatchForRaffle(raffle: any) {
    if (!account) return null;

    const me = norm(account);
    const isCreator = norm(String(raffle?.creator || "")) === me;
    if (!isCreator) return null;

    const id = String(raffle?.id || "");
    if (!id) return null;

    // Only show once we've read it at least once
    if (!(id in drawingAtById)) return null;

    const drawAtSec = Number(drawingAtById[id] || "0");
    if (!Number.isFinite(drawAtSec) || drawAtSec <= 0) return null;

    const nowS = nowSecFromMs(nowMs);
    const unlockAt = drawAtSec + PRIVILEGED_HATCH_DELAY;
    const secLeft = unlockAt - nowS;
    const ready = secLeft <= 0;

    return {
      show: true,
      ready,
      label: ready ? "Hatch ready" : `Hatch in ${fmtCountdown(secLeft)}`,
      disabled: !ready || isPending || !!hatchBusyById[id],
      busy: isPending || !!hatchBusyById[id],
      note: hatchNoteById[id] || null,
      onClick: () => onHatch(id),
    } as const;
  }

  // ───────────────── Styles ─────────────────

  const section: React.CSSProperties = {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.55)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.10))," +
      "radial-gradient(900px 220px at 15% 0%, rgba(255,141,187,0.10), rgba(255,141,187,0) 55%)," +
      "radial-gradient(900px 220px at 85% 0%, rgba(203,183,246,0.10), rgba(203,183,246,0) 55%)",
    boxShadow: "0 16px 34px rgba(0,0,0,0.12)",
    backdropFilter: "blur(10px)",
  };

  const grid: React.CSSProperties = { marginTop: 12, display: "grid", gap: 12 };

  const pill: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(255,255,255,0.78)",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
    color: "#4A0F2B",
    fontWeight: 950,
    fontSize: 12,
    whiteSpace: "nowrap",
  };

  const actionBtn: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.82)",
    borderRadius: 14,
    padding: "12px 12px",
    cursor: "pointer",
    fontWeight: 1000,
    color: "#4A0F2B",
    width: "100%",
  };

  const actionBtnDisabled: React.CSSProperties = { ...actionBtn, opacity: 0.55, cursor: "not-allowed" };

  const subCard: React.CSSProperties = {
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.55)",
    background: "rgba(255,255,255,0.20)",
    display: "grid",
    gap: 10,
  };

  async function callRaffleTx(raffleId: string, method: MethodName) {
    setMsg(null);

    if (!account) {
      setMsg("Please sign in first.");
      return;
    }

    try {
      const raffleContract = getContract({
        client: thirdwebClient,
        chain: ETHERLINK_CHAIN,
        address: raffleId,
        abi: RAFFLE_MIN_ABI,
      });

      const tx = prepareContractCall({ contract: raffleContract, method, params: [] as const });
      await sendAndConfirm(tx);

      setHiddenClaimables((prev) => ({ ...prev, [raffleId]: true }));

      setMsg("Done. Your claim will disappear shortly.");
      claim.refetch();
    } catch (e: any) {
      const m = String(e?.message || "");
      if (m.toLowerCase().includes("rejected")) setMsg("Action canceled.");
      else setMsg("Could not complete this action right now.");
    }
  }

  function renderClaimableItem(it: any) {
    const raffle = it.raffle;

    const hasUsdc = BigInt(it.claimableUsdc || "0") > 0n;
    const hasNative = BigInt(it.claimableNative || "0") > 0n;

    const statusLine =
      hasUsdc || hasNative
        ? "You have funds available to claim."
        : it.roles?.participated
          ? "You may have a refundable ticket (if the raffle was canceled)."
          : "Nothing to claim right now.";

    return (
      <div key={raffle.id}>
        <RaffleCard raffle={raffle} onOpen={onOpenRaffle} nowMs={nowMs} />

        <div style={subCard}>
          <div style={{ fontSize: 13, opacity: 0.92, color: "#4A0F2B", fontWeight: 900 }}>{statusLine}</div>

          <div style={{ fontSize: 13, opacity: 0.92, color: "#4A0F2B" }}>
            Claimable USDC: <b>{fmtUsdc(it.claimableUsdc)} USDC</b> • Claimable native:{" "}
            <b>{fmtNative(it.claimableNative)}</b>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button
              style={hasUsdc && !isPending ? actionBtn : actionBtnDisabled}
              disabled={!hasUsdc || isPending}
              onClick={() => callRaffleTx(raffle.id, "withdrawFunds")}
            >
              {isPending ? "Confirming…" : "Withdraw USDC"}
            </button>

            <button
              style={hasNative && !isPending ? actionBtn : actionBtnDisabled}
              disabled={!hasNative || isPending}
              onClick={() => callRaffleTx(raffle.id, "withdrawNative")}
            >
              {isPending ? "Confirming…" : "Withdraw native"}
            </button>
          </div>

          {it.roles?.participated && (
            <button
              style={!isPending ? actionBtn : actionBtnDisabled}
              disabled={isPending}
              onClick={() => callRaffleTx(raffle.id, "claimTicketRefund")}
              title="Only works if a ticket refund is actually available on-chain."
            >
              {isPending ? "Confirming…" : "Claim ticket refund"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, color: "#4A0F2B" }}>Dashboard</h2>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, opacity: 0.85, color: "#4A0F2B" }}>{account ? "Your activity" : "Sign in required"}</div>

          <button
            style={pill}
            onClick={() => {
              setMsg(null);
              setHiddenClaimables({});
              setDrawingAtById({});
              setHatchNoteById({});
              dash.refetch();
              claim.refetch();
            }}
            disabled={isPending}
            title="Refresh data"
          >
            Refresh
          </button>
        </div>
      </div>

      {(dash.note || claim.note) && (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9, color: "#4A0F2B" }}>{dash.note || claim.note}</div>
      )}
      {msg && (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.95, color: "#4A0F2B", fontWeight: 900 }}>{msg}</div>
      )}

      <div style={section}>
        <div style={{ fontWeight: 1000, color: "#4A0F2B" }}>Your created raffles</div>
        <div style={grid}>
          {!created && <div style={{ opacity: 0.85, fontSize: 13, color: "#4A0F2B" }}>Loading…</div>}
          {created && created.length === 0 && (
            <div style={{ opacity: 0.85, fontSize: 13, color: "#4A0F2B" }}>No created raffles yet.</div>
          )}
          {created?.map((raffle) => (
            <div key={raffle.id}>
              <RaffleCard raffle={raffle} onOpen={onOpenRaffle} nowMs={nowMs} hatch={hatchForRaffle(raffle)} />
            </div>
          ))}
        </div>
      </div>

      <div style={section}>
        <div style={{ fontWeight: 1000, color: "#4A0F2B" }}>Raffles you joined</div>
        <div style={grid}>
          {!joined && <div style={{ opacity: 0.85, fontSize: 13, color: "#4A0F2B" }}>Loading…</div>}
          {joined && joined.length === 0 && (
            <div style={{ opacity: 0.85, fontSize: 13, color: "#4A0F2B" }}>You haven’t joined any raffles yet.</div>
          )}
          {joined?.map((raffle) => (
            <div key={raffle.id}>
              <RaffleCard raffle={raffle} onOpen={onOpenRaffle} nowMs={nowMs} />
            </div>
          ))}
        </div>
      </div>

      <div style={section}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
          <div style={{ fontWeight: 1000, color: "#4A0F2B" }}>Claimables</div>
          <div style={{ fontSize: 12, opacity: 0.85, color: "#4A0F2B" }}>{claimables ? `${claimables.length} items` : "…"}</div>
        </div>

        <div style={grid}>
          {!claimables && <div style={{ opacity: 0.85, fontSize: 13, color: "#4A0F2B" }}>Loading…</div>}
          {claimables && claimables.length === 0 && (
            <div style={{ opacity: 0.85, fontSize: 13, color: "#4A0F2B" }}>Nothing to claim right now.</div>
          )}
          {claimables?.map(renderClaimableItem)}
        </div>
      </div>
    </div>
  );
}