import { useState } from "react";
import "./FaqPage.css";

type FaqItem = {
  id: string;
  q: string;
  a: React.ReactNode;
  tags?: string[];
};

// Moved data outside component to keep the render logic clean
const FAQ_ITEMS: FaqItem[] = [
  {
    id: "what-is",
    q: "What is Ppopgi?",
    a: (
      <>
        Ppopgi is a friendly, on-chain raffle app on <b>Etherlink (Tezos L2, EVM)</b>.
        <br /><br />
        A typical raffle works like this:
        <ul className="faq-ul">
          <li>A <b>creator deposits a prize pot</b> (USDC) into a raffle contract.</li>
          <li>Players <b>buy tickets</b> (USDC).</li>
          <li>When the raffle ends, a <b>winner is selected on-chain</b> via verifiable randomness.</li>
        </ul>
        The goal is to keep things simple, transparent, and verifiable.
      </>
    ),
  },
  {
    id: "randomness",
    q: "How does randomness work? Is it verifiable?",
    a: (
      <>
        Yes — the draw is verifiable and not “hidden” behind off-chain logic.
        <br /><br />
        Ppopgi uses <b>Pyth Entropy</b>. At a high level:
        <ol className="faq-ol">
          <li>The contract <b>requests randomness</b> from Pyth Entropy when finalizing.</li>
          <li>Pyth produces a <b>random value</b> on-chain tied to that request.</li>
          <li>The contract uses that value to pick the winner (e.g., <code>random % sold</code>).</li>
        </ol>
        <div className="faq-callout">
          There is no “private server” picking the winner. It is enforced by code.
        </div>
      </>
    ),
  },
  {
    id: "etherlink",
    q: "Why Etherlink?",
    a: (
      <>
        Etherlink is a Tezos Layer 2 with an EVM environment. It combines the reliability of Tezos with the speed of L2s.
        <br /><br />
        <ul className="faq-ul">
          <li><b>Fast finality + low fees:</b> Great for buying tickets without spending $5 on gas.</li>
          <li><b>EVM compatibility:</b> Allows us to use standard wallets like MetaMask.</li>
        </ul>
      </>
    ),
  },
  {
    id: "permissions",
    q: "Who controls the funds?",
    a: (
      <>
        <b>Players</b> control their tickets and claims. <br />
        <b>Creators</b> control the raffle parameters and their revenue claims.
        <br /><br />
        The <b>Protocol Owner</b> (a Safe multisig) has limited powers. They <b>cannot</b> change winners, alter ticket counts, or rewrite rules once a raffle is deployed.
      </>
    ),
  },
  {
    id: "fees",
    q: "What are the fees?",
    a: (
      <>
        Fees are transparent and verifiable on-chain:
        <ul className="faq-ul">
          <li><b>10% on ticket sales</b></li>
          <li><b>10% on the prize pot</b></li>
        </ul>
        These fees cover infrastructure, RPC costs, the finalizer bot, and future development.
      </>
    ),
  },
  {
    id: "canceled",
    q: "What happens if a raffle is canceled?",
    a: (
      <>
        If a raffle is canceled, <b>no one loses funds</b>.
        <br /><br />
        <ul className="faq-ul">
          <li>🎟 Players can reclaim a <b>full refund</b> for their tickets.</li>
          <li>👤 The creator can reclaim their <b>original prize pot</b>.</li>
          <li>💸 <b>No fees</b> are taken on canceled raffles.</li>
        </ul>
        You can process these refunds directly from your Dashboard.
      </>
    ),
  },
  {
    id: "open-source",
    q: "Is the code open-source?",
    a: (
      <>
        Yes. You can find links to the Frontend, Smart Contracts, and Finalizer Bot in the 
        <b> Transparency</b> section of the site footer.
      </>
    ),
  },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="faq-h2">{children}</h2>;
}

