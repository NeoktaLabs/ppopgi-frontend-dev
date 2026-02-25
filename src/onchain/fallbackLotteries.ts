// src/onchain/fallbackLotteries.ts
import { Contract, JsonRpcProvider, ZeroAddress } from "ethers";
import { ADDRESSES } from "../config/contracts";
import LotteryRegistryAbi from "../config/abis/LotteryRegistry.json";
import SingleWinnerLotteryAbi from "../config/abis/SingleWinnerLottery.json";
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

const ZERO_TX =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

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
  const reg = new Contract(ADDRESSES.LotteryRegistry, LotteryRegistryAbi, rpc);

  const [countBn, latestBlock] = await Promise.all([
    reg.getAllLotteriesCount(),
    rpc.getBlockNumber(),
  ]);

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

  const nowSec = String(Math.floor(Date.now() / 1000));
  const nowBlock = String(latestBlock);

  const out: LotteryListItem[] = [];

  for (const addr of addrs) {
    const lottery = new Contract(addr, SingleWinnerLotteryAbi, rpc);

    const [
      name,
      statusU8,
      winningPot,
      ticketPrice,
      deadline,
      sold,
      minTickets,
      maxTickets,
      protocolFeePercent,
      feeRecipient,
      deployer,
      creator,

      // token / entropy fields (best effort)
      usdcToken,
      entropy,
      entropyProvider,
      callbackGasLimit,
      minPurchaseAmount,

      // accounting / state
      ticketRevenue,
      paused,

      // optional lifecycle fields (may or may not exist on ABI)
      winner,
      selectedProvider,
      finalizedAt,
      completedAt,
      canceledAt,
      canceledReason,
      soldAtCancel,
      finalizeRequestId,
      winningTicketIndex,
    ] = await Promise.all([
      safeCall(lottery.name(), ""),
      safeCall(lottery.status(), 0),

      safeCall(lottery.winningPot(), 0n as any),
      safeCall(lottery.ticketPrice(), 0n as any),
      safeCall(lottery.deadline(), 0n as any),
      safeCall(lottery.getSold?.(), 0n as any),

      safeCall(lottery.minTickets?.(), 0n as any),
      safeCall(lottery.maxTickets?.(), 0n as any),

      safeCall(lottery.protocolFeePercent?.(), 0n as any),
      safeCall(lottery.feeRecipient?.(), ZeroAddress),
      safeCall(lottery.deployer?.(), ZeroAddress),
      safeCall(lottery.creator?.(), ZeroAddress),

      // ✅ NEW: prefer usdcToken() (your new schema uses usdcToken)
      safeCall(lottery.usdcToken?.(), ADDRESSES.USDC),

      safeCall(lottery.entropy?.(), ZeroAddress),
      safeCall(lottery.entropyProvider?.(), ZeroAddress),
      safeCall(lottery.callbackGasLimit?.(), 0),
      safeCall(lottery.minPurchaseAmount?.(), 0),

      safeCall(lottery.ticketRevenue?.(), 0n as any),
      safeCall(lottery.paused?.(), false),

      safeCall(lottery.winner?.(), null),
      safeCall(lottery.selectedProvider?.(), null),
      safeCall(lottery.finalizedAt?.(), null),
      safeCall(lottery.completedAt?.(), null),
      safeCall(lottery.canceledAt?.(), null),
      safeCall(lottery.canceledReason?.(), null),
      safeCall(lottery.soldAtCancel?.(), null),
      safeCall(lottery.finalizeRequestId?.(), null),
      safeCall(lottery.winningTicketIndex?.(), null),
    ]);

    // createdAt() is not guaranteed — keep it best-effort
    const createdAtTimestamp = String(await safeCall(lottery.createdAt?.(), 0));

    // ✅ Map to your NEW list item shape (and keep extra fields as optional)
    out.push({
      id: addr.toLowerCase(),
      name: String(name || ""),

      status: statusFromUint8(Number(statusU8)),

      // “registry discovery” fields are unknown on fallback
      deployer: String(deployer || ZeroAddress).toLowerCase(),
      registry: null,
      typeId: "1",
      registryIndex: null,
      isRegistered: false,
      registeredAt: null,

      creator: String(creator || ZeroAddress).toLowerCase(),
      createdAtBlock: "0",
      createdAtTimestamp,
      creationTx: ZERO_TX,

      // ✅ NEW FIELD NAME
      usdcToken: String(usdcToken || ADDRESSES.USDC).toLowerCase(),

      entropy: String(entropy || ZeroAddress).toLowerCase(),
      entropyProvider: String(entropyProvider || ZeroAddress).toLowerCase(),

      feeRecipient: String(feeRecipient || ZeroAddress).toLowerCase(),
      protocolFeePercent: protocolFeePercent?.toString?.() ?? "0",
      callbackGasLimit: String(callbackGasLimit ?? 0),
      minPurchaseAmount: String(minPurchaseAmount ?? 0),

      winningPot: winningPot?.toString?.() ?? "0",
      ticketPrice: ticketPrice?.toString?.() ?? "0",
      deadline: deadline?.toString?.() ?? "0",
      minTickets: minTickets?.toString?.() ?? "0",
      maxTickets: maxTickets?.toString?.() ?? "0",

      sold: sold?.toString?.() ?? "0",
      ticketRevenue: ticketRevenue?.toString?.() ?? "0",
      paused: Boolean(paused),

      finalizeRequestId: finalizeRequestId ? String(finalizeRequestId) : null,
      finalizedAt: finalizedAt ? String(finalizedAt) : null,
      selectedProvider: selectedProvider ? String(selectedProvider) : null,

      winner: winner ? String(winner).toLowerCase() : null,
      winningTicketIndex: winningTicketIndex ? String(winningTicketIndex) : null,
      completedAt: completedAt ? String(completedAt) : null,

      canceledReason: canceledReason ? String(canceledReason) : null,
      canceledAt: canceledAt ? String(canceledAt) : null,
      soldAtCancel: soldAtCancel ? String(soldAtCancel) : null,

      lastUpdatedBlock: nowBlock,
      lastUpdatedTimestamp: nowSec,
    } as LotteryListItem);
  }

  return out;
}