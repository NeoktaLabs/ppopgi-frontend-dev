// src/hooks/ledgerUsbWallet.ts
import { useCallback, useMemo, useRef, useState } from "react";
import { EIP1193 } from "thirdweb/wallets";
import type { ThirdwebClient } from "thirdweb";
import type { Chain } from "thirdweb/chains";
import { Transaction, Signature, hexlify, getBytes } from "ethers";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRateLimitMessage(msg: string) {
  const m = (msg || "").toLowerCase();
  return m.includes("too many requests") || m.includes("rate limit") || m.includes("call rate limit");
}

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

async function rpcRequestWithRetry(rpcUrl: string, method: string, params: any[] = [], maxRetries = 3) {
  let lastErr: any = null;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await rpcRequest(rpcUrl, method, params);
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e);
      if (!isRateLimitMessage(msg) || i === maxRetries) throw e;
      // backoff: 0.5s, 1s, 2s, 4s (cap)
      const wait = Math.min(4000, 500 * 2 ** i);
      await sleep(wait);
    }
  }
  throw lastErr ?? new Error("RPC retry exhausted");
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

function toBigIntSafe(v: any): bigint {
  try {
    if (v == null) return 0n;
    if (typeof v === "bigint") return v;
    if (typeof v === "number") return BigInt(v);
    const s = String(v);
    if (!s) return 0n;
    return BigInt(s);
  } catch {
    return 0n;
  }
}

type LedgerSession = {
  transport: any;
  eth: any;
  address: string;
  path: string;
};

async function openLedgerSession(): Promise<LedgerSession> {
  const [{ default: TransportWebHID }, { default: Eth }] = await Promise.all([
    import("@ledgerhq/hw-transport-webhid"),
    import("@ledgerhq/hw-app-eth"),
  ]);

  const transport = await TransportWebHID.create();
  const eth = new Eth(transport);

  const path = "44'/60'/0'/0/0";
  const { address } = await eth.getAddress(path, false, true);

  return { transport, eth, address, path };
}

type Eip1193RequestArgs = { method: string; params?: any[] };

// Minimal EIP-1193 provider shape that thirdweb expects (includes on/removeListener)
type MinimalEip1193Provider = {
  request: (args: Eip1193RequestArgs) => Promise<any>;
  on: (event: string, listener: (...args: any[]) => void) => any;
  removeListener: (event: string, listener: (...args: any[]) => void) => any;
};

async function createLedgerEip1193Provider(opts: {
  chainId: number;
  rpcUrl: string;
  sessionRef: { current: LedgerSession | null };
}): Promise<MinimalEip1193Provider> {
  const { chainId, rpcUrl, sessionRef } = opts;
  const hexChainId = `0x${chainId.toString(16)}`;

  async function getSession() {
    if (sessionRef.current) return sessionRef.current;
    const s = await openLedgerSession();
    sessionRef.current = s;
    return s;
  }

  const on: MinimalEip1193Provider["on"] = () => undefined;
  const removeListener: MinimalEip1193Provider["removeListener"] = () => undefined;

  // build a Ledger resolution object when possible (new Ledger requirement)
  async function resolveLedgerTx(payloadHex: string) {
    try {
      const { ledgerService } = await import("@ledgerhq/hw-app-eth");
      // Some versions expose ledgerService; if not, this import fails and we fallback.
      const resolution = await (ledgerService as any).resolveTransaction(payloadHex);
      return resolution ?? {};
    } catch (e) {
      // If it fails (including that 404), we fall back to empty resolution.
      // This still works when Ledger is set to allow blind signing.
      return {};
    }
  }

  return {
    on,
    removeListener,

    async request({ method, params }: Eip1193RequestArgs) {
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

          // ✅ tolerate missing from
          const fromRaw = tx.from ? String(tx.from) : s.address;
          const from = fromRaw.toLowerCase();

          if (from !== s.address.toLowerCase()) {
            throw new Error(`Ledger USB: tx.from must be the Ledger address (${s.address}). Got ${fromRaw}`);
          }

          const to = tx.to ? String(tx.to) : undefined;
          const data = tx.data ? String(tx.data) : "0x";
          const value = toBigIntSafe(tx.value);

          const nonceHex =
            tx.nonce != null
              ? asHexQuantity(tx.nonce)
              : await rpcRequestWithRetry(rpcUrl, "eth_getTransactionCount", [s.address, "pending"], 4);

          // gas estimation (retry on rate limit)
          const gasHex =
            tx.gas != null || tx.gasLimit != null
              ? asHexQuantity(tx.gas ?? tx.gasLimit)
              : await rpcRequestWithRetry(
                  rpcUrl,
                  "eth_estimateGas",
                  [
                    {
                      from: s.address,
                      to,
                      data,
                      value: asHexQuantity(value) ?? "0x0",
                    },
                  ],
                  4
                );

          if (!nonceHex) throw new Error("Failed to resolve nonce.");
          if (!gasHex) throw new Error("Failed to resolve gas.");

          // Fees (retry on rate limit)
          let maxFeePerGasHex = asHexQuantity(tx.maxFeePerGas);
          let maxPriorityFeePerGasHex = asHexQuantity(tx.maxPriorityFeePerGas);
          let gasPriceHex = asHexQuantity(tx.gasPrice);

          if (!maxFeePerGasHex && !gasPriceHex) {
            gasPriceHex = await rpcRequestWithRetry(rpcUrl, "eth_gasPrice", [], 4);
          }

          const is1559 = !!(maxFeePerGasHex || maxPriorityFeePerGasHex);

          const gasPriceHexResolved = gasPriceHex ?? "0x0";
          const maxFeeHexResolved = maxFeePerGasHex ?? gasPriceHexResolved;
          const maxPrioHexResolved = maxPriorityFeePerGasHex ?? "0x3b9aca00"; // 1 gwei fallback

          const unsignedTx = Transaction.from({
            chainId,
            to,
            nonce: Number(BigInt(nonceHex)),
            gasLimit: BigInt(gasHex),
            data,
            value,
            ...(is1559
              ? {
                  maxFeePerGas: BigInt(maxFeeHexResolved),
                  maxPriorityFeePerGas: BigInt(maxPrioHexResolved),
                }
              : {
                  gasPrice: BigInt(gasPriceHexResolved),
                }),
          });

          const payloadHex = unsignedTx.unsignedSerialized.startsWith("0x")
            ? unsignedTx.unsignedSerialized.slice(2)
            : unsignedTx.unsignedSerialized;

          // ✅ New Ledger API: provide resolution parameter (or {})
          const resolution = await resolveLedgerTx(payloadHex);

          const sig = await s.eth.signTransaction(s.path, payloadHex, resolution);

          const v = BigInt("0x" + sig.v);
          const r = "0x" + sig.r;
          const sSig = "0x" + sig.s;

          const signature = Signature.from({ v, r, s: sSig });
          const signedTx = Transaction.from({ ...unsignedTx, signature }).serialized;

          const txHash = await rpcRequestWithRetry(rpcUrl, "eth_sendRawTransaction", [signedTx], 4);
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
          walletId: "io.metamask",
          provider: async (_params?: { chainId?: number }) => {
            return await createLedgerEip1193Provider({
              chainId: opts.chain.id,
              rpcUrl,
              sessionRef,
            });
          },
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