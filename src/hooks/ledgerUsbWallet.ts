// src/hooks/ledgerUsbWallet.ts
import TransportWebHID from "@ledgerhq/hw-transport-webhid";
import Eth from "@ledgerhq/hw-app-eth";
import { EIP1193 } from "thirdweb/wallets";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";

type EIP1193RequestArgs = {
  method: string;
  params?: any[];
};

/**
 * Create a minimal EIP-1193 provider backed by Ledger (USB / WebHID)
 * Chromium-only (Chrome / Edge / Brave)
 */
async function createLedgerProvider() {
  // ⚠️ Must be called from a user gesture (button click / connect)
  const transport = await TransportWebHID.create();
  const eth = new Eth(transport);

  // Standard Ledger ETH derivation path
  const derivationPath = "44'/60'/0'/0/0";

  const { address } = await eth.getAddress(derivationPath, false, true);

  return {
    async request({ method, params }: EIP1193RequestArgs) {
      switch (method) {
        case "eth_requestAccounts":
          return [address];

        case "eth_accounts":
          return [address];

        case "eth_chainId":
          return `0x${ETHERLINK_CHAIN.id.toString(16)}`;

        case "wallet_switchEthereumChain": {
          const [{ chainId }] = params ?? [];
          const expected = `0x${ETHERLINK_CHAIN.id.toString(16)}`;
          if (chainId !== expected) {
            throw new Error("Ledger USB only supports Etherlink in this app");
          }
          return null;
        }

        // 🚧 intentionally not implemented yet
        case "eth_sendTransaction":
        case "personal_sign":
        case "eth_signTypedData_v4":
          throw new Error(
            "Ledger USB signing not enabled yet. Please use MetaMask + Ledger for transactions."
          );

        default:
          throw new Error(`Unsupported method: ${method}`);
      }
    },
  };
}

/**
 * Exported helper used by SignInModal
 */
export function getLedgerUsbWallet() {
  return EIP1193.fromProvider({
    walletId: "com.ledger.usb",
    provider: async () => {
      // WebHID guard (Chromium only)
      if (typeof navigator === "undefined" || !(navigator as any).hid) {
        throw new Error("WebHID not supported in this browser");
      }

      return await createLedgerProvider();
    },
  });
}