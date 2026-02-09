// src/hooks/ledgerUsbWallet.ts
import { useCallback, useMemo, useState } from "react";
import TransportWebHID from "@ledgerhq/hw-transport-webhid";
import Eth from "@ledgerhq/hw-app-eth";
import { EIP1193 } from "thirdweb/wallets";
import type { ThirdwebClient } from "thirdweb";
import type { Chain } from "thirdweb/chains";

/**
 * Minimal EIP-1193 provider backed by Ledger (USB / WebHID).
 * Note: This currently supports account + chain id. (No signing yet.)
 */
async function createLedgerEip1193Provider(chainId: number) {
  const transport = await TransportWebHID.create();
  const eth = new Eth(transport);

  const derivationPath = "44'/60'/0'/0/0";
  const { address } = await eth.getAddress(derivationPath, false, true);

  return {
    async request({ method, params }: { method: string; params?: any[] }) {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [address];

        case "eth_chainId":
          return `0x${chainId.toString(16)}`;

        case "wallet_switchEthereumChain": {
          const [{ chainId: requested }] = params ?? [];
          const expected = `0x${chainId.toString(16)}`;
          if (requested !== expected) {
            throw new Error("Ledger USB: unsupported chain in this app");
          }
          return null;
        }

        // Not implemented yet
        case "eth_sendTransaction":
        case "personal_sign":
        case "eth_signTypedData_v4":
          throw new Error("Ledger USB signing not enabled yet. Use MetaMask + Ledger to sign.");

        default:
          throw new Error(`Unsupported method: ${method}`);
      }
    },
  };
}

/**
 * Hook used by SignInModal
 * Returns a thirdweb-compatible wallet instance (EIP1193.fromProvider)
 */
export function useLedgerUsbWallet() {
  const isSupported = useMemo(() => {
    return typeof window !== "undefined" && typeof (navigator as any)?.hid !== "undefined";
  }, []);

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  const connectLedgerUsb = useCallback(
    async (opts: { client: ThirdwebClient; chain: Chain }) => {
      setError("");
      if (!isSupported) throw new Error("WebHID not supported (use Chrome/Edge/Brave).");

      const wallet = EIP1193.fromProvider({
        // ✅ Use a known ID to avoid thirdweb wallet registry lookups
        // Since we are NOT displaying this in ConnectEmbed list anymore, ID is mostly internal.
        walletId: "injected",
        provider: async () => createLedgerEip1193Provider(opts.chain.id),
      });

      setIsConnecting(true);
      try {
        // Ensure provider is created now (user gesture)
        await (await (wallet as any).getProvider?.())?.request?.({ method: "eth_requestAccounts" });
      } catch {
        // If the wrapper doesn't expose getProvider(), it's okay — connect() will trigger provider later.
      } finally {
        setIsConnecting(false);
      }

      return wallet;
    },
    [isSupported]
  );

  return { isSupported, isConnecting, error, connectLedgerUsb };
}