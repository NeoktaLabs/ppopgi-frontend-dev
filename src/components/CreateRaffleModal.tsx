// src/components/CreateRaffleModal.tsx
import React, { useState, useMemo } from "react";
import { formatUnits } from "ethers";
import { ADDRESSES } from "../config/contracts";
import { RaffleCard } from "./RaffleCard";
import { useCreateRaffleForm } from "../hooks/useCreateRaffleForm";
import { useConfetti } from "../hooks/useConfetti"; // ✅ Import Confetti
import "./CreateRaffleModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (raffleAddress?: string) => void;
};

export function CreateRaffleModal({ open, onClose, onCreated }: Props) {
  // ✅ Setup Confetti
  const { fireConfetti } = useConfetti();

  // Intercept success to fire confetti
  const handleSuccess = (addr?: string) => {
    fireConfetti();
    if (onCreated) onCreated(addr);
  };

  const { form, validation, derived, status, helpers } = useCreateRaffleForm(open, handleSuccess);
  
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Construct Preview
  const previewRaffle = useMemo(() => ({
    id: "preview",
    name: form.name || "Your Raffle Name",
    status: "OPEN", // Force open for preview visuals
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
          <div className="crm-header-text">
            <h3>Creator Studio</h3>
            <span>Launch your provably fair raffle in seconds.</span>
          </div>
          <button className="crm-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="crm-body">
          
          {/* LEFT: Configuration */}
          <div className="crm-form-col">
            
            {/* Balance Badge */}
            <div className="crm-bal-row">
               <span className="crm-bal-label">My Balance</span>
               <span className="crm-bal-val">
                 {status.usdcBal !== null ? formatUnits(status.usdcBal, 6) : "..."} USDC
               </span>
            </div>

            {/* Inputs */}
            <div className="crm-input-group">
              <label>Raffle Name</label>
              <input 
                className="crm-input" 
                value={form.name} 
                onChange={e => form.setName(e.target.value)} 
                placeholder="e.g. Bored Ape #8888" 
                maxLength={32}
              />
            </div>

            <div className="crm-grid-2">
              <div className="crm-input-group">
                <label>Ticket Price</label>
                <div className="crm-input-wrapper">
                  <input inputMode="numeric" value={form.ticketPrice} onChange={e => form.setTicketPrice(helpers.sanitizeInt(e.target.value))} />
                  <span className="crm-suffix">USDC</span>
                </div>
              </div>
              <div className="crm-input-group">
                <label>Total Prize</label>
                <div className="crm-input-wrapper">
                  <input inputMode="numeric" value={form.winningPot} onChange={e => form.setWinningPot(helpers.sanitizeInt(e.target.value))} />
                  <span className="crm-suffix">USDC</span>
                </div>
              </div>
            </div>

            <div className="crm-grid-dur">
               <div className="crm-input-group">
                 <label>Duration</label>
                 <input className="crm-input" inputMode="numeric" value={form.durationValue} onChange={e => form.setDurationValue(helpers.sanitizeInt(e.target.value))} />
               </div>
               <div className="crm-input-group">
                 <label>Unit</label>
                 <select className="crm-select" value={form.durationUnit} onChange={e => form.setDurationUnit(e.target.value as any)}>
                   <option value="minutes">Minutes</option>
                   <option value="hours">Hours</option>
                   <option value="days">Days</option>
                 </select>
               </div>
            </div>

            {/* Advanced Accordion */}
            <div className="crm-advanced">
              <button type="button" className="crm-adv-toggle" onClick={() => setAdvancedOpen(!advancedOpen)}>
                {advancedOpen ? "− Less Options" : "+ Advanced Options (Limits)"}
              </button>
              
              {advancedOpen && (
                <div className="crm-adv-content">
                   <div className="crm-grid-2">
                     <div className="crm-input-group">
                       <label>Min Tickets to Draw</label>
                       <input className="crm-input" value={form.minTickets} onChange={e => form.setMinTickets(helpers.sanitizeInt(e.target.value))} />
                     </div>
                     <div className="crm-input-group">
                       <label>Max Capacity (Opt)</label>
                       <input className="crm-input" value={form.maxTickets} onChange={e => form.setMaxTickets(helpers.sanitizeInt(e.target.value))} placeholder="∞" />
                     </div>
                   </div>
                </div>
              )}
            </div>

            {/* ACTION FOOTER */}
            <div className="crm-actions">
              <div className="crm-steps">
                {/* Step 1: Approve */}
                <button 
                  className={`crm-step-btn ${status.approvedOnce ? "done" : "active"}`}
                  onClick={status.approve}
                  disabled={!validation.needsAllow || status.approvedOnce}
                >
                  <span className="crm-step-icon">{status.approvedOnce ? "✓" : "1"}</span>
                  <span>{status.approvedOnce ? "USDC Approved" : "Approve USDC"}</span>
                </button>

                <div className="crm-step-line" />

                {/* Step 2: Create */}
                <button 
                  className={`crm-step-btn ${status.approvedOnce ? "active primary" : ""}`}
                  onClick={status.create}
                  disabled={!validation.canSubmit || status.isPending}
                >
                  <span className="crm-step-icon">{status.isPending ? "⏳" : "2"}</span>
                  <span>{status.isPending ? "Creating..." : "Launch Raffle"}</span>
                </button>
              </div>
              
              {status.msg && <div className="crm-status-msg">{status.msg}</div>}
            </div>

          </div>

          {/* RIGHT: Preview (Sticky) */}
          <div className="crm-preview-col">
            <div className="crm-preview-label">Live Preview</div>
            <div className="crm-card-wrapper">
               {/* @ts-ignore */}
               <RaffleCard raffle={previewRaffle} onOpen={()=>{}} ribbon="gold" />
            </div>
            <div className="crm-network-tip">
               Network: Etherlink Mainnet
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
