// src/features/wallet/WalletPill.tsx
import { useAccount, useBalance, useReadContract } from "wagmi";
import { ADDR, ERC20_ABI } from "../../lib/contracts";
import { formatUnits } from "viem";

function fmt(n?: string) {
  if (!n) return "0";
  // keep it calm: max 4 decimals
  const [a, b] = n.split(".");
  if (!b) return a;
  return `${a}.${b.slice(0, 4)}`;
}

export function WalletPill() {
  const { address, isConnected, status } = useAccount();

  const xtzBal = useBalance({
    address,
    query: { enabled: !!address },
  });

  const usdcDecimals = useReadContract({
    address: ADDR.usdc,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: true },
  });

  const usdcBal = useReadContract({
    address: ADDR.usdc,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  if (!isConnected || status === "connecting") return null;

  const xtz = xtzBal.data ? fmt(xtzBal.data.formatted) : "…";

  const d = Number(usdcDecimals.data ?? 6);
  const usdc = usdcBal.data ? fmt(formatUnits(usdcBal.data as bigint, d)) : "…";

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <div style={chip()}>
        Energy: <span style={{ fontWeight: 1000 }}>{xtz}</span> XTZ
      </div>
      <div style={chip()}>
        Coins: <span style={{ fontWeight: 1000 }}>{usdc}</span> USDC
      </div>
    </div>
  );
}

function chip(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.45)",
    background: "rgba(255,255,255,0.20)",
    padding: "8px 12px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 13,
  };
}