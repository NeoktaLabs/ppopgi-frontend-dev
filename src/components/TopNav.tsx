import { useState, useEffect, memo } from "react";
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

export const TopNav = memo(function TopNav({
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

  // Close menu when page changes
  useEffect(() => {
    setMenuOpen(false);
  }, [page]);

  const handleNav = (action: () => void, targetPage?: Page) => {
    if (targetPage) onNavigate(targetPage);
    action();
    setMenuOpen(false);
  };

  return (
    <div className="topnav-wrapper">
      <div className="topnav-pill">
        {/* LEFT: BRAND */}
        <div className="topnav-brand" onClick={() => handleNav(() => {}, "home")}>
          <div className="brand-dot" />
          <span className="brand-text">Ppopgi</span>
        </div>

        {/* CENTER: DESKTOP LINKS */}
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

        {/* RIGHT */}
        <div className="topnav-right">
          {/* DESKTOP ACTIONS */}
          <div className="desktop-actions">
            <button
              className="nav-link cashier-btn"
              onClick={() => {
                setMenuOpen(false);
                onOpenCashier();
              }}
            >
              🏦 Cashier
            </button>

            {!account ? (
              <button
                className="nav-link signin-btn"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenSignIn();
                }}
              >
                Sign In
              </button>
            ) : (
              <div className="account-badge" onClick={onSignOut}>
                <div className="acct-dot" />
                {short(account)}
              </div>
            )}
          </div>

          {/* MOBILE BURGER */}
          <button
            className={`mobile-burger ${menuOpen ? "open" : ""}`}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}
      <div className={`mobile-menu ${menuOpen ? "visible" : ""}`}>
        <div className="mobile-menu-inner">
          <button onClick={() => handleNav(onOpenExplore, "explore")}>🌍 Explore</button>

          {account && (
            <button onClick={() => handleNav(onOpenDashboard, "dashboard")}>👤 Dashboard</button>
          )}

          <button className="highlight" onClick={() => handleNav(onOpenCreate)}>
            ✨ Create Raffle
          </button>

          <div className="mobile-divider" />

          <button
            onClick={() => {
              setMenuOpen(false);
              onOpenCashier();
            }}
          >
            🏦 Cashier
          </button>

          {!account ? (
            <button
              className="primary"
              onClick={() => {
                setMenuOpen(false);
                onOpenSignIn();
              }}
            >
              Sign In
            </button>
          ) : (
            <button className="danger" onClick={onSignOut}>
              Sign Out ({short(account)})
            </button>
          )}
        </div>
      </div>

      {/* CLICK-OUTSIDE OVERLAY */}
      {menuOpen && <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />}
    </div>
  );
});