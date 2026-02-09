// src/hooks/ledgerUsbWallet.ts
import { useCallback, useMemo, useRef, useState } from "react";
import { EIP1193 } from "thirdweb/wallets";
import type { ThirdwebClient } from "thirdweb";
import type { Chain } from "thirdweb/chains";
import { Transaction, Signature, hexlify, getBytes } from "ethers";

async function rpcRequest(rpcUrl: string, method: string, params: any[] = []) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message || `RPC_ERROR_${res.status}`);
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

function isZeroQuantity(q?: string) {
  if (!q) return true;
  try {
    return BigInt(q) === 0n;
  } catch {
    return false;
  }
}

type LedgerService = {
  resolveTransaction: (rawTxHex: string, loadConfig: any, opts?: any) => Promise<any>;
};

type LedgerSession = {
  transport: any;
  eth: any;
  ledgerService: LedgerService;
  address: string;
  path: string;
};

async function openLedgerSession(): Promise<LedgerSession> {
  // ✅ Dynamic import: only loads when user clicks connect
  const [transportMod, ethMod] = await Promise.all([
    import("@ledgerhq/hw-transport-webhid"),
    import("@ledgerhq/hw-app-eth"),
  ]);

  const TransportWebHID = (transportMod as any).default;
  const Eth = (ethMod as any).default;
  const ledgerService: LedgerService = (ethMod as any).ledgerService;

  if (!TransportWebHID || !Eth || !ledgerService?.resolveTransaction) {
    throw new Error("Ledger libraries not loaded correctly (Transport/Eth/ledgerService missing).");
  }

  const transport = await TransportWebHID.create();
  const eth = new Eth(transport);

  // default derivation path
  const path = "44'/60'/0'/0/0";
  const { address } = await eth.getAddress(path, false, true);

  return { transport, eth, ledgerService, address, path };
}

