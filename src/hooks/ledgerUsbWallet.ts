// src/hooks/ledgerUsbWallet.ts
import { useCallback, useMemo, useState } from "react";
import TransportWebHID from "@ledgerhq/hw-transport-webhid";
import Eth from "@ledgerhq/hw-app-eth";
import { EIP1193 } from "thirdweb/wallets";
import type { ThirdwebClient } from "thirdweb";
import type { Chain } from "thirdweb/chains";

/**
 * Minimal EIP-1193 provider backed by Ledger (USB / WebHID).
 * NOTE: account + chain id supported. Signing can be added later.
 */
async function createLedgerEip1193Provider(chainId: number) {
  const transport = await TransportWebHID.create();
  const eth = new Eth(transport);

  const derivationPath = "44'/60'/0'/0/0";
  const { address } = await eth.getAddress(derivationPath, false, true);

  const hexChainId = `0x${chainId.toString(16)}`;

  return {
    async request({ method, params }: { method: string; params?: any[] }) {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [address];

        case "eth_chainId":
          return hexChainId;

        case "wallet_switchEthereumChain": {
          const [{ chainId: requested }] = params ?? [];
          if (requested && requested !== hexChainId) {
            throw new Error("Ledger USB: requested chain not supported here.");
          }
          return null;
        }

        // Not implemented yet
        case "eth_sendTransaction":
        case "personal_sign":
        case "eth_signTypedData_v4":
          throw new Error("Ledger USB signing not enabled yet. Use MetaMask+Ledger to sign.");

        default:
          throw new Error(`Unsupported method: ${method}`);
      }
    },
  };
}

export function useLedgerUsbWallet() {
  const isSupported = useMemo(() => {
    return typeof window !== "undefined" && typeof (navigator as any)?.hid !== "undefined";
  }, []);

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  const connectLedgerUsb = useCallback(
    async (opts: { client: ThirdwebClient; chain: Chain }) => {
      setError("");
      if (!isSupported) throw new Error("WebHID not supported. Use Chrome/Edge/Brave.");

      setIsConnecting(true);
      try {
        // Create a thirdweb wallet wrapper around our EIP-1193 provider
        const wallet = EIP1193.fromProvider({
          // use a known id to avoid any registry lookups
          walletId: "injected",
          provider: async () => createLedgerEip1193Provider(opts.chain.id),
        });

        // ✅ IMPORTANT: actually connect the wallet so it has an active account
        await wallet.connect({
          client: opts.client,
          chain: opts.chain,
        });

        return wallet;
      } catch (e: any) {
        const msg = e?.message ? String(e.message) : "Failed to connect Ledger via USB.";
        setError(msg);
        throw e;
      } finally {
        setIsConnecting(false);
      }
    },
    [isSupported]
  );

  return { isSupported, isConnecting, error, connectLedgerUsb };
}