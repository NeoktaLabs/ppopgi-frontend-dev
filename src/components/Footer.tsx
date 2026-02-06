import "./Footer.css";
import ppopgiLogo from "../assets/ppopgi-logo.png";
import etherlinkLogo from "../assets/etherlink-logo.png";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-container">
      <div className="footer-content">
        
        {/* LEFT: Branding & Copyright */}
        <div className="footer-brand">
          <div className="footer-logo-row">
            <img
              src={ppopgiLogo}
              alt="Ppopgi logo"
              className="footer-logo-img"
            />
            <span className="footer-logo-text">Ppopgi</span>
          </div>

          <div className="footer-desc">
            Fair, verifiable, on-chain raffles on Etherlink.
          </div>

          {/* Etherlink attribution */}
          <div className="footer-powered">
            <span>Powered by</span>
            <a
              href="https://etherlink.com"
              target="_blank"
              rel="noreferrer"
              className="footer-etherlink"
            >
              <img
                src={etherlinkLogo}
                alt="Etherlink"
                className="footer-etherlink-logo"
              />
              <span>Etherlink</span>
            </a>
          </div>

          <div className="footer-copy">
            &copy; {currentYear} Ppopgi. All rights reserved.
          </div>
        </div>

        {/* RIGHT: Links Grid */}
        <div className="footer-links">
          
          {/* Transparency */}
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

          {/* Community */}
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