import "./Footer.css";
import ppopgiLogo from "../assets/ppopgi-logo.png";

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
            Fair, verifiable, on-chain raffles.
          </div>

          {/* Etherlink attribution */}
          <div className="footer-built">
            Built with love on Etherlink 💚
          </div>

          <div className="footer-copy">
            &copy; {currentYear} Ppopgi. All rights reserved.
          </div>
        </div>

        {/* RIGHT: Links Grid */}
        <div className="footer-links">
          
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
              href="https://github.com/YOUR_USERNAME/ppopgi-finalizer"
              target="_blank"
              rel="noreferrer"
            >
              Finalizer Bot ↗
            </a>
          </div>

        </div>
      </div>
    </footer>
  );
}