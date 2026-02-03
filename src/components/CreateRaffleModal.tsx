import React, { useState, useMemo } from "react";
import { formatUnits } from "ethers";
import { ADDRESSES } from "../config/contracts";
import { RaffleCard } from "./RaffleCard";
import { useCreateRaffleForm } from "../hooks/useCreateRaffleForm";
import "./CreateRaffleModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (raffleAddress?: string) => void;
};

export function CreateRaffleModal({ open, onClose, onCreated }: Props) {
  // 1. All Logic is here
  const { form, validation, derived, status, helpers } = useCreateRaffleForm(open, onCreated);
  
  // 2. UI State strictly for layout (toggles)
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [netOpen, setNetOpen] = useState(false);

  // 3. Construct Preview Object (View Logic)
  const previewRaffle = useMemo(() => ({
    id: "preview",
    name: form.name || "Your raffle",
    status: "OPEN",
    winningPot: String(derived.winningPotU),
    ticketPrice: String(derived.ticketPriceU),
    deadline: String(Math.floor(Date.now() / 1000) + validation.durationSecondsN),
    sold: "0",
    maxTickets: String(derived.maxT),
    minTickets: String(derived.minT),
    protocolFeePercent: String(derived.configData?.protocolFeePercent ?? "0"),
    feeRecipient: String(derived.configData?.feeRecipient || ADDRESSES.SingleWinnerDeployer),
    deployer: ADDRESSES.SingleWinnerDeployer,
    creator: derived.me ?? "0x000",
    lastUpdatedTimestamp: String(Math.floor(Date.now() / 1000)),
  }), [form.name, derived, validation.durationSecondsN]);

  if (!open) return null;

  return (
    <div className="crm-overlay" onMouseDown={onClose}>
      <div className="crm-modal" onMouseDown={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="crm-header">
          <div>
            <h3 style={{ margin: 0, fontWeight: 950 }}>Create a raffle</h3>
            <div className="crm-tip">You always confirm in your wallet.</div>
          </div>
          <button className="crm-btn secondary" style={{ width: "auto" }} onClick={onClose}>Close</button>
        </div>

        <div className="crm-body">
          {/* LEFT COLUMN: Form */}
          <div style={{ display: "grid", gap: 12 }}>
            
            {/* SECTION: Details */}
            <div className="crm-section blue">
              <div className="crm-grid-2" style={{ marginBottom: 10 }}>
                 <span className="crm-label">Raffle Details</span>
                 <div style={{ textAlign: "right" }}>
                   {status.usdcBal !== null && <span className="crm-pill">USDC: {formatUnits(status.usdcBal, 6)}</span>}
                 </div>
              </div>

              <div className="crm-input-group">
                <label className="crm-label">Name</label>
                <input className="crm-input" value={form.name} onChange={e => form.setName(e.target.value)} placeholder="e.g. Ppopgi #1" />
              </div>

              <div className="crm-grid-2">
                <div>
                  <label className="crm-label">Ticket Price (USDC)</label>
                  <input className="crm-input" inputMode="numeric" value={form.ticketPrice} onChange={e => form.setTicketPrice(helpers.sanitizeInt(e.target.value))} />
                </div>
                <div>
                  <label className="crm-label">Prize (USDC)</label>
                  <input className="crm-input" inputMode="numeric" value={form.winningPot} onChange={e => form.setWinningPot(helpers.sanitizeInt(e.target.value))} />
                </div>
              </div>

              <div className="crm-grid-dur" style={{ marginTop: 10 }}>
                 <div>
                   <label className="crm-label">Duration</label>
                   <input className="crm-input" inputMode="numeric" value={form.durationValue} onChange={e => form.setDurationValue(helpers.sanitizeInt(e.target.value))} />
                 </div>
                 <div>
                   <label className="crm-label">Unit</label>
                   <select className="crm-input" value={form.durationUnit} onChange={e => form.setDurationUnit(e.target.value as any)}>
                     <option value="minutes">Minutes</option>
                     <option value="hours">Hours</option>
                     <option value="days">Days</option>
                   </select>
                 </div>
              </div>

              {/* Advanced Toggle */}
              <div style={{ marginTop: 10, textAlign: "center" }}>
                <button type="button" onClick={() => setAdvancedOpen(!advancedOpen)} style={{ background: "none", border: "none", fontSize: 12, textDecoration: "underline", cursor: "pointer" }}>
                  {advancedOpen ? "Hide Advanced" : "Show Advanced Options"}
                </button>
              </div>

              {advancedOpen && (
                <div className="crm-section gray" style={{ marginTop: 10 }}>
                   <div className="crm-grid-2">
                     <div>
                       <label className="crm-label">Min Tickets</label>
                       <input className="crm-input" value={form.minTickets} onChange={e => form.setMinTickets(helpers.sanitizeInt(e.target.value))} />
                     </div>
                     <div>
                       <label className="crm-label">Max Tickets (Opt)</label>
                       <input className="crm-input" value={form.maxTickets} onChange={e => form.setMaxTickets(helpers.sanitizeInt(e.target.value))} placeholder="Unlimited" />
                     </div>
                   </div>
                </div>
              )}
            </div>

            {/* SECTION: Action */}
            <div className="crm-section green">
              <span className="crm-label">Action</span>
              <div className="crm-btn-row">
                <button 
                  className="crm-btn secondary" 
                  disabled={!validation.needsAllow} 
                  onClick={status.approve}
                >
                  {status.approvedOnce ? "Approved ✓" : "1. Approve USDC"}
                </button>
                
                <button 
                  className="crm-btn primary" 
                  disabled={!validation.canSubmit} 
                  onClick={status.create}
                >
                  {status.isPending ? "Confirming..." : "2. Create Raffle"}
                </button>
              </div>
              
              {status.msg && <div className={`crm-pill ${status.msg.includes("failed") ? "warn" : "good"}`} style={{ marginTop: 10, width: "100%", textAlign: "center" }}>{status.msg}</div>}
            </div>

            {/* SECTION: Network (Optional) */}
            <div className="crm-section orange">
               <div style={{ display: "flex", justifyContent: "space-between" }}>
                 <span className="crm-label">Network Info</span>
                 <button onClick={() => setNetOpen(!netOpen)} style={{ fontSize: 10 }}>{netOpen ? "Hide" : "Show"}</button>
               </div>
               {netOpen && <div className="crm-tip">Deployer: {ADDRESSES.SingleWinnerDeployer}</div>}
            </div>

          </div>

          {/* RIGHT COLUMN: Preview */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="crm-section gray">
              <span className="crm-label">Preview</span>
              <div style={{ transform: "scale(0.95)", transformOrigin: "top center" }}>
                {/* @ts-ignore */}
                <RaffleCard raffle={previewRaffle} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