function Diagram() {
  return (
    <div className="faq-diagram-wrapper">
      <div className="faq-diagram-title">How Ppopgi Works (The Flow)</div>
      
      {/* Scroll container for mobile */}
      <div className="faq-diagram-scroll">
        <svg viewBox="0 0 860 240" className="faq-svg" role="img" aria-label="Ppopgi raffle diagram">
          <defs>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.1" />
            </filter>
            <linearGradient id="boxGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f8fafc" />
            </linearGradient>
          </defs>

          {/* Connectors */}
          <g stroke="#cbd5e1" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 4">
             <path d="M270 75 L305 75" />
             <path d="M555 75 L590 75" />
             <path d="M270 178 L305 178" />
             <path d="M555 178 L590 178" />
          </g>
          
          {/* Vertical Connectors (Solid) */}
          <g stroke="#94a3b8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
             <path d="M145 114 L145 140" markerEnd="url(#arrow)" />
             <path d="M430 114 L430 140" markerEnd="url(#arrow)" />
             <path d="M715 114 L715 140" markerEnd="url(#arrow)" />
          </g>

          {/* Boxes */}
          <g filter="url(#shadow)">
            {/* Top Row */}
            <rect x="20" y="36" width="250" height="78" rx="12" fill="url(#boxGrad)" stroke="#e2e8f0" />
            <rect x="305" y="36" width="250" height="78" rx="12" fill="url(#boxGrad)" stroke="#e2e8f0" />
            <rect x="590" y="36" width="250" height="78" rx="12" fill="url(#boxGrad)" stroke="#e2e8f0" />
            
            {/* Bottom Row */}
            <rect x="20" y="140" width="250" height="78" rx="12" fill="#ffffff" stroke="#e2e8f0" />
            <rect x="305" y="140" width="250" height="78" rx="12" fill="#ffffff" stroke="#e2e8f0" />
            <rect x="590" y="140" width="250" height="78" rx="12" fill="#ffffff" stroke="#e2e8f0" />
          </g>

          {/* Labels */}
          <g fontFamily="ui-sans-serif, system-ui, sans-serif" fill="#1e293b">
            {/* 1. Fund */}
            <text x="45" y="70" fontSize="15" fontWeight="700">Creator Funds Pot</text>
            <text x="45" y="90" fontSize="12" fill="#64748b">Deposits USDC to contract</text>

            {/* 2. Buy */}
            <text x="330" y="70" fontSize="15" fontWeight="700">Ticket Sales Open</text>
            <text x="330" y="90" fontSize="12" fill="#64748b">Players buy tickets</text>

            {/* 3. Draw */}
            <text x="615" y="70" fontSize="15" fontWeight="700">Verifiable Draw</text>
            <text x="615" y="90" fontSize="12" fill="#64748b">Pyth Entropy Randomness</text>

            {/* 4. Winner */}
            <text x="45" y="174" fontSize="15" fontWeight="700">Winner Selected</text>
            <text x="45" y="194" fontSize="12" fill="#64748b">Result written on-chain</text>

            {/* 5. Claims */}
            <text x="330" y="174" fontSize="15" fontWeight="700">Pull Payments</text>
            <text x="330" y="194" fontSize="12" fill="#64748b">Winners claim manually</text>

            {/* 6. Fees */}
            <text x="615" y="174" fontSize="15" fontWeight="700">Transparent Fees</text>
            <text x="615" y="194" fontSize="12" fill="#64748b">10% Pot + 10% Ticket Sales</text>
          </g>
          
          {/* Numbers for flow */}
          <g>
             <circle cx="20" cy="36" r="12" fill="#db2777" />
             <text x="20" y="41" fontSize="12" fontWeight="bold" fill="white" textAnchor="middle">1</text>

             <circle cx="305" cy="36" r="12" fill="#db2777" />
             <text x="305" y="41" fontSize="12" fontWeight="bold" fill="white" textAnchor="middle">2</text>

             <circle cx="590" cy="36" r="12" fill="#db2777" />
             <text x="590" y="41" fontSize="12" fontWeight="bold" fill="white" textAnchor="middle">3</text>
          </g>
        </svg>
      </div>

      <div className="faq-diagram-note">
        Scroll to view the full lifecycle
      </div>
    </div>
  );
}

export function FaqPage() {
  const [openId, setOpenId] = useState<string | null>("what-is");

  const toggle = (id: string) => setOpenId(prev => prev === id ? null : id);

  return (
    <div className="faq-page">
      <div className="faq-hero">
        <h1 className="faq-h1">FAQ</h1>
        <p className="faq-sub">
          Everything you need to know about trust, fees, and how Ppopgi works.
        </p>
      </div>

      <Diagram />

      <SectionTitle>Common Questions</SectionTitle>

      <div className="faq-list">
        {FAQ_ITEMS.map((it) => {
          const isOpen = openId === it.id;
          return (
            <div key={it.id} className={`faq-item ${isOpen ? "open" : ""}`}>
              <button
                className="faq-q"
                onClick={() => toggle(it.id)}
                aria-expanded={isOpen}
              >
                <span className="faq-q-text">{it.q}</span>
                <span className="faq-chevron">{isOpen ? "−" : "+"}</span>
              </button>

              <div className={`faq-a-wrapper ${isOpen ? "open" : ""}`}>
                 <div className="faq-a">
                    {it.a}
                 </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="faq-footer-note">
        Still curious? Check the "Blockchain Journey" on any raffle card.
      </div>
    </div>
  );
}
export default FaqPage;
