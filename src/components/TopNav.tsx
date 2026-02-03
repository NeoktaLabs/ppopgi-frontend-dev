// src/components/TopNav.tsx
import React, { useEffect, useMemo, useState } from "react";
import "./TopNav.css";

type Page = "home" | "explore" | "dashboard";

type Props = {
  page: Page;
  account: string | null;

  onNavigate: (p: Page) => void;
  onOpenExplore: () => void; // optional convenience, but still uses callbacks
  onOpenDashboard: () => void;
  onOpenCreate: () => void;
  onOpenCashier: () => void;
  onOpenSignIn: () => void;
  onSignOut: () => void;
};

function short(a: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function useIsMobile(breakpointPx = 760) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const onChange = () => setIsMobile(mq.matches);

    // set immediately + listen
    onChange();
    if ("addEventListener" in mq) mq.addEventListener("change", onChange);
    else (mq as any).addListener(onChange);

    return () => {
      if ("removeEventListener" in mq) mq.removeEventListener("change", onChange);
      else (mq as any).removeListener(onChange);
    };
  }, [breakpointPx]);

  return isMobile;
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
  const ink = "#4A0F2B";
  const isMobile = useIsMobile(760);

  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever key state changes (page/account)
  useEffect(() => {
    setMenuOpen(false);
  }, [page, account]);

  // ✅ New topbar visuals (same vibe as before)
  const topbar: React.CSSProperties = useMemo(
    () => ({
      display: "flex",
      gap: 12,
      alignItems: "center",
      justifyContent: "space-between",
      // IMPORTANT: no wrap on mobile; the menu becomes dropdown
      flexWrap: isMobile ? "nowrap" : "wrap",
      padding: 12,
      borderRadius: 18,
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.70), rgba(255,255,255,0.45))," +
        "radial-gradient(900px 220px at 15% 0%, rgba(255,141,187,0.18), rgba(255,141,187,0) 55%)," +
        "radial-gradient(900px 220px at 85% 0%, rgba(203,183,246,0.18), rgba(203,183,246,0) 55%)",
      border: "1px solid rgba(255,255,255,0.65)",
      boxShadow: "0 14px 30px rgba(0,0,0,0.14)",
      backdropFilter: "blur(10px)",
    }),
    [isMobile]
  );

  const brandPill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 999,
    fontWeight: 1000 as any,
    letterSpacing: 0.25,
    cursor: "pointer",
    userSelect: "none",
    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(0,0,0,0.10)",
    color: ink,
    flexShrink: 0,
  };

  const brandDot: React.CSSProperties = {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "linear-gradient(135deg, #FF8DBB, #CBB7F6)",
    boxShadow: "0 8px 14px rgba(0,0,0,0.14)",
  };

  const navGroup: React.CSSProperties = {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
  };

  const topBtn: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(255,255,255,0.78)",
    borderRadius: 14,
    padding: "10px 12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontWeight: 950,
    color: ink,
  };

  const topBtnActive: React.CSSProperties = {
    ...topBtn,
    border: "1px solid rgba(0,0,0,0.22)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
  };

  const topBtnPrimary: React.CSSProperties = {
    ...topBtn,
    background: "rgba(25,25,35,0.92)",
    color: "white",
    border: "1px solid rgba(0,0,0,0.10)",
  };

  const acctPill: React.CSSProperties = {
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

  const burgerBtn: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(255,255,255,0.85)",
    borderRadius: 14,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 950,
    color: ink,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    flexShrink: 0,
  };

  function goExplore() {
    onNavigate("explore");
    onOpenExplore();
    setMenuOpen(false);
  }

  function goDashboard() {
    onNavigate("dashboard");
    onOpenDashboard();
    setMenuOpen(false);
  }

  function goHome() {
    onNavigate("home");
    setMenuOpen(false);
  }

  function goCreate() {
    onOpenCreate();
    setMenuOpen(false);
  }

  function goCashier() {
    onOpenCashier();
    setMenuOpen(false);
  }

  function goSignIn() {
    onOpenSignIn();
    setMenuOpen(false);
  }

  function doSignOut() {
    onSignOut();
    setMenuOpen(false);
  }

  // Desktop layout (unchanged)
  const desktop = (
    <>
      <div style={navGroup}>
        <button
          style={page === "explore" ? topBtnActive : topBtn}
          onClick={goExplore}
        >
          Explore
        </button>

        {account && (
          <button
            style={page === "dashboard" ? topBtnActive : topBtn}
            onClick={goDashboard}
          >
            Dashboard
          </button>
        )}

        <button style={topBtnPrimary} onClick={goCreate}>
          Create
        </button>
      </div>

      <div style={navGroup}>
        <button style={topBtn} onClick={goCashier}>
          Cashier
        </button>

        {!account ? (
          <button style={topBtn} onClick={goSignIn}>
            Sign in
          </button>
        ) : (
          <>
            <span style={acctPill} title={account}>
              <span style={{ opacity: 0.85 }}>Account</span>
              <b style={{ letterSpacing: 0.2 }}>{short(account)}</b>
            </span>
            <button style={topBtn} onClick={doSignOut}>
              Sign out
            </button>
          </>
        )}
      </div>
    </>
  );

  // Mobile layout (burger + dropdown)
  const mobile = (
    <>
      <div className="topnav__mobileRight">
        {account ? (
          <span className="topnav__acctMini" title={account}>
            {short(account)}
          </span>
        ) : (
          <span className="topnav__acctMini">Guest</span>
        )}

        <button
          style={burgerBtn}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="ppopgi-topnav-menu"
          type="button"
        >
          <span className="topnav__burgerIcon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      <div
        id="ppopgi-topnav-menu"
        className={`topnav__mobileMenu ${menuOpen ? "isOpen" : ""}`}
        role="menu"
      >
        <button className="topnav__mobileBtn" onClick={goHome} role="menuitem">
          Home
        </button>

        <button className="topnav__mobileBtn" onClick={goExplore} role="menuitem">
          Explore
        </button>

        {account && (
          <button className="topnav__mobileBtn" onClick={goDashboard} role="menuitem">
            Dashboard
          </button>
        )}

        <button className="topnav__mobileBtnPrimary" onClick={goCreate} role="menuitem">
          Create
        </button>

        <div className="topnav__mobileDivider" />

        <button className="topnav__mobileBtn" onClick={goCashier} role="menuitem">
          Cashier
        </button>

        {!account ? (
          <button className="topnav__mobileBtn" onClick={goSignIn} role="menuitem">
            Sign in
          </button>
        ) : (
          <button className="topnav__mobileBtn" onClick={doSignOut} role="menuitem">
            Sign out
          </button>
        )}
      </div>
    </>
  );

  return (
    <div style={topbar}>
      <div style={brandPill} onClick={goHome} title="Go home">
        <span style={brandDot} />
        Ppopgi
      </div>

      {isMobile ? mobile : desktop}
    </div>
  );
}