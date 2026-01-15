export function timeAgoFromSeconds(ts: string | number) {
  const t = typeof ts === "string" ? Number(ts) : ts;
  if (!t || Number.isNaN(t)) return "";
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, now - t);

  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}