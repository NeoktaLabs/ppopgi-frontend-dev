// src/components/ActivityTicker.tsx
import React, { useEffect, useState } from "react";
import { fetchGlobalActivity, type GlobalActivityItem } from "../indexer/subgraph";
import "./ActivityTicker.css";

const timeAgo = (ts: string) => {
  const diff = Math.floor(Date.now() / 1000) - Number(ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  return `${Math.floor(diff/3600)}h ago`;
};

export function ActivityTicker() {
  const [items, setItems] = useState<GlobalActivityItem[]>([]);

  useEffect(() => {
    // 1. Initial Fetch
    fetchGlobalActivity().then(setItems);

    // 2. Poll every 15s to keep it fresh
    const timer = setInterval(() => {
      fetchGlobalActivity().then(setItems);
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  if (items.length === 0) return null;

  // Duplicate items to create a seamless infinite loop
  const displayItems = [...items, ...items];

  return (
    <div className="at-container">
      <div className="at-track">
        {displayItems.map((item, i) => {
          const count = Number(item.count);
          return (
            <div key={`${item.txHash}-${i}`} className="at-item">
              <a 
                href={`https://explorer.etherlink.com/tx/${item.txHash}`} 
                target="_blank" 
                rel="noreferrer"
                className="at-link"
              >
                <span className="at-dot" />
                <span className="at-buyer">{item.buyer.slice(0,6)}...</span>
                
                {/* Dynamic Text based on count */}
                <span className="at-action">
                  bought {count > 1 ? <span style={{color:'#fff'}}>{count} tickets</span> : "a ticket"} in
                </span>
                
                <span className="at-raffle">
                  {item.raffleName || `Raffle ${item.raffleId.slice(0,4)}...`}
                </span>
                
                <span style={{ opacity: 0.5 }}>({timeAgo(item.timestamp)})</span>
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