async function createLedgerEip1193Provider(opts: {
  chainId: number;
  rpcUrl: string;
  sessionRef: { current: LedgerSession | null };
}) {
  const { chainId, rpcUrl, sessionRef } = opts;
  const hexChainId = `0x${chainId.toString(16)}`;

  async function getSession() {
    if (sessionRef.current) return sessionRef.current;
    const s = await openLedgerSession();
    sessionRef.current = s;
    return s;
  }

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
            throw new Error(`Ledger USB: chain ${requested} not supported (expected ${hexChainId}).`);
          }
          return null;
        }

        case "eth_sendTransaction": {
          const [tx] = (params ?? []) as any[];
          if (!tx) throw new Error("Missing transaction object.");

          const s = await getSession();

          // Validate from
          const from = String(tx.from || "").toLowerCase();
          if (!from) throw new Error("Transaction missing from.");
          if (from !== s.address.toLowerCase()) {
            throw new Error(`Ledger USB: tx.from must be the Ledger address (${s.address}).`);
          }

          const to = tx.to ? String(tx.to) : undefined;
          const data = tx.data ? String(tx.data) : "0x";
          const valueHex = asHexQuantity(tx.value) ?? "0x0";

          // Nonce: if provided and non-zero use it, otherwise ask RPC
          let nonceHex = asHexQuantity(tx.nonce);
          if (isZeroQuantity(nonceHex)) {
            nonceHex = await rpcRequest(rpcUrl, "eth_getTransactionCount", [s.address, "pending"]);
          }

          // Gas: if provided but 0, IGNORE and estimate
          let gasHex = asHexQuantity(tx.gas ?? tx.gasLimit);
          if (isZeroQuantity(gasHex)) {
            gasHex = await rpcRequest(rpcUrl, "eth_estimateGas", [
              { from: s.address, to, data, value: valueHex },
            ]);
          }

          if (!nonceHex) throw new Error("Failed to resolve nonce.");
          if (!gasHex) throw new Error("Failed to resolve gas.");

          // Fees
          let maxFeePerGasHex = asHexQuantity(tx.maxFeePerGas);
          let maxPriorityFeePerGasHex = asHexQuantity(tx.maxPriorityFeePerGas);
          let gasPriceHex = asHexQuantity(tx.gasPrice);

          // If nothing provided, fetch gasPrice as fallback
          if (isZeroQuantity(maxFeePerGasHex) && isZeroQuantity(gasPriceHex)) {
            gasPriceHex = await rpcRequest(rpcUrl, "eth_gasPrice", []);
          }

          // Decide 1559 if either 1559 field is present AND non-zero
          const is1559 =
            !isZeroQuantity(maxFeePerGasHex) || !isZeroQuantity(maxPriorityFeePerGasHex);

          const unsignedTx = Transaction.from({
            type: is1559 ? 2 : 0,
            chainId,
            to,
            nonce: Number(BigInt(nonceHex)),
            gasLimit: BigInt(gasHex),
            data,
            value: BigInt(valueHex),
            ...(is1559
              ? {
                  maxFeePerGas: BigInt(maxFeePerGasHex ?? gasPriceHex ?? "0x0"),
                  maxPriorityFeePerGas: BigInt(
                    maxPriorityFeePerGasHex ?? "0x3b9aca00" // 1 gwei fallback
                  ),
                }
              : {
                  gasPrice: BigInt(gasPriceHex ?? "0x0"),
                }),
          });

          // Ledger expects raw tx hex without 0x
          const rawTxHex = unsignedTx.unsignedSerialized.startsWith("0x")
            ? unsignedTx.unsignedSerialized.slice(2)
            : unsignedTx.unsignedSerialized;

          // ✅ REQUIRED now: provide resolution as the 3rd parameter.
          // ✅ Avoid plugin downloads (your ethereum.json 404) by disabling externalPlugins.
          // This will generally fall back to “blind signing” when needed (user must enable it on device if prompted).
          const resolution = await s.ledgerService.resolveTransaction(rawTxHex, s.eth.loadConfig, {
            externalPlugins: false,
            erc20: false,
            nft: false,
          });

          const sig = await s.eth.signTransaction(s.path, rawTxHex, resolution);

          const v = BigInt("0x" + sig.v);
          const r = "0x" + sig.r;
          const sSig = "0x" + sig.s;

          const signature = Signature.from({ v, r, s: sSig });
          const signedTx = Transaction.from({ ...unsignedTx, signature }).serialized;

          const txHash = await rpcRequest(rpcUrl, "eth_sendRawTransaction", [signedTx]);
          return txHash;
        }

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
          return "0x" + res.r + res.s + res.v.toString(16).padStart(2, "0");
        }

        default:
          throw new Error(`Unsupported method: ${method}`);
      }
    },
  };
}

export function useLedgerUsbWallet() {
  const isSupported = useMemo(() => typeof (navigator as any)?.hid !== "undefined", []);

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");
  const sessionRef = useRef<LedgerSession | null>(null);

  const connectLedgerUsb = useCallback(
    async (opts: { client: ThirdwebClient; chain: Chain }) => {
      setError("");
      if (!isSupported) throw new Error("WebHID not supported. Use Chrome/Edge/Brave.");

      setIsConnecting(true);
      try {
        const rpcUrl = pickRpcUrl(opts.chain);

        const wallet = EIP1193.fromProvider({
          // known id so thirdweb doesn’t crash trying to look up metadata
          walletId: "io.metamask",
          provider: async () =>
            createLedgerEip1193Provider({
              chainId: opts.chain.id,
              rpcUrl,
              sessionRef,
            }),
        });

        await wallet.connect({ client: opts.client, chain: opts.chain });
        return wallet;
      } catch (e: any) {
        setError(e?.message ? String(e.message) : "Failed to connect Ledger via USB.");
        throw e;
      } finally {
        setIsConnecting(false);
      }
    },
    [isSupported]
  );

  return { isSupported, isConnecting, error, connectLedgerUsb };
}