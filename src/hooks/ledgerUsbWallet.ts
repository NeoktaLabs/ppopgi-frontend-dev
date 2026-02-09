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

function hexToBigIntSafe(v?: string): bigint | null {
  if (!v) return null;
  try {
    return BigInt(v); // supports 0x... and decimal
  } catch {
    return null;
  }
}

function isZeroQty(v?: string) {
  const bi = hexToBigIntSafe(v);
  return bi == null ? false : bi === 0n;
}

function applyGasBuffer(gas: bigint): bigint {
  // +20% buffer, minimum +10k
  const buffered = (gas * 120n) / 100n;
  return buffered + 10_000n;
}

async function resolveGasLimit(rpcUrl: string, txReq: any): Promise<string> {
  // Always estimate if gas is missing OR 0 OR "0x0"
  const provided = asHexQuantity(txReq.gas ?? txReq.gasLimit);
  if (provided && !isZeroQty(provided)) return provided;

  const estimate = await rpcRequest(rpcUrl, "eth_estimateGas", [txReq, "pending"]);
  const estBi = hexToBigIntSafe(String(estimate));
  if (!estBi || estBi === 0n) {
    throw new Error("eth_estimateGas returned 0; cannot safely send tx. Check tx params / RPC.");
  }

  const buffered = applyGasBuffer(estBi);
  return "0x" + buffered.toString(16);
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
  const [transportMod, ethMod] = await Promise.all([
    import("@ledgerhq/hw-transport-webhid"),
    import("@ledgerhq/hw-app-eth"),
  ]);

  const TransportWebHID = (transportMod as any).default;
  const Eth = (ethMod as any).default;
  const ledgerService: LedgerService = (ethMod as any).ledgerService;

  if (!TransportWebHID || !Eth || !ledgerService?.resolveTransaction) {
    throw new Error("Ledger libs not loaded correctly (Transport/Eth/ledgerService missing).");
  }

  const transport = await TransportWebHID.create();
  const eth = new Eth(transport);

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

          const from = String(tx.from || "").toLowerCase();
          if (!from) throw new Error("Transaction missing from.");
          if (from !== s.address.toLowerCase()) {
            throw new Error(`Ledger USB: tx.from must be the Ledger address (${s.address}).`);
          }

          const to = tx.to ? String(tx.to) : undefined;
          const data = tx.data ? String(tx.data) : "0x";
          const valueHex = asHexQuantity(tx.value) ?? "0x0";

          // Nonce (use provided if non-zero, else fetch)
          let nonceHex = asHexQuantity(tx.nonce);
          if (!nonceHex || isZeroQty(nonceHex)) {
            nonceHex = await rpcRequest(rpcUrl, "eth_getTransactionCount", [s.address, "pending"]);
          }

          // ✅ HARD gas resolution (never allow 0)
          const gasHex = await resolveGasLimit(rpcUrl, {
            from: s.address,
            to,
            data,
            value: valueHex,
          });

          // Fees
          let maxFeePerGasHex = asHexQuantity(tx.maxFeePerGas);
          let maxPriorityFeePerGasHex = asHexQuantity(tx.maxPriorityFeePerGas);
          let gasPriceHex = asHexQuantity(tx.gasPrice);

          // If nothing provided, fetch gasPrice fallback
          if ((!maxFeePerGasHex || isZeroQty(maxFeePerGasHex)) && (!gasPriceHex || isZeroQty(gasPriceHex))) {
            gasPriceHex = await rpcRequest(rpcUrl, "eth_gasPrice", []);
          }

          const is1559 =
            (maxFeePerGasHex && !isZeroQty(maxFeePerGasHex)) ||
            (maxPriorityFeePerGasHex && !isZeroQty(maxPriorityFeePerGasHex));

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
                  maxPriorityFeePerGas: BigInt(maxPriorityFeePerGasHex ?? "0x3b9aca00"),
                }
              : {
                  gasPrice: BigInt(gasPriceHex ?? "0x0"),
                }),
          });

          const rawTxHex = unsignedTx.unsignedSerialized.startsWith("0x")
            ? unsignedTx.unsignedSerialized.slice(2)
            : unsignedTx.unsignedSerialized;

          // ✅ Required 3rd param resolution
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