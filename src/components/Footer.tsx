// src/components/Footer.tsx
import React from "react";
import "./Footer.css";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-container">
      <div className="footer-content">
        
        {/* LEFT: Branding & Copyright */}
        <div className="footer-brand">
          <div className="footer-logo">🎱 Ppopgi</div>
          <div className="footer-desc">
            Fair, verifiable, on-chain raffles on Etherlink.
          </div>
          <div className="footer-copy">
            &copy; {currentYear} Ppopgi. All rights reserved.
          </div>
        </div>

        {/* RIGHT: Links Grid */}
        <div className="footer-links">
          
          {/* Column 1: Transparency (Your Request) */}
          <div className="footer-col">
            <h4>Transparency</h4>
            <a 
              href="https://github.com/YOUR_USERNAME/ppopgi-frontend" 
              target="_blank" 
              rel="noreferrer"
            >
              Frontend Code ↗
            </a>
            <a 
              href="https://github.com/YOUR_USERNAME/ppopgi-contracts" 
              target="_blank" 
              rel="noreferrer"
            >
              Smart Contracts ↗
            </a>
            <a 
              href="https://github.com/YOUR_USERNAME/ppopgi-docs" 
              target="_blank" 
              rel="noreferrer"
            >
              Documentation ↗
            </a>
          </div>

          {/* Column 2: Community (Proposed) */}
          <div className="footer-col">
            <h4>Community</h4>
            <a href="https://twitter.com/etherlink" target="_blank" rel="noreferrer">
              Twitter / X
            </a>
            <a href="https://discord.gg/etherlink" target="_blank" rel="noreferrer">
              Discord
            </a>
            <span className="footer-version">v1.0.0 Beta</span>
          </div>

        </div>
      </div>
    </footer>
  );
}
