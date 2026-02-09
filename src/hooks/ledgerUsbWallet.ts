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
    const msg = json?.error?.message || `RPC_ERROR_${res.status}`;
    throw new Error(`${method}: ${msg}`);
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
  if (typeof v === "string") return v;
  try {
    const bi = typeof v === "bigint" ? v : BigInt(v);
    return "0x" + bi.toString(16);
  } catch {
    return undefined;
  }
}

function toBigIntLoose(v: any): bigint | null {
  if (v == null) return null;
  try {
    return BigInt(v);
  } catch {
    return null;
  }
}

function isZeroHex(v?: string) {
  const bi = toBigIntLoose(v);
  return bi != null && bi === 0n;
}

function addGasBuffer(gas: bigint): bigint {
  return (gas * 120n) / 100n + 10_000n; // +20% + 10k
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
    throw new Error("Ledger libs missing (TransportWebHID / Eth / ledgerService).");
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

  async function resolveGasHex(s: LedgerSession, tx: any): Promise<string> {
    // 1) honor provided gas/gasLimit if > 0
    const provided = asHexQuantity(tx.gas ?? tx.gasLimit);
    const providedBi = toBigIntLoose(provided);
    if (providedBi != null && providedBi > 0n) {
      const buffered = addGasBuffer(providedBi);
      return "0x" + buffered.toString(16);
    }

    // 2) estimate gas
    const to = tx.to ? String(tx.to) : undefined;
    const data = tx.data ? String(tx.data) : "0x";
    const valueHex = asHexQuantity(tx.value) ?? "0x0";

    const est = await rpcRequest(rpcUrl, "eth_estimateGas", [
      { from: s.address, to, data, value: valueHex },
      "pending",
    ]);

    const estBi = toBigIntLoose(est);
    if (estBi == null || estBi === 0n) {
      throw new Error(
        "eth_estimateGas returned 0; RPC cannot estimate this tx. Try another RPC or provide gasLimit."
      );
    }

    const buffered = addGasBuffer(estBi);
    return "0x" + buffered.toString(16);
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

          // nonce
          let nonceHex = asHexQuantity(tx.nonce);
          if (!nonceHex || isZeroHex(nonceHex)) {
            nonceHex = await rpcRequest(rpcUrl, "eth_getTransactionCount", [s.address, "pending"]);
          }

          // gas
          const gasHex = await resolveGasHex(s, tx);
          const gasBi = toBigIntLoose(gasHex);
          if (gasBi == null || gasBi <= 0n) throw new Error("Internal error: resolved gas is 0.");

          // fees
          let maxFeePerGasHex = asHexQuantity(tx.maxFeePerGas);
          let maxPriorityFeePerGasHex = asHexQuantity(tx.maxPriorityFeePerGas);
          let gasPriceHex = asHexQuantity(tx.gasPrice);

          if ((!maxFeePerGasHex || isZeroHex(maxFeePerGasHex)) && (!gasPriceHex || isZeroHex(gasPriceHex))) {
            gasPriceHex = await rpcRequest(rpcUrl, "eth_gasPrice", []);
          }

          const is1559 =
            (maxFeePerGasHex && !isZeroHex(maxFeePerGasHex)) ||
            (maxPriorityFeePerGasHex && !isZeroHex(maxPriorityFeePerGasHex));

          // ✅ KEEP PLAIN TX DATA OBJECT (don’t spread a Transaction instance)
          const txData: any = {
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
          };

          const unsignedTx = Transaction.from(txData);

          const rawTxHex = unsignedTx.unsignedSerialized.startsWith("0x")
            ? unsignedTx.unsignedSerialized.slice(2)
            : unsignedTx.unsignedSerialized;

          // Ledger resolution (required by newer ledgerjs)
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

          // ✅ Build signed tx from txData + signature (NOT from spreading unsignedTx)
          const signedTx = Transaction.from({ ...txData, signature }).serialized;

          const decoded = Transaction.from(signedTx);
          if (!decoded.gasLimit || decoded.gasLimit === 0n) {
            throw new Error("BUG: signed tx gasLimit is 0. Refusing to broadcast.");
          }

          return await rpcRequest(rpcUrl, "eth_sendRawTransaction", [signedTx]);
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