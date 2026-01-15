import { useMemo, useState } from "react";
import { Modal } from "../../ui/Modal";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ADDR, ERC20_ABI, SINGLE_WINNER_DEPLOYER_ABI } from "../../lib/contracts";
import { parseUnits, formatUnits } from "viem";

export function CreateRaffleModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (raffleAddress: string) => void;
}) {
  const { address, isConnected } = useAccount();

  // Read deployer config for transparency
  const cfg = useMemo(
    () => ({
      usdc: { fn: "usdc" as const, label: "Coins used" },
      entropy: { fn: "entropy" as const, label: "Randomness system" },
      entropyProvider: { fn: "entropyProvider" as const, label: "Randomness provider" },
      feeRecipient: { fn: "feeRecipient" as const, label: "Fee receiver" },
      protocolFeePercent: { fn: "protocolFeePercent" as const, label: "Ppopgi fee" },
    }),
    []
  );

  const usdcDecimals = useReadContract({
    address: ADDR.usdc,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: true },
  });
  const d = Number(usdcDecimals.data ?? 6);

  const qUsdc = useReadContract({
    address: ADDR.deployer,
    abi: SINGLE_WINNER_DEPLOYER_ABI,
    functionName: cfg.usdc.fn,
    query: { enabled: open },
  });
  const qEntropy = useReadContract({
    address: ADDR.deployer,
    abi: SINGLE_WINNER_DEPLOYER_ABI,
    functionName: cfg.entropy.fn,
    query: { enabled: open },
  });
  const qProvider = useReadContract({
    address: ADDR.deployer,
    abi: SINGLE_WINNER_DEPLOYER_ABI,
    functionName: cfg.entropyProvider.fn,
    query: { enabled: open },
  });
  const qFee = useReadContract({
    address: ADDR.deployer,
    abi: SINGLE_WINNER_DEPLOYER_ABI,
    functionName: cfg.feeRecipient.fn,
    query: { enabled: open },
  });
  const qPercent = useReadContract({
    address: ADDR.deployer,
    abi: SINGLE_WINNER_DEPLOYER_ABI,
    functionName: cfg.protocolFeePercent.fn,
    query: { enabled: open },
  });

  // Form
  const [name, setName] = useState("My raffle");
  const [ticketPrice, setTicketPrice] = useState("1"); // USDC
  const [winningPot, setWinningPot] = useState("10"); // USDC
  const [durationHours, setDurationHours] = useState("24");
  const [minTickets, setMinTickets] = useState("1");
  const [maxTickets, setMaxTickets] = useState(""); // optional
  const [minPurchaseAmount, setMinPurchaseAmount] = useState("1"); // USDC (anti-spam rule)

  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const tx = useWaitForTransactionReceipt({ hash: txHash });

  const canSubmit = isConnected && !isPending && !tx.isLoading;

  const percent = qPercent.data ? Number(qPercent.data as bigint) : null;

  async function onCreate() {
    const durationSeconds = BigInt(Math.max(1, Number(durationHours) || 1) * 3600);
    const minT = BigInt(Math.max(1, Number(minTickets) || 1));
    const maxT = maxTickets ? BigInt(Math.max(0, Number(maxTickets) || 0)) : BigInt(0);

    const tp = parseUnits(ticketPrice || "0", d);
    const wp = parseUnits(winningPot || "0", d);
    const minBuy = parseUnits(minPurchaseAmount || "1", d); // in USDC smallest units

    // NOTE: createSingleWinnerLottery returns the new address, but wagmi can't directly read return value from tx.
    // We'll read it from the transaction receipt logs later via the indexer or use the event in a later improvement.
    const hash = await writeContractAsync({
      address: ADDR.deployer,
      abi: SINGLE_WINNER_DEPLOYER_ABI,
      functionName: "createSingleWinnerLottery",
      args: [
        name,
        tp,
        wp,
        minT,
        maxT,
        durationSeconds,
        Number(formatUnits(minBuy, d)) >= 1 ? Number(minBuy) : Number(minBuy), // keep as uint32 in smallest units
      ] as any,
    });

    // Once mined, we’ll use the indexer on the home screen to find it.
    // For now, after confirm, just close and let you refresh.
    return hash;
  }

  return (
    <Modal open={open} onClose={onClose} title="Create">
      {!isConnected ? (
        <div style={{ fontWeight: 900, lineHeight: 1.6 }}>
          Sign in to create a raffle.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={panel()}>
            <div style={{ fontWeight: 1000, marginBottom: 8 }}>Defaults (set once)</div>
            <div style={{ display: "grid", gap: 6, fontSize: 13, opacity: 0.9 }}>
              <div>Coins used: {String(qUsdc.data ?? "…")}</div>
              <div>Randomness system: {String(qEntropy.data ?? "…")}</div>
              <div>Randomness provider: {String(qProvider.data ?? "…")}</div>
              <div>Fee receiver: {String(qFee.data ?? "…")}</div>
              <div>
                Ppopgi fee:{" "}
                {percent === null ? "…" : `${percent}%`}
              </div>
            </div>
          </div>

          <div style={panel()}>
            <div style={{ display: "grid", gap: 10 }}>
              <Field label="Name">
                <input value={name} onChange={(e) => setName(e.target.value)} style={input()} />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Ticket price (USDC)">
                  <input
                    value={ticketPrice}
                    onChange={(e) => setTicketPrice(e.target.value)}
                    style={input()}
                    inputMode="decimal"
                  />
                </Field>
                <Field label="Win amount (USDC)">
                  <input
                    value={winningPot}
                    onChange={(e) => setWinningPot(e.target.value)}
                    style={input()}
                    inputMode="decimal"
                  />
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <Field label="Duration (hours)">
                  <input
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                    style={input()}
                    inputMode="numeric"
                  />
                </Field>
                <Field label="Min tickets">
                  <input
                    value={minTickets}
                    onChange={(e) => setMinTickets(e.target.value)}
                    style={input()}
                    inputMode="numeric"
                  />
                </Field>
                <Field label="Max tickets (optional)">
                  <input
                    value={maxTickets}
                    onChange={(e) => setMaxTickets(e.target.value)}
                    style={input()}
                    inputMode="numeric"
                    placeholder="No limit"
                  />
                </Field>
              </div>

              <Field label="Minimum buy when not extending the latest range (USDC)">
                <input
                  value={minPurchaseAmount}
                  onChange={(e) => setMinPurchaseAmount(e.target.value)}
                  style={input()}
                  inputMode="decimal"
                />
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
                  This prevents tiny fragmented buys.
                </div>
              </Field>

              <button
                onClick={onCreate}
                disabled={!canSubmit}
                style={primaryBtn(!canSubmit)}
              >
                {isPending ? "Confirming…" : "Create raffle"}
              </button>

              {txHash && (
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  We’re confirming your raffle…
                </div>
              )}
              {tx.isSuccess && (
                <div style={{ fontWeight: 900 }}>
                  Created. It should appear on the home list soon.
                </div>
              )}
            </div>
          </div>

          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Creating does not pick a winner. The draw happens later.
          </div>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <div style={{ fontWeight: 900, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function panel(): React.CSSProperties {
  return {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.18)",
    backdropFilter: "blur(14px)",
    padding: 14,
  };
}

function input(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.40)",
    background: "rgba(255,255,255,0.22)",
    outline: "none",
    fontWeight: 900,
  };
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.50)",
    background: disabled ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.28)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 1000,
  };
}