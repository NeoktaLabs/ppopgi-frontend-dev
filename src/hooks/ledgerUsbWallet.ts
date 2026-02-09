// src/hooks/ledgerUsbWallet.ts
import { useCallback, useMemo, useRef, useState } from "react";
import TransportWebHID from "@ledgerhq/hw-transport-webhid";
import Eth from "@ledgerhq/hw-app-eth";
import { EIP1193 } from "thirdweb/wallets";
import type { ThirdwebClient } from "thirdweb";
import type { Chain } from "thirdweb/chains";
import { Transaction, Signature, hexlify, getBytes } from "ethers";

/**
 * Tiny JSON-RPC helper
 */
async function rpcRequest(rpcUrl: string, method: string, params: any[] = []) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Math.floor(Math.random() * 1e9),
      method,
      params,
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.error) {
    const msg = json?.error?.message || `RPC_ERROR_${res.status}`;
    throw new Error(msg);
  }
  return json.result;
}

function pickRpcUrl(chain: Chain): string {
  const rpc: any = (chain as any)?.rpc;
  if (typeof rpc === "string" && rpc) return rpc;
  if (Array.isArray(rpc) && rpc[0]) return String(rpc[0]);
  throw new Error("No RPC URL found for chain.");
}

function asHexQuantity(v: any): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v; // assume already 0x...
  try {
    const bi = typeof v === "bigint" ? v : BigInt(v);
    return "0x" + bi.toString(16);
  } catch {
    return undefined;
  }
}

type LedgerSession = {
  transport: TransportWebHID;
  eth: Eth;
  address: string;
  path: string;
};

async function openLedgerSession(): Promise<LedgerSession> {
  const transport = await TransportWebHID.create();
  const eth = new Eth(transport);

  // You can make this configurable later
  const path = "44'/60'/0'/0/0";
  const { address } = await eth.getAddress(path, false, true);

  return { transport, eth, address, path };
}

/**
 * Create an EIP-1193 provider backed by Ledger WebHID
 */
