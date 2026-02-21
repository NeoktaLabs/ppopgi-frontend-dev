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

type MinimalEip1193Provider = {
  request: (args: Eip1193RequestArgs) => Promise<any>;
  on: (event: string, listener: (...args: any[]) => void) => any;
  removeListener: (event: string, listener: (...args: any[]) => void) => any;
};

/**
 * Ledger ETH app / ledgerjs requires an explicit "resolution" param in some versions.
 * If you pass nothing or a malformed object, you can get:
 *   "resolution.<field> is not iterable"
 */
function emptyLedgerResolution() {
  return {
    domains: [] as any[],
    erc20Tokens: [] as any[],
    nfts: [] as any[],
    externalPlugin: [] as any[],
    plugin: [] as any[], // must be iterable in some versions
  };
}

/**
 * Forward-only methods to RPC (thirdweb often calls these on the wallet provider).
 * If these are missing, thirdweb can fail to estimate gas and end up sending gas=0.
 */
const RPC_FORWARD_METHODS = new Set<string>([
  "eth_estimateGas",
  "eth_call",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_getBalance",
  "eth_getCode",
  "eth_getStorageAt",
  "eth_getBlockByNumber",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_getTransactionCount",
  "eth_blockNumber",
  "net_version",
  "web3_clientVersion",
]);

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

  return {
    on,
    removeListener,

    async request({ method, params }: Eip1193RequestArgs) {
      const p = Array.isArray(params) ? params : [];

      // ✅ Forward common read/estimate methods to RPC so thirdweb can function normally.
      if (RPC_FORWARD_METHODS.has(method)) {
        return await rpcRequest(rpcUrl, method, p);
      }

      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts": {
          const s = await getSession();
          return [s.address];
        }

        case "eth_chainId":
          return hexChainId;

        case "wallet_switchEthereumChain": {
          const [{ chainId: requested } = {} as any] = p as any[];
          if (requested && requested !== hexChainId) {
            throw new Error(`Ledger USB: chain ${requested} not supported (expected ${hexChainId}).`);
          }
          return null;
        }

        case "eth_sendTransaction": {
          const [tx] = p as any[];
          if (!tx) throw new Error("Missing transaction object.");

          const s = await getSession();

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

          if (!nonceHex) throw new Error("Failed to resolve nonce.");

          // --- GAS ---
          // thirdweb may pass gas/gasLimit as 0x0 if estimate step failed.
          // We enforce an estimate if missing/zero.
          const providedGasHex = asHexQuantity(tx.gas ?? tx.gasLimit);
          const providedGasBi = providedGasHex && providedGasHex !== "0x0" ? BigInt(providedGasHex) : 0n;

          let gasLimitBi: bigint;

          if (providedGasBi > 0n) {
            gasLimitBi = providedGasBi;
          } else {
            const est = await rpcRequest(rpcUrl, "eth_estimateGas", [
              {
                from: tx.from,
                to,
                data,
                value: tx.value ?? "0x0",
                // include fees if present to match actual tx type
                ...(tx.maxFeePerGas != null ? { maxFeePerGas: tx.maxFeePerGas } : {}),
                ...(tx.maxPriorityFeePerGas != null ? { maxPriorityFeePerGas: tx.maxPriorityFeePerGas } : {}),
                ...(tx.gasPrice != null ? { gasPrice: tx.gasPrice } : {}),
              },
            ]);

            const estHex = String(est || "0x0");
            const estBi = estHex && estHex !== "0x0" ? BigInt(estHex) : 0n;
            if (estBi === 0n) throw new Error("eth_estimateGas returned 0");

            // add buffer (20%) + 10k
            gasLimitBi = (estBi * 120n) / 100n + 10_000n;
          }

          // Fees
          let maxFeePerGasHex = asHexQuantity(tx.maxFeePerGas);
          let maxPriorityFeePerGasHex = asHexQuantity(tx.maxPriorityFeePerGas);
          let gasPriceHex = asHexQuantity(tx.gasPrice);

          if (!maxFeePerGasHex && !gasPriceHex) {
            gasPriceHex = await rpcRequest(rpcUrl, "eth_gasPrice", []);
          }

          const is1559 = !!(maxFeePerGasHex || maxPriorityFeePerGasHex);

          const gasPriceHexResolved = gasPriceHex ?? "0x0";
          const maxFeeHexResolved = maxFeePerGasHex ?? gasPriceHexResolved;
          const maxPrioHexResolved = maxPriorityFeePerGasHex ?? "0x3b9aca00"; // 1 gwei fallback

          const unsignedTx = Transaction.from({
            chainId,
            to,
            nonce: Number(BigInt(nonceHex)),
            gasLimit: gasLimitBi,
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

          const resolution = emptyLedgerResolution();
          const sig = await s.eth.signTransaction(s.path, payloadHex, resolution);

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
          const [message, address] = p as any[];

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
          provider: async () => {
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