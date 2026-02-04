// src/components/ActivityBoard.tsx
import React, { useEffect, useState } from "react";
import { formatUnits } from "ethers";
import { fetchGlobalActivity, type GlobalActivityItem } from "../indexer/subgraph";
import "./ActivityBoard.css";

const short = (s: string) => s ? `${s.slice(0,4)}...${s.slice(-4)}` : "—";

const timeAgo = (ts: string) => {
  const diff = Math.floor(Date.now() / 1000) - Number(ts);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff/60)}m`;
  return `${Math.floor(diff/3600)}h`;
};

export function ActivityBoard() {
  const [items, setItems] = useState<GlobalActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await fetchGlobalActivity({ first: 10 });
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

  if (loading && items.length === 0) return <div className="ab-board"><div className="ab-loading">Loading...</div></div>;
  if (items.length === 0) return null;

  return (
    <div className="ab-board">
       <div className="ab-header">
          <div className="ab-pulse" />
          {/* ✅ UPDATED TEXT */}
          Live Feed (Last 10)
       </div>
       
       <div className="ab-list">
          {items.map((item, i) => {
             const isBuy = item.type === "BUY";
             const isWin = item.type === "WIN";

             let icon = "✨";
             let iconClass = "create";
             if (isBuy) { icon = "🎟️"; iconClass = "buy"; }
             if (isWin) { icon = "🏆"; iconClass = "win"; }

             return (
               <div key={`${item.txHash}-${i}`} className="ab-row">
                  <div className={`ab-icon ${iconClass}`}>
                     {icon}
                  </div>
                  <div className="ab-content">
                     <div className="ab-main-text">
                        {/* ✅ CLICKABLE ADDRESS LINK */}
                        <a 
                          href={`https://explorer.etherlink.com/address/${item.subject}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ab-user"
                        >
                          {short(item.subject)}
                        </a>

                        {isBuy && <> bought <b>{item.value} tix</b> in </>}
                        {item.type === "CREATE" && <> created </>}
                        {isWin && <> <b style={{color:'#166534'}}>won</b> the pot on </>}

                        <a href={`/?raffle=${item.raffleId}`} className="ab-link">
                           {item.raffleName}
                        </a>
                     </div>
                     <div className="ab-meta">
                        <span className="ab-time">{timeAgo(item.timestamp)}</span>
                        
                        {!isBuy && (
                           <span className={`ab-pot-tag ${isWin ? 'win' : ''}`}>
                              {isWin ? 'Won: ' : 'Pot: '} 
                              {formatUnits(item.value, 6)}
                           </span>
                        )}
                     </div>
                  </div>
               </div>
             );
          })}
       </div>
    </div>
  );
}