async function createLedgerEip1193Provider(opts: {
  chainId: number;
  rpcUrl: string;
  sessionRef: { current: LedgerSession | null };
}) {
  const { chainId, rpcUrl, sessionRef } = opts;

  async function getSession() {
    if (sessionRef.current) return sessionRef.current;
    const s = await openLedgerSession();
    sessionRef.current = s;
    return s;
  }

  const hexChainId = `0x${chainId.toString(16)}`;

  return {
    async request({ method, params }: { method: string; params?: any[] }) {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts": {
          const s = await getSession();
          return [s.address];
        }

        case "eth_chainId":
          return hexChainId;

        case "wallet_switchEthereumChain": {
          const [{ chainId: requested }] = (params ?? []) as any[];
          if (requested && requested !== hexChainId) {
            throw new Error(`Ledger USB: requested chain ${requested} not supported (expected ${hexChainId}).`);
          }
          return null;
        }

        /**
         * ✅ SIGN + SEND (needed for contract calls)
         */
        case "eth_sendTransaction": {
          const [tx] = (params ?? []) as any[];
          if (!tx) throw new Error("Missing transaction object.");

          const s = await getSession();

          // Validate from, but DO NOT pass it to ethers Transaction.from (ethers v6 forbids from on unsigned tx)
          const from = String(tx.from || "").toLowerCase();
          if (!from) throw new Error("Transaction missing from.");
          if (from !== s.address.toLowerCase()) {
            throw new Error(`Ledger USB: tx.from must be the Ledger address (${s.address}).`);
          }

          const to = tx.to ? String(tx.to) : undefined;
          const data = tx.data ? String(tx.data) : "0x";
          const value = tx.value != null ? BigInt(tx.value) : 0n;

          const nonceHex =
            tx.nonce != null
              ? asHexQuantity(tx.nonce)
              : await rpcRequest(rpcUrl, "eth_getTransactionCount", [s.address, "pending"]);

          const gasHex =
            tx.gas != null || tx.gasLimit != null
              ? asHexQuantity(tx.gas ?? tx.gasLimit)
              : await rpcRequest(rpcUrl, "eth_estimateGas", [
                  { from: tx.from, to, data, value: tx.value ?? "0x0" },
                ]);

          if (!nonceHex) throw new Error("Failed to resolve nonce.");
          if (!gasHex) throw new Error("Failed to resolve gas.");

          // Fees (prefer 1559 if provided; otherwise fall back)
          let maxFeePerGasHex = asHexQuantity(tx.maxFeePerGas);
          let maxPriorityFeePerGasHex = asHexQuantity(tx.maxPriorityFeePerGas);
          let gasPriceHex = asHexQuantity(tx.gasPrice);

          if (!maxFeePerGasHex && !gasPriceHex) {
            gasPriceHex = await rpcRequest(rpcUrl, "eth_gasPrice", []);
          }

          const is1559 = !!(maxFeePerGasHex || maxPriorityFeePerGasHex);

          // ✅ IMPORTANT: do NOT include `from` here
          const unsignedTx = Transaction.from({
            type: is1559 ? 2 : 0,
            chainId,
            to,
            nonce: Number(BigInt(nonceHex)),
            gasLimit: BigInt(gasHex),
            data,
            value,
            ...(is1559
              ? {
                  maxFeePerGas: BigInt(maxFeePerGasHex ?? gasPriceHex ?? "0x0"),
                  maxPriorityFeePerGas: BigInt(maxPriorityFeePerGasHex ?? "0x3b9aca00"), // 1 gwei fallback
                }
              : {
                  gasPrice: BigInt(gasPriceHex ?? "0x0"),
                }),
          });

          const unsignedSerialized = unsignedTx.unsignedSerialized; // 0x...
          const payloadHex = unsignedSerialized.startsWith("0x") ? unsignedSerialized.slice(2) : unsignedSerialized;

          const sig = await s.eth.signTransaction(s.path, payloadHex);

          const v = BigInt("0x" + sig.v);
          const r = "0x" + sig.r;
          const sSig = "0x" + sig.s;

          const signature = Signature.from({ v, r, s: sSig });

          const signedTx = Transaction.from({ ...unsignedTx, signature }).serialized;

          const txHash = await rpcRequest(rpcUrl, "eth_sendRawTransaction", [signedTx]);
          return txHash;
        }

        /**
         * Optional: personal_sign for auth flows
         */
        case "personal_sign": {
          const s = await getSession();
          const [message, address] = (params ?? []) as any[];

          const addr = String(address || "").toLowerCase();
          if (addr && addr !== s.address.toLowerCase()) {
            throw new Error("Ledger USB: personal_sign address mismatch.");
          }

          const bytes =
            typeof message === "string" && message.startsWith("0x")
              ? getBytes(message)
              : new TextEncoder().encode(String(message ?? ""));

          const res = await s.eth.signPersonalMessage(s.path, hexlify(bytes).slice(2));
          const sigHex = "0x" + res.r + res.s + res.v.toString(16).padStart(2, "0");
          return sigHex;
        }

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

  // Keep a single session alive (avoid repeated HID prompts)
  const sessionRef = useRef<LedgerSession | null>(null);

  const connectLedgerUsb = useCallback(
    async (opts: { client: ThirdwebClient; chain: Chain }) => {
      setError("");
      if (!isSupported) throw new Error("WebHID not supported. Use Chrome/Edge/Brave.");

      setIsConnecting(true);
      try {
        const rpcUrl = pickRpcUrl(opts.chain);

        const wallet = EIP1193.fromProvider({
          // ✅ MUST be a known thirdweb wallet id to avoid metadata lookup crash
          walletId: "io.metamask",
          provider: async () =>
            createLedgerEip1193Provider({
              chainId: opts.chain.id,
              rpcUrl,
              sessionRef,
            }),
        });

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