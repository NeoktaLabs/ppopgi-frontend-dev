// src/pages/FaqPage.tsx
import { useState } from "react";
import type { ReactNode } from "react";
import "./FaqPage.css";

import { MermaidDiagram } from "../components/MermaidDiagram";

type FaqItem = {
  id: string;
  q: string;
  a: ReactNode;
  tags?: string[];
};

// ✅ STYLISH MERMAID CONFIGURATION
const RAFFLE_FLOW = `
%%{
  init: {
    'theme': 'base',
    'themeVariables': {
      'primaryColor': '#ffffff',
      'primaryTextColor': '#1e293b',
      'primaryBorderColor': '#e2e8f0',
      'lineColor': '#94a3b8',
      'fontFamily': 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      'fontSize': '14px'
    },
    'flowchart': {
      'curve': 'basis',
      'nodeSpacing': 40,
      'rankSpacing': 60
    }
  }
}%%

flowchart TD
  classDef brand fill:#fdf2f8,stroke:#db2777,stroke-width:2px,color:#be185d,rx:12,ry:12;
  classDef decision fill:#ffffff,stroke:#64748b,stroke-width:2px,color:#1e293b,rx:6,ry:6,stroke-dasharray: 5 5;
  classDef success fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#15803d,rx:12,ry:12;
  classDef fail fill:#fef2f2,stroke:#ef4444,stroke-width:2px,color:#991b1b,rx:12,ry:12;
  classDef tech fill:#f0f9ff,stroke:#0ea5e9,stroke-width:2px,color:#0369a1,rx:12,ry:12;

  A[Creator Launches]:::brand
  B[Prize Pot Funded]:::brand
  C[Raffle OPEN]:::brand

  D{Max Tickets?}:::decision
  E{Deadline?}:::decision
  F{Min Tickets?}:::decision

  Bot[Finalizer Bot]:::tech
  User[Any User]:::tech

  H[Drawing Phase]:::tech
  I[Pyth Entropy<br/>Verifiable Randomness]:::tech

  J[Winner Selected]:::success
  G[Raffle Canceled]:::fail

  K[Winner Claims Prize]:::success
  L[Creator Claims Revenue]:::success
  M[Players Refund]:::fail
  N[Creator Reclaims Pot]:::fail

  A --> B --> C
  C --> D

  D -- No --> E
  E -- No --> C
  
  D -- Yes --> F
  E -- Yes --> F

  F -- No --> G
  G --> M & N

  F -- Yes --> H
  Bot -.-> H
  User -.-> H
  
  H --> I --> J
  J --> K & L

  linkStyle default stroke:#94a3b8,stroke-width:2px,fill:none;
`;

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
        Ppopgi uses <b>Pyth Entropy</b> for randomness. At a high level:
        <ol className="faq-ol">
          <li>The contract <b>requests randomness</b> from Pyth Entropy when finalizing.</li>
          <li>Pyth produces a <b>random value</b> on-chain tied to that request.</li>
          <li>The contract uses that value to pick the winner (e.g., <code>random % sold</code>).</li>
        </ol>
      </>
    ),
  },
  {
    id: "finalize-fee",
    q: "Who settles a raffle, and who pays for randomness?",
    a: (
      <>
        Settling a raffle is <b>permissionless</b> — anyone can do it when the raffle is ready.
        <br /><br />
        Randomness has a small network cost. The person who triggers the settlement pays that cost. In practice, this is often the creator, a player, or our automated finalizer bot.
      </>
    ),
  },
  {
    id: "stuck-drawing",
    q: "What if a raffle gets stuck while settling?",
    a: (
      <>
        To protect users, the contracts include an <b>emergency recovery</b>. If a raffle gets stuck (e.g. randomness provider outage), the creator or owner can cancel it after a timeout, allowing everyone to refund their funds.
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
        <div className="faq-callout">
          Example: If the prize pot is 100 USDC, the winner receives 90 USDC.
        </div>
      </>
    ),
  },
  {
    id: "why-fees",
    q: "Why are there fees?",
    a: (
      <>
        Ppopgi is self-funded. Fees cover hosting, RPC usage, the finalizer bot, data services, and future development.
      </>
    ),
  },
  {
    id: "permissions",
    q: "Who can do what?",
    a: (
      <>
        <b>Players</b> can buy tickets and claim funds. <br />
        <b>Creators</b> manage their raffles and claim revenue. <br />
        <b>The Protocol Owner</b> (multisig) has limited admin powers (pausing) but <b>cannot</b> change winners or steal funds.
      </>
    ),
  },
  {
    id: "owner-rug",
    q: "Can the owner steal funds?",
    a: (
      <>
        <b>No</b>. Winners are selected by verifiable randomness. Payouts are "pull payments," meaning only the rightful owner can claim their specific balance.
      </>
    ),
  },
  {
    id: "canceled",
    q: "What happens if a raffle is canceled?",
    a: (
      <>
        If canceled, <b>no one loses funds</b>.
        <ul className="faq-ul">
          <li>🎟 Players refund tickets.</li>
          <li>👤 Creator reclaims the prize pot.</li>
          <li>💸 No fees are taken.</li>
        </ul>
      </>
    ),
  },
  {
    id: "etherlink",
    q: "Why Etherlink?",
    a: (
      <>
        Etherlink combines Tezos reliability with EVM compatibility, offering fast finality and low fees perfect for a raffle dApp.
      </>
    ),
  },
  {
    id: "open-source",
    q: "Is the code open-source?",
    a: (
      <>
        Yes. Links to the repositories are available in the <b>Transparency</b> section of the footer.
      </>
    ),
  },
];

// Helper for section headers
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="faq-section-header">
      <h2 className="faq-h2">{children}</h2>
    </div>
  );
}

export function FaqPage() {
  const [openId, setOpenId] = useState<string | null>("what-is");
  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <div className="faq-page">
      {/* Hero Section */}
      <div className="faq-hero-card">
        <h1 className="faq-h1">FAQ</h1>
        <p className="faq-sub">Everything you need to know about trust, fees, and how Ppopgi works.</p>
      </div>

      {/* Mermaid Lifecycle */}
      <SectionTitle>Raffle Lifecycle (All States)</SectionTitle>
      <div className="faq-mermaid">
        <div className="faq-diagram-title">System State Flow</div>
        <MermaidDiagram code={RAFFLE_FLOW} id="ppopgi-raffle-lifecycle" />
        <div className="faq-diagram-note">Scroll to view the full lifecycle</div>
      </div>

      {/* Questions List */}
      <SectionTitle>Common Questions</SectionTitle>
      <div className="faq-list">
        {FAQ_ITEMS.map((it) => {
          const isOpen = openId === it.id;
          return (
            <div key={it.id} className={`faq-item ${isOpen ? "open" : ""}`}>
              <button className="faq-q" onClick={() => toggle(it.id)} aria-expanded={isOpen}>
                <span className="faq-q-text">{it.q}</span>
                <span className="faq-chevron">{isOpen ? "−" : "+"}</span>
              </button>

              <div className={`faq-a-wrapper ${isOpen ? "open" : ""}`}>
                <div className="faq-a">{it.a}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Note */}
      <div className="faq-footer-card">
        Still curious? Check the "Blockchain Journey" on any raffle card.
      </div>
    </div>
  );
}

export default FaqPage;
