// src/components/TopNav.tsx
import React, { useState, useEffect } from "react";
import "./TopNav.css";

type Page = "home" | "explore" | "dashboard";

type Props = {
  page: Page;
  account: string | null;
  onNavigate: (p: Page) => void;
  onOpenExplore: () => void;
  onOpenDashboard: () => void;
  onOpenCreate: () => void;
  onOpenCashier: () => void;
  onOpenSignIn: () => void;
  onSignOut: () => void;
};

function short(a: string) {
  if (!a) return "—";
  return `${a.slice(0, 5)}…${a.slice(-4)}`;
}

export function TopNav({
  page,
  account,
  onNavigate,
  onOpenExplore,
  onOpenDashboard,
  onOpenCreate,
  onOpenCashier,
  onOpenSignIn,
  onSignOut,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on navigation
  useEffect(() => { setMenuOpen(false); }, [page, account]);

  // Navigation Handlers
  const handleNav = (action: () => void, targetPage?: Page) => {
    if (targetPage) onNavigate(targetPage);
    action();
    setMenuOpen(false);
  };

  return (
    <div className="topnav-wrapper">
      <div className="topnav-pill">
        
        {/* --- LEFT: Brand --- */}
        <div className="topnav-brand" onClick={() => handleNav(() => {}, "home")}>
          <div className="brand-dot" />
          <span className="brand-text">Ppopgi</span>
        </div>

        {/* --- CENTER: Desktop Links --- */}
        <nav className="topnav-desktop-links">
          <button 
            className={`nav-link ${page === "explore" ? "active" : ""}`} 
            onClick={() => handleNav(onOpenExplore, "explore")}
          >
            Explore
          </button>
          
          {account && (
            <button 
              className={`nav-link ${page === "dashboard" ? "active" : ""}`} 
              onClick={() => handleNav(onOpenDashboard, "dashboard")}
            >
              Dashboard
            </button>
          )}

          <button className="nav-link create-btn" onClick={() => handleNav(onOpenCreate)}>
            Create
          </button>
        </nav>

        {/* --- RIGHT: Account & Mobile Toggle --- */}
        <div className="topnav-right">
          
          {/* Desktop Only Actions */}
          <div className="desktop-actions">
            <button className="nav-icon-btn" onClick={onOpenCashier} title="Cashier">
              💳
            </button>
            {!account ? (
              <button className="nav-link signin-btn" onClick={onOpenSignIn}>Sign In</button>
            ) : (
              <div className="account-badge" onClick={onSignOut} title="Click to Sign Out">
                <div className="acct-dot" />
                {short(account)}
              </div>
            )}
          </div>

          {/* Mobile Toggle */}
          <button 
            className={`mobile-burger ${menuOpen ? "open" : ""}`} 
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span />
            <span />
          </button>

        </div>
      </div>

      {/* --- MOBILE DROPDOWN (Floating Card) --- */}
      <div className={`mobile-menu ${menuOpen ? "visible" : ""}`}>
        <div className="mobile-menu-inner">
           <button onClick={() => handleNav(onOpenExplore, "explore")}>🌍 Explore</button>
           {account && <button onClick={() => handleNav(onOpenDashboard, "dashboard")}>👤 Dashboard</button>}
           <button className="highlight" onClick={() => handleNav(onOpenCreate)}>✨ Create Raffle</button>
           
           <div className="mobile-divider" />
           
           <button onClick={onOpenCashier}>💳 Cashier</button>
           
           {!account ? (
             <button className="primary" onClick={onOpenSignIn}>Sign In</button>
           ) : (
             <button className="danger" onClick={onSignOut}>Sign Out ({short(account)})</button>
           )}
        </div>
      </div>
      
      {/* Overlay to close menu when clicking outside */}
      {menuOpen && <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />}
    </div>
  );
}
