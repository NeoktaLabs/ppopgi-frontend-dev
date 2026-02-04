// src/components/ActivityBoard.tsx
import React, { useEffect, useState } from "react";
import { formatUnits } from "ethers";
import { fetchGlobalActivity, type GlobalActivityItem } from "../indexer/subgraph";
import "./ActivityBoard.css";

const short = (s: string) => s ? `${s.slice(0,4)}...${s.slice(-4)}` : "—";

const timeAgo = (ts: string) => {
  const diff = Math.floor(Date.now() / 1000) - Number(ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  return `${Math.floor(diff/3600)}h ago`;
};

export function ActivityBoard() {
  const [items, setItems] = useState<GlobalActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      // ✅ Fetch 15 items as requested
      const data = await fetchGlobalActivity({ first: 15 });
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); 
    return () => clearInterval(t);
  }, []);

  if (loading && items.length === 0) return <div className="ab-board"><div className="ab-loading">Loading live activity...</div></div>;
  if (items.length === 0) return null;

  return (
    <div className="ab-board">
       <div className="ab-header">
          <div className="ab-pulse" />
          Live Activity (Last 15)
       </div>
       
       <div className="ab-list">
          {items.map((item, i) => {
             const isBuy = item.type === "BUY";
             return (
               <div key={`${item.txHash}-${i}`} className="ab-row">
                  <div className={`ab-icon ${isBuy ? "buy" : "create"}`}>
                     {isBuy ? "🎟️" : "✨"}
                  </div>
                  <div className="ab-content">
                     <div className="ab-main-text">
                        <span className="ab-user">{short(item.subject)}</span>
                        {isBuy ? (
                           <> bought <b>{item.value} tickets</b> in </>
                        ) : (
                           <> created </>
                        )}
                        <a href={`/?raffle=${item.raffleId}`} className="ab-link">
                           {item.raffleName}
                        </a>
                     </div>
                     <div className="ab-sub-text">
                        {timeAgo(item.timestamp)}
                        {!isBuy && <span className="ab-pot-tag">Pot: {formatUnits(item.value, 6)} USDC</span>}
                     </div>
                  </div>
               </div>
             );
          })}
       </div>
    </div>
  );
}
