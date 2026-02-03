// src/hooks/useCashierData.ts
import { useState, useCallback, useEffect, useMemo } from "react";
import { formatUnits } from "ethers";
import { useActiveAccount } from "thirdweb/react";
import { getContract, readContract } from "thirdweb";
import { getWalletBalance } from "thirdweb/wallets";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";

const USDC_ADDRESS = "0x796Ea11Fa2dD751eD01b53C372fFDB4AAa8f00F9";

// ✅ Helper: Format BigInt to string with Max 4 Decimals
function fmtMax4(raw: bigint, decimals: number) {
  try {
    const full = formatUnits(raw, decimals);
    // Split integer and fraction
    const [int, frac] = full.split(".");
    if (!frac) return int;
    // Slice fraction to max 4 chars
    const limitedFrac = frac.slice(0, 4);
    // Remove trailing zeros if you want clean look, or keep them. 
    // This approach keeps up to 4 digits: "10.123456" -> "10.1234"
    return limitedFrac ? `${int}.${limitedFrac}` : int;
  } catch {
    return "0";
  }
}

export function useCashierData(isOpen: boolean) {
  const activeAccount = useActiveAccount();
  const me = activeAccount?.address ?? null;

  const [xtz, setXtz] = useState<bigint | null>(null);
  const [usdc, setUsdc] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const usdcContract = useMemo(() => {
    return getContract({
      client: thirdwebClient,
      chain: ETHERLINK_CHAIN,
      address: USDC_ADDRESS,
    });
  }, []);

  const refresh = useCallback(async () => {
    setNote(null);
    if (!me) {
      setXtz(null); setUsdc(null);
      setNote("Sign in to see your balances.");
      return;
    }

    setLoading(true);
    try {
      const [native, token] = await Promise.all([
        getWalletBalance({ client: thirdwebClient, chain: ETHERLINK_CHAIN, address: me }),
        readContract({ contract: usdcContract, method: "function balanceOf(address) view returns (uint256)", params: [me] })
      ]);

      setXtz(BigInt((native as any).value ?? 0n));
      setUsdc(BigInt(token as any));
    } catch {
      setXtz(null); setUsdc(null);
      setNote("Could not load balances. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [me, usdcContract]);

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  return {
    state: { me, xtz, usdc, loading, note },
    actions: { refresh },
    // Pre-calculated display strings
    display: {
      xtz: xtz === null ? "—" : fmtMax4(xtz, 18),
      usdc: usdc === null ? "—" : fmtMax4(usdc, 6),
      shortAddr: me ? `${me.slice(0, 6)}…${me.slice(-4)}` : "Not signed in"
    }
  };
}
