// src/features/wallet/WalletPill.tsx
import { useAccount, useBalance, useReadContract } from "wagmi";
import { ADDR, ERC20_ABI } from "../../lib/contracts";
import { formatUnits } from "viem";

function fmt(n?: string) {
  if (!n) return "0";
  const [a, b] = n.split(".");
  if (!b) return a;
  return `${a}.${b.slice(0, 2)}`; // nicer in navbar
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

  const xtz = xtzBal.data ? fmt(xtzBal.data.formatted) : "0";

  const d = Number(usdcDecimals.data ?? 6);
  const usdc = usdcBal.data ? fmt(formatUnits(usdcBal.data as bigint, d)) : "0";

  return (
    <div className="hidden lg:block">
      <div className="flex flex-col gap-1 pl-1">
        <div className="w-40 bg-[#E8F5E9] text-green-700 px-2.5 py-1 rounded-md font-bold text-[10px] flex items-center justify-between border border-green-200 shadow-sm tracking-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-green-600">⚡</span>
            <span>Energy</span>
          </div>
          <span>{xtz} XTZ</span>
        </div>

        <div className="w-40 bg-[#FFF8E1] text-amber-700 px-2.5 py-1 rounded-md font-bold text-[10px] flex items-center justify-between border border-amber-200 shadow-sm tracking-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-amber-600">🪙</span>
            <span>Entry</span>
          </div>
          <span>{usdc} USDC</span>
        </div>
      </div>
    </div>
  );
}