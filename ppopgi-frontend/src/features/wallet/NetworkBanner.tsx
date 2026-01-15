import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { etherlink } from "viem/chains";

export function NetworkBanner() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected) return null;
  if (chainId === etherlink.id) return null;

  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.40)",
        background: "rgba(255,255,255,0.20)",
        backdropFilter: "blur(14px)",
        padding: 12,
        display: "flex",
        alignItems: "center",
        gap: 12,
        justifyContent: "space-between",
      }}
    >
      <div style={{ fontWeight: 900 }}>
        You’re not playing on Etherlink yet.
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
          Switch to Etherlink to create or join raffles.
        </div>
      </div>

      <button
        onClick={() => switchChain?.({ chainId: etherlink.id })}
        disabled={isPending}
        style={{
          padding: "10px 12px",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.50)",
          background: "rgba(255,255,255,0.28)",
          cursor: isPending ? "not-allowed" : "pointer",
          fontWeight: 1000,
          whiteSpace: "nowrap",
        }}
      >
        {isPending ? "Switching…" : "Switch to Etherlink"}
      </button>
    </div>
  );
}