// src/hooks/useFactoryConfig.ts
import { useEffect, useState } from "react";
import { Contract, JsonRpcProvider } from "ethers";
import SingleWinnerDeployerAbi from "../config/abis/SingleWinnerDeployerV2.json";

// ✅ Use your existing canonical addresses file
// If your export name differs, adjust this import only.
import {ADDRESSES} from "../config/contracts";

export type FactoryConfig = {
  usdc: string;
  entropy: string;
  entropyProvider: string;
  feeRecipient: string;
  protocolFeePercent: string;
};

function mustEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (!v) throw new Error(`MISSING_ENV_${name}`);
  return v;
}

export function useFactoryConfig(open: boolean) {
  const [data, setData] = useState<FactoryConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setNote(null);
      return;
    }

    let alive = true;

    (async () => {
      setLoading(true);
      setNote(null);

      try {
        const rpcUrl = mustEnv("VITE_ETHERLINK_RPC_URL");
        const rpc = new JsonRpcProvider(rpcUrl);

        const d = new Contract(ADDRESSES.SingleWinnerDeployer, SingleWinnerDeployerAbi, rpc);

        const [usdc, entropy, entropyProvider, feeRecipient, protocolFeePercent] =
          await Promise.all([
            d.usdc(),
            d.entropy(),
            d.entropyProvider(),
            d.feeRecipient(),
            d.protocolFeePercent(),
          ]);

        if (!alive) return;

        setData({
          usdc: String(usdc),
          entropy: String(entropy),
          entropyProvider: String(entropyProvider),
          feeRecipient: String(feeRecipient),
          protocolFeePercent: protocolFeePercent.toString(),
        });
      } catch {
        if (!alive) return;
        setData(null);
        setNote("Could not load the create settings right now. Please try again.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open]);

  return { data, loading, note };
}