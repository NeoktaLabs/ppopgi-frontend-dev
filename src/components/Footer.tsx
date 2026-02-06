import "./Footer.css";
import logo from "../assets/ppopgi-logo.png"; // adjust path if needed

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-container">
      <div className="footer-content">
        
        {/* LEFT: Branding & Copyright */}
        <div className="footer-brand">
          <div className="footer-logo-row">
            <img
              src={logo}
              alt="Ppopgi logo"
              className="footer-logo-img"
            />
            <span className="footer-logo-text">Ppopgi</span>
          </div>

          <div className="footer-desc">
            Fair, verifiable, on-chain raffles on Etherlink.
          </div>

          <div className="footer-copy">
            &copy; {currentYear} Ppopgi. All rights reserved.
          </div>
        </div>

        {/* RIGHT: Links Grid */}
        <div className="footer-links">
          
          {/* Column 1: Transparency */}
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

          {/* Column 2: Community */}
          <div className="footer-col">
            <h4>Community</h4>
            <a
              href="https://twitter.com/etherlink"
              target="_blank"
              rel="noreferrer"
            >
              Twitter / X
            </a>
            <span className="footer-version">v1.0.0 Beta</span>
          </div>

        </div>
      </div>
    </footer>
  );
}