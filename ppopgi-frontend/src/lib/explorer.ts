export function txUrl(txHash: string) {
  const base = import.meta.env.VITE_EXPLORER_TX_BASE as string;
  return base ? `${base}${txHash}` : txHash;
}

export function addrUrl(addr: string) {
  const base = import.meta.env.VITE_EXPLORER_ADDR_BASE as string;
  return base ? `${base}${addr}` : addr;
}