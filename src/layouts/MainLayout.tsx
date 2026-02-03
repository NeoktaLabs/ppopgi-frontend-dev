// src/layouts/MainLayout.tsx
import React, { ReactNode, useMemo } from "react";
import { TopNav } from "../components/TopNav";
import { DisclaimerGate } from "../components/DisclaimerGate";
import { Toast } from "../components/Toast"; 
import { WrongNetworkNotice } from "../components/WrongNetworkNotice";
import "./MainLayout.css";

// Import your backgrounds
import bg1 from "../assets/backgrounds/bg1.webp";
import bg2 from "../assets/backgrounds/bg2.webp";
import bg3 from "../assets/backgrounds/bg3.webp";

const BACKGROUNDS = [bg1, bg2, bg3];

type Props = {
  children: ReactNode;
  // Navigation props passed down from App.tsx
  page: "home" | "explore" | "dashboard";
  onNavigate: (page: "home" | "explore" | "dashboard") => void;
  account: string | null;
  onOpenSignIn: () => void;
  onOpenCreate: () => void;
  onOpenCashier: () => void;
  onSignOut: () => void;
};

export function MainLayout({ 
  children, 
  page, 
  onNavigate, 
  account, 
  onOpenSignIn, 
  onOpenCreate, 
  onOpenCashier, 
  onSignOut 
}: Props) {
  
  // Pick a random background once on mount
  const chosenBg = useMemo(() => BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)], []);

  return (
    <div className="layout-shell">
      {/* 1. Global Background */}
      <div 
        className="layout-bg" 
        style={{ backgroundImage: `url(${chosenBg})` }} 
      />
      <div className="layout-overlay" />

      {/* 2. Global Gates & Modals */}
      <DisclaimerGate />
      <WrongNetworkNotice />
      <Toast /> 

      {/* 3. Navigation */}
      <TopNav 
        page={page}
        account={account}
        onNavigate={(p) => onNavigate(p as any)}
        onOpenExplore={() => onNavigate("explore")}
        onOpenDashboard={() => onNavigate("dashboard")}
        onOpenCreate={onOpenCreate}
        onOpenCashier={onOpenCashier}
        onOpenSignIn={onOpenSignIn}
        onSignOut={onSignOut}
      />

      {/* 4. Page Content */}
      <main className="layout-content">
        {children}
      </main>
    </div>
  );
}
