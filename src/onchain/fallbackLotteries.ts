// src/onchain/fallbackLotteries.ts
import { Contract, JsonRpcProvider, ZeroAddress } from "ethers";
import { ADDRESSES } from "../config/contracts";
import { LotteryRegistryAbi, SingleWinnerLotteryAbi } from "../config/abis";
import type { LotteryListItem, LotteryStatus } from "../indexer/subgraph";

function mustEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (!v) throw new Error(`MISSING_ENV_${name}`);
  return v;
}

function statusFromUint8(x: number): LotteryStatus {
  if (x === 0) return "FUNDING_PENDING";
  if (x === 1) return "OPEN";
  if (x === 2) return "DRAWING";
  if (x === 3) return "COMPLETED";
  return "CANCELED";
}

/**
 * ✅ RPC-minimal fallback
 *
 * This file should be used only when the subgraph/indexer is unavailable.
 * So we keep calls to the absolute minimum:
 * - Registry: getAllLotteriesCount + paged getAllLotteries
 * - Per-lottery: status() + getSold() (or sold())
 *
 * Everything else is returned as safe placeholders so the UI can still render a list.
 */

async function safeCall<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export async function fetchLotteriesOnChainFallback(limit = 120): Promise<LotteryListItem[]> {
  const rpcUrl = mustEnv("VITE_ETHERLINK_RPC_URL");

  const rpc = new JsonRpcProvider(rpcUrl);
  const reg = new Contract(ADDRESSES.LotteryRegistry, LotteryRegistryAbi as any, rpc);

  const [countBn, latestBlock] = await Promise.all([reg.getAllLotteriesCount(), rpc.getBlockNumber()]);

  const count = Number(countBn);
  const pageSize = 25;
  const maxToLoad = Math.min(limit, count);

  // newest slice
  const start = Math.max(0, count - maxToLoad);
  const addrs: string[] = [];

  for (let i = start; i < count; i += pageSize) {
    const page = await reg.getAllLotteries(i, Math.min(pageSize, count - i));
    for (const a of page as string[]) addrs.push(String(a));
  }

  // show newest first
  addrs.reverse();

  // -----------------------------
  // ✅ Minimal per-lottery reads
  // -----------------------------
  const lotteries = addrs.map((addr) => new Contract(addr, SingleWinnerLotteryAbi as any, rpc));

  // status() for all
  const statuses = await Promise.all(lotteries.map((c) => safeCall<unknown>(c.status?.(), 0)));

  // sold() for all (prefer getSold() if present)
  const solds = await Promise.all(
    lotteries.map((c) =>
      safeCall<unknown>(
        (c.getSold ? c.getSold() : c.sold?.()) as Promise<unknown>,
        0n
      )
    )
  );

  // optional: keep for debugging (unused in returned type)
  void latestBlock;

  const out: LotteryListItem[] = [];

  for (let i = 0; i < addrs.length; i++) {
    const addr = addrs[i];

    const statusU8 = Number(statuses[i] as any);
    const sold = solds[i] as any;

    out.push({
      id: addr.toLowerCase(),

      // Fallback mode: we don't spend RPC on name/config. UI can show "Lottery" + address.
      name: null,

      status: statusFromUint8(Number.isFinite(statusU8) ? statusU8 : 0),

      // Registry discovery fields unknown in fallback list mode
      typeId: "1",
      creator: ZeroAddress.toLowerCase(),
      registeredAt: "0",
      registryIndex: null,

      deployedBy: null,
      deployedAt: null,
      deployedTx: null,

      usdcToken: ADDRESSES.USDC.toLowerCase(),
      feeRecipient: ZeroAddress.toLowerCase(),
      entropy: ZeroAddress.toLowerCase(),
      entropyProvider: ZeroAddress.toLowerCase(),
      callbackGasLimit: null,
      protocolFeePercent: null,

      createdAt: null,
      deadline: null,
      ticketPrice: null,
      winningPot: null,
      minTickets: null,
      maxTickets: null,
      minPurchaseAmount: null,

      // On-chain truth (minimal)
      sold: sold?.toString?.() ?? "0",

      // Unknown without extra reads; keep 0 so UI doesn't break.
      ticketRevenue: "0",

      winner: null,
      selectedProvider: null,
      entropyRequestId: null,
      drawingRequestedAt: null,
      soldAtDrawing: null,

      canceledAt: null,
      soldAtCancel: null,
      cancelReason: null,
      creatorPotRefunded: null,

      totalReservedUSDC: null,
    } as LotteryListItem);
  }

  return out;
}