// src/chain/etherlink.ts
import { ETHERLINK_CHAIN } from "./etherlink";

function toHexChainId(chainId: number) {
  return "0x" + chainId.toString(16).toUpperCase();
}

export const ETHERLINK_MAINNET = {
  chainId: ETHERLINK_CHAIN.id,
  chainIdHex: toHexChainId(ETHERLINK_CHAIN.id),
  chainName: ETHERLINK_CHAIN.name,
  nativeCurrency: ETHERLINK_CHAIN.nativeCurrency,
  rpcUrls: [ETHERLINK_CHAIN.rpc],
  blockExplorerUrls: (ETHERLINK_CHAIN.blockExplorers || []).map((b: any) => (b as any).url),
} as const;