// src/pages/ExplorePage.tsx
import React, { useMemo, useState } from "react";
import type { RaffleStatus } from "../indexer/subgraph";
import { RaffleCard } from "../components/RaffleCard";
import { useExploreRaffles } from "../hooks/useExploreRaffles";

// thirdweb source of truth for "my raffles"
import { useActiveAccount } from "thirdweb/react";

type SortMode = "endingSoon" | "bigPrize" | "newest";

type Props = {
  onOpenRaffle: (id: string) => void;
};

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

function isActiveStatus(status: RaffleStatus) {
  return status === "OPEN" || status === "FUNDING_PENDING";
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function ExplorePage({ onOpenRaffle }: Props) {
  const { items, note } = useExploreRaffles(500);

  const activeAccount = useActiveAccount();
  const me = activeAccount?.address ? norm(activeAccount.address) : null;

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<RaffleStatus | "ALL">("ALL");
  const [sort, setSort] = useState<SortMode>("endingSoon");

  // quick toggles
  const [openOnly, setOpenOnly] = useState(false);
  const [myRafflesOnly, setMyRafflesOnly] = useState(false);

  const list = useMemo(() => {
    const all = items ?? [];

    // status filter
    let filtered = status === "ALL" ? all : all.filter((r) => r.status === status);

    // quick toggle: open only
    if (openOnly) {
      filtered = filtered.filter((r) => isActiveStatus(r.status));
    }

    // quick toggle: my raffles (creator-based)
    if (myRafflesOnly && me) {
      filtered = filtered.filter((r: any) => {
        const creator = r.creator ? norm(String(r.creator)) : null;
        return creator === me;
      });
    }

    // search: name or address
    const query = norm(q);
    if (query) {
      filtered = filtered.filter((r) => {
        const hay = `${r.name || ""} ${r.id || ""}`.toLowerCase();
        return hay.includes(query);
      });
    }

    // sort
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "endingSoon") {
        const A = safeNum(a.deadline || "0");
        const B = safeNum(b.deadline || "0");
        return A - B;
      }
      if (sort === "bigPrize") {
        let A = 0n;
        let B = 0n;
        try {
          A = BigInt(a.winningPot || "0");
          B = BigInt(b.winningPot || "0");
        } catch {}
        if (A === B) return 0;
        return A > B ? -1 : 1;
      }
      const A = safeNum(a.lastUpdatedTimestamp || "0");
      const B = safeNum(b.lastUpdatedTimestamp || "0");
      if (A !== B) return B - A;
      return String(a.id).localeCompare(String(b.id));
    });

    return sorted;
  }, [items, q, status, sort, openOnly, myRafflesOnly, me]);

  const countLabel = useMemo(() => {
    if (!items) return "…";
    return `${items.length} raffles`;
  }, [items]);

  const filteredLabel = useMemo(() => {
    if (!items) return "Loading…";
    return `${list.length} shown`;
  }, [items, list.length]);

  function onResetFilters() {
    setQ("");
    setStatus("ALL");
    setSort("endingSoon");
    setOpenOnly(false);
    setMyRafflesOnly(false);
  }

  function onClearSearch() {
    setQ("");
  }

  const ink = "#4A0F2B";

  // --- Page shell
  const wrap: React.CSSProperties = {
    marginTop: 18,
    padding: 16,
    borderRadius: 24,
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))," +
      "radial-gradient(900px 240px at 10% 0%, rgba(255,141,187,0.10), rgba(255,141,187,0) 55%)," +
      "radial-gradient(900px 240px at 90% 0%, rgba(203,183,246,0.10), rgba(203,183,246,0) 55%)",
    backdropFilter: "blur(3px)",
    border: "2px solid rgba(255,255,255,0.55)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.16)",
  };

  const innerStroke: React.CSSProperties = {
    position: "absolute",
    inset: 6,
    borderRadius: 20,
    pointerEvents: "none",
    border: "1px solid rgba(242,166,198,0.55)",
  };

  const accent: React.CSSProperties = {
    position: "absolute",
    top: 12,
    bottom: 12,
    left: 12,
    width: 6,
    borderRadius: 999,
    background: "linear-gradient(180deg, #FF8DBB, #CBB7F6, #FFD89A)",
    boxShadow: "0 10px 18px rgba(0,0,0,0.12)",
  };

  // --- Hero
  const hero: React.CSSProperties = {
    paddingLeft: 18,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  };

  const heroTitlePill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 999,
    fontWeight: 1000 as any,
    fontSize: 16,
    letterSpacing: 0.25,
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(0,0,0,0.10)",
    color: ink,
    boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
  };

  const heroDot: React.CSSProperties = {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "linear-gradient(135deg, rgba(255,141,187,0.95), rgba(203,183,246,0.95))",
    boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
  };

  const heroMeta: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.70)",
    border: "1px solid rgba(0,0,0,0.10)",
    fontWeight: 950,
    color: ink,
    whiteSpace: "nowrap",
  };

  const subNote: React.CSSProperties = {
    marginTop: 10,
    paddingLeft: 18,
    fontSize: 13,
    fontWeight: 850,
    opacity: 0.95,
    color: ink,
  };

  // --- Controls
  const controls: React.CSSProperties = {
    marginTop: 14,
    paddingLeft: 18,
    display: "grid",
    gap: 12,
  };

  const panel: React.CSSProperties = {
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.56)",
    border: "1px solid rgba(0,0,0,0.06)",
    boxShadow: "0 10px 18px rgba(0,0,0,0.08)",
  };

  const panelTitle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 1000,
    letterSpacing: 0.35,
    textTransform: "uppercase",
    opacity: 0.9,
    color: ink,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  };

  const row: React.CSSProperties = {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr 1fr",
    gap: 10,
  };

  const row2: React.CSSProperties = {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  };

  const label: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 950,
    opacity: 0.9,
    color: ink,
    marginBottom: 6,
  };

  const input: React.CSSProperties = {
    width: "100%",
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.86)",
    borderRadius: 14,
    padding: "11px 12px",
    outline: "none",
    color: "rgba(20,20,28,0.92)",
    fontWeight: 850,
  };

  const selectStyle: React.CSSProperties = {
    ...input,
    cursor: "pointer",
  };

  const pill: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.78)",
    borderRadius: 999,
    padding: "10px 12px",
    cursor: "pointer",
    color: ink,
    fontWeight: 950,
    fontSize: 13,
    whiteSpace: "nowrap",
  };

  const pillOn: React.CSSProperties = {
    ...pill,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
  };

  const pillDisabled: React.CSSProperties = {
    ...pill,
    opacity: 0.55,
    cursor: "not-allowed",
  };

  const miniBtn: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.82)",
    borderRadius: 14,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 950,
    color: ink,
    whiteSpace: "nowrap",
  };

  const miniBtnPrimary: React.CSSProperties = {
    ...miniBtn,
    background: "rgba(25,25,35,0.92)",
    color: "white",
  };

  const resultsWrap: React.CSSProperties = {
    marginTop: 14,
    paddingLeft: 18,
    display: "grid",
    gap: 10,
  };

  const resultsHeader: React.CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  };

  const resultsPill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.78)",
    fontWeight: 950,
    fontSize: 12,
    color: ink,
  };

  const emptyCard: React.CSSProperties = {
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.56)",
    border: "1px solid rgba(0,0,0,0.06)",
    color: ink,
    fontWeight: 900,
    opacity: 0.95,
  };

  return (
    <div style={{ padding: 0 }}>
      <div style={wrap}>
        <div style={innerStroke} />
        <div style={accent} />

        {/* Hero */}
        <div style={hero}>
          <div>
            <div style={heroTitlePill}>
              <span style={heroDot} />
              🔎 Explore raffles
            </div>

            {note ? <div style={subNote}>{note}</div> : null}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={heroMeta}>{countLabel}</span>
            <span style={heroMeta}>{filteredLabel}</span>
          </div>
        </div>

        {/* Controls */}
        <div style={controls}>
          <div style={panel}>
            <div style={panelTitle}>
              <span>Filters</span>
              <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button style={miniBtn} onClick={onClearSearch} type="button" title="Clear search">
                  Clear
                </button>
                <button style={miniBtnPrimary} onClick={onResetFilters} type="button" title="Reset all filters">
                  Reset
                </button>
              </span>
            </div>

            {/* Quick toggles */}
            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                style={openOnly ? pillOn : pill}
                onClick={() => setOpenOnly((v) => !v)}
                aria-pressed={openOnly}
                type="button"
              >
                Open only
              </button>

              <button
                style={!me ? pillDisabled : myRafflesOnly ? pillOn : pill}
                onClick={() => {
                  if (!me) return;
                  setMyRafflesOnly((v) => !v);
                }}
                aria-pressed={myRafflesOnly}
                disabled={!me}
                title={!me ? "Sign in to filter your raffles" : "Show only raffles you created"}
                type="button"
              >
                My raffles
              </button>
            </div>

            {/* Search + dropdowns */}
            <div style={row}>
              <div>
                <div style={label}>Search</div>
                <input
                  style={input}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name or address…"
                />
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.78, color: ink }}>
                  Tip: paste a 0x address to jump fast.
                </div>
              </div>

              <div>
                <div style={label}>Status</div>
                <select style={selectStyle} value={status} onChange={(e) => setStatus(e.target.value as any)}>
                  <option value="ALL">All</option>
                  <option value="FUNDING_PENDING">Getting ready</option>
                  <option value="OPEN">Open</option>
                  <option value="DRAWING">Drawing</option>
                  <option value="COMPLETED">Settled</option>
                  <option value="CANCELED">Canceled</option>
                </select>
              </div>

              <div>
                <div style={label}>Sort</div>
                <select style={selectStyle} value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
                  <option value="endingSoon">Ending soon</option>
                  <option value="bigPrize">Big prize</option>
                  <option value="newest">Newest</option>
                </select>
              </div>
            </div>

            {/* Small helper row */}
            <div style={row2}>
              <div style={{ fontSize: 12, opacity: 0.85, color: ink, lineHeight: 1.35 }}>
                You’re always in control — the app only reads data and prepares transactions for you to confirm.
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                <span style={resultsPill}>Showing: {list.length}</span>
                <span style={resultsPill}>Wallet: {me ? "Signed in" : "Not signed in"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div style={resultsWrap}>
          <div style={resultsHeader}>
            <div style={{ fontWeight: 1000, color: ink, letterSpacing: 0.2 }}>
              Results
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {openOnly && <span style={resultsPill}>Open only</span>}
              {status !== "ALL" && <span style={resultsPill}>Status: {status}</span>}
              {myRafflesOnly && <span style={resultsPill}>My raffles</span>}
              {q.trim() && <span style={resultsPill}>Search</span>}
            </div>
          </div>

          {!items && <div style={emptyCard}>Loading raffles…</div>}

          {items && list.length === 0 && (
            <div style={emptyCard}>
              No raffles match your filters.
              {!me && myRafflesOnly ? " (Sign in to use “My raffles”.)" : ""}
            </div>
          )}

          {list.map((r) => (
            <RaffleCard key={r.id} raffle={r} onOpen={onOpenRaffle} />
          ))}
        </div>
      </div>
    </div>
  );
}