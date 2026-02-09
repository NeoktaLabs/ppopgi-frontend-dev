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
 * - Supports: accounts, chainId, sendTransaction (sign+send), basic signing hooks
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
         * ✅ SIGN + SEND
         * thirdweb contract calls rely on this.
         */
        case "eth_sendTransaction": {
          const [tx] = (params ?? []) as any[];
          if (!tx) throw new Error("Missing transaction object.");

          const s = await getSession();

          const from = String(tx.from || "").toLowerCase();
          if (!from) throw new Error("Transaction missing from.");
          if (from !== s.address.toLowerCase()) {
            throw new Error(`Ledger USB: tx.from must be the Ledger address (${s.address}).`);
          }

          // Fill nonce if missing
          const nonce =
            tx.nonce != null
              ? asHexQuantity(tx.nonce)
              : await rpcRequest(rpcUrl, "eth_getTransactionCount", [s.address, "pending"]);

          // Fill gas if missing
          const gas =
            tx.gas != null || tx.gasLimit != null
              ? asHexQuantity(tx.gas ?? tx.gasLimit)
              : await rpcRequest(rpcUrl, "eth_estimateGas", [
                  {
                    from: tx.from,
                    to: tx.to,
                    data: tx.data,
                    value: tx.value ?? "0x0",
                  },
                ]);

          // Fees: support both legacy and EIP-1559 (prefer 1559)
          let maxFeePerGas = asHexQuantity(tx.maxFeePerGas);
          let maxPriorityFeePerGas = asHexQuantity(tx.maxPriorityFeePerGas);
          let gasPrice = asHexQuantity(tx.gasPrice);

          if (!maxFeePerGas && !gasPrice) {
            // simple fallback
            gasPrice = await rpcRequest(rpcUrl, "eth_gasPrice", []);
          }

          // Build ethers Transaction (v6)
          const t = Transaction.from({
            type: maxFeePerGas || maxPriorityFeePerGas ? 2 : 0,
            chainId,
            from: tx.from,
            to: tx.to,
            nonce: Number(BigInt(nonce)),
            gasLimit: BigInt(gas),
            data: tx.data ?? "0x",
            value: tx.value != null ? BigInt(tx.value) : 0n,
            ...(maxFeePerGas || maxPriorityFeePerGas
              ? {
                  maxFeePerGas: BigInt(maxFeePerGas ?? gasPrice ?? "0x0"),
                  maxPriorityFeePerGas: BigInt(maxPriorityFeePerGas ?? "0x3b9aca00" /* 1 gwei */),
                }
              : { gasPrice: BigInt(gasPrice ?? "0x0") }),
          });

          const unsigned = t.unsignedSerialized; // 0x...
          const unsignedHex = unsigned.startsWith("0x") ? unsigned.slice(2) : unsigned;

          // Ledger signs the RLP payload (for type-2 tx, ethers encodes correctly in unsignedSerialized)
          const sig = await s.eth.signTransaction(s.path, unsignedHex);

          // Build signature
          const v = BigInt("0x" + sig.v);
          const r = "0x" + sig.r;
          const sSig = "0x" + sig.s;

          const signature = Signature.from({ v, r, s: sSig });

          // Attach signature and serialize
          const signedTx = Transaction.from({ ...t, signature }).serialized;

          // Broadcast
          const txHash = await rpcRequest(rpcUrl, "eth_sendRawTransaction", [signedTx]);
          return txHash;
        }

        /**
         * Optional: basic personal_sign support (many dapps need this for auth)
         * Ledger expects hex bytes; we will sign the raw message hash via Ledger's "signPersonalMessage".
         */
        case "personal_sign": {
          const s = await getSession();
          const [message, address] = (params ?? []) as any[];

          const addr = String(address || "").toLowerCase();
          if (addr && addr !== s.address.toLowerCase()) {
            throw new Error("Ledger USB: personal_sign address mismatch.");
          }

          // message can be hex or plain string
          const bytes =
            typeof message === "string" && message.startsWith("0x")
              ? getBytes(message)
              : new TextEncoder().encode(String(message ?? ""));

          const res = await s.eth.signPersonalMessage(s.path, hexlify(bytes).slice(2));
          const sig = "0x" + res.r + res.s + res.v.toString(16).padStart(2, "0");
          return sig;
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

  // Keep a single session alive (so you don't re-prompt HID constantly)
  const sessionRef = useRef<LedgerSession | null>(null);

  const connectLedgerUsb = useCallback(
    async (opts: { client: ThirdwebClient; chain: Chain }) => {
      setError("");
      if (!isSupported) throw new Error("WebHID not supported. Use Chrome/Edge/Brave.");

      setIsConnecting(true);
      try {
        const rpcUrl = pickRpcUrl(opts.chain);

        const wallet = EIP1193.fromProvider({
          // ✅ MUST be a known thirdweb id to avoid "wallet id not found"
          // (we're only borrowing its metadata; the provider is Ledger)
          walletId: "io.metamask",
          provider: async () =>
            createLedgerEip1193Provider({
              chainId: opts.chain.id,
              rpcUrl,
              sessionRef,
            }),
        });

        // ✅ Connect so thirdweb has an active account (fixes "Cannot set a wallet without an account as active")
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