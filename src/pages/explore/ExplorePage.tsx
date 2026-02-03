// src/pages/ExplorePage.tsx
import { useMemo, useState } from "react";
import type { RaffleStatus } from "../../shared/lib/indexer/subgraph";
import { RaffleCard } from "../../features/raffles/components/RaffleCard/RaffleCard";
import { useExploreRaffles } from "../../features/raffles/hooks/useExploreRaffles";

// thirdweb source of truth for "my raffles"
import { useActiveAccount } from "thirdweb/react";
import { createExploreStyles } from "./ExplorePage.styles";

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
  const styles = useMemo(() => createExploreStyles(ink), [ink]);

  return (
    <div style={{ padding: 0 }}>
      <div style={styles.wrap}>
        <div style={styles.innerStroke} />
        <div style={styles.accent} />

        {/* Hero */}
        <div style={styles.hero}>
          <div>
            <div style={styles.heroTitlePill}>
              <span style={styles.heroDot} />
              🔎 Explore raffles
            </div>

            {note ? <div style={styles.subNote}>{note}</div> : null}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={styles.heroMeta}>{countLabel}</span>
            <span style={styles.heroMeta}>{filteredLabel}</span>
          </div>
        </div>

        {/* Controls */}
        <div style={styles.controls}>
          <div style={styles.panel}>
            <div style={styles.panelTitle}>
              <span>Filters</span>
              <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button style={styles.miniBtn} onClick={onClearSearch} type="button" title="Clear search">
                  Clear
                </button>
                <button style={styles.miniBtnPrimary} onClick={onResetFilters} type="button" title="Reset all filters">
                  Reset
                </button>
              </span>
            </div>

            {/* Quick toggles */}
            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                style={openOnly ? styles.pillOn : styles.pill}
                onClick={() => setOpenOnly((v) => !v)}
                aria-pressed={openOnly}
                type="button"
              >
                Open only
              </button>

              <button
                style={!me ? styles.pillDisabled : myRafflesOnly ? styles.pillOn : styles.pill}
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
            <div style={styles.row}>
              <div>
                <div style={styles.label}>Search</div>
                <input
                  style={styles.input}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name or address…"
                />
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.78, color: ink }}>
                  Tip: paste a 0x address to jump fast.
                </div>
              </div>

              <div>
                <div style={styles.label}>Status</div>
                <select style={styles.selectStyle} value={status} onChange={(e) => setStatus(e.target.value as any)}>
                  <option value="ALL">All</option>
                  <option value="FUNDING_PENDING">Getting ready</option>
                  <option value="OPEN">Open</option>
                  <option value="DRAWING">Drawing</option>
                  <option value="COMPLETED">Settled</option>
                  <option value="CANCELED">Canceled</option>
                </select>
              </div>

              <div>
                <div style={styles.label}>Sort</div>
                <select style={styles.selectStyle} value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
                  <option value="endingSoon">Ending soon</option>
                  <option value="bigPrize">Big prize</option>
                  <option value="newest">Newest</option>
                </select>
              </div>
            </div>

            {/* Small helper styles.row */}
            <div style={styles.row2}>
              <div style={{ fontSize: 12, opacity: 0.85, color: ink, lineHeight: 1.35 }}>
                You’re always in control — the app only reads data and prepares transactions for you to confirm.
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                <span style={styles.resultsPill}>Showing: {list.length}</span>
                <span style={styles.resultsPill}>Wallet: {me ? "Signed in" : "Not signed in"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div style={styles.resultsWrap}>
          <div style={styles.resultsHeader}>
            <div style={{ fontWeight: 1000, color: ink, letterSpacing: 0.2 }}>
              Results
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {openOnly && <span style={styles.resultsPill}>Open only</span>}
              {status !== "ALL" && <span style={styles.resultsPill}>Status: {status}</span>}
              {myRafflesOnly && <span style={styles.resultsPill}>My raffles</span>}
              {q.trim() && <span style={styles.resultsPill}>Search</span>}
            </div>
          </div>

          {!items && <div style={styles.emptyCard}>Loading raffles…</div>}

          {items && list.length === 0 && (
            <div style={styles.emptyCard}>
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
