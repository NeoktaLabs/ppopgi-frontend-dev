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

// ✅ Mermaid flow (Option A)
const RAFFLE_FLOW = `
flowchart TD

  A[Creator creates raffle]
  B[Prize pot funded in USDC]
  C[Raffle is Open]
  D{Max tickets reached?}
  E{Deadline passed?}
  F{Minimum tickets reached?}
  G[Cancel raffle]
  H[Drawing phase]
  I[Pyth Entropy randomness]
  J[Winner selected]
  K[Winner claims prize]
  L[Creator claims ticket revenue]
  M[Players refund tickets]
  N[Creator reclaims prize pot]
  O[Any user can call finalize]
  P[Finalizer bot runs every ~5 minutes]

  A --> B
  B --> C

  C --> D
  D -->|Yes| F
  D -->|No| E
  E -->|No| C
  E -->|Yes| F

  F -->|No| G
  F -->|Yes| H

  G --> M
  G --> N

  H --> I
  I --> J
  J --> K
  J --> L

  O --> H
  P --> H
`;

// Moved data outside component to keep the render logic clean
const FAQ_ITEMS: FaqItem[] = [
  {
    id: "what-is",
    q: "What is Ppopgi?",
    a: (
      <>
        Ppopgi is a friendly, on-chain raffle app on <b>Etherlink (Tezos L2, EVM)</b>.
        <br />
        <br />
        A typical raffle works like this:
        <ul className="faq-ul">
          <li>
            A <b>creator deposits a prize pot</b> (USDC) into the raffle contract.
          </li>
          <li>
            Players <b>buy tickets</b> (USDC).
          </li>
          <li>
            When the raffle ends, a <b>winner is selected on-chain</b> using verifiable randomness.
          </li>
          <li>
            The <b>winner claims the prize pot</b> (minus the prize fee) and the <b>creator claims ticket sales</b> (minus
            the ticket sales fee).
          </li>
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
        <br />
        <br />
        Ppopgi uses <b>Pyth Entropy</b> for randomness. At a high level:
        <ol className="faq-ol">
          <li>
            When a raffle is ready to settle (deadline reached or sold out), the raffle contract{" "}
            <b>requests a random value</b> from Pyth Entropy.
          </li>
          <li>Pyth Entropy later returns a <b>random value back to the raffle contract</b> on-chain.</li>
          <li>
            The contract uses that value to select a winner in a fully deterministic way — think{" "}
            <b>“random number mapped into the range of sold tickets”</b>.
          </li>
        </ol>
        <div className="faq-callout">
          There is no private server picking the winner. The winner selection is enforced by the on-chain contract, and the
          randomness comes from Pyth Entropy.
        </div>
      </>
    ),
  },
  {
    id: "finalize-fee",
    q: "Who settles a raffle, and who pays for randomness?",
    a: (
      <>
        Settling a raffle is <b>permissionless</b> — anyone can do it when the raffle is ready (deadline reached or sold out).
        <br />
        <br />
        Randomness has a small network cost because it uses an on-chain randomness provider. The person who triggers the settlement
        pays that cost <b>at the time of settlement</b>.
        <br />
        <br />
        In practice, this is often:
        <ul className="faq-ul">
          <li>the creator,</li>
          <li>a player,</li>
          <li>or an automated helper (“finalizer bot”).</li>
        </ul>
        The important part: the cost is not “hidden” — it’s paid upfront when requesting randomness.
      </>
    ),
  },
  {
    id: "stuck-drawing",
    q: "What if a raffle gets stuck while settling?",
    a: (
      <>
        Rarely, a raffle could get stuck during the settlement step (for example, if a randomness callback doesn’t arrive as expected).
        <br />
        <br />
        To protect users, the contracts include an <b>emergency recovery</b>:
        <ul className="faq-ul">
          <li>After a short delay, the creator (or the protocol owner) can recover the raffle.</li>
          <li>
            After a longer delay, <b>anyone</b> can recover it.
          </li>
        </ul>
        In recovery mode, the raffle is canceled and funds become refundable through the usual claim flow.
        <div className="faq-callout">The goal is simple: raffles should never remain stuck forever.</div>
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
          <li>
            <b>10% on ticket sales</b> (taken from the ticket revenue)
          </li>
          <li>
            <b>10% on the prize pot</b> (taken from the prize pot)
          </li>
        </ul>
        <div className="faq-callout">
          Example: If the prize pot is 100 USDC, the winner receives 90 USDC. If ticket sales are 200 USDC, the creator receives 180
          USDC.
        </div>
      </>
    ),
  },
  {
    id: "why-fees",
    q: "Why are there fees?",
    a: (
      <>
        Ppopgi is self-funded. Fees exist to cover real running costs such as:
        <ul className="faq-ul">
          <li>hosting and infrastructure,</li>
          <li>RPC usage,</li>
          <li>the finalizer bot,</li>
          <li>the indexer / data services,</li>
          <li>maintenance and improvements over time.</li>
        </ul>
        If the project grows, fees may also help fund <b>special community events</b> and themed raffles throughout the year.
      </>
    ),
  },
  {
    id: "fees-fixed",
    q: "Are fees fixed once a raffle is created?",
    a: (
      <>
        Yes — once a raffle is created, its fee settings are <b>fixed for that raffle</b> and cannot be changed afterward.
        <br />
        <br />
        Over time, the protocol may update default fees for <b>future</b> raffles, but existing raffles remain unchanged.
      </>
    ),
  },
  {
    id: "permissions",
    q: "Who can do what? (Owner vs creator vs players)",
    a: (
      <>
        Here’s the simple breakdown:
        <ul className="faq-ul">
          <li>
            <b>Players</b> can buy tickets and claim payouts/refunds when available.
          </li>
          <li>
            <b>Creators</b> choose raffle parameters and can claim ticket revenue after settlement. Creators <b>cannot</b> buy tickets
            in their own raffle.
          </li>
          <li>
            <b>The protocol owner</b> (a Safe multisig) has limited administrative powers like pausing in emergencies and maintaining
            configuration — but <b>cannot</b> change winners, rewrite outcomes, or move your funds arbitrarily.
          </li>
        </ul>
        <div className="faq-callout">
          The protocol owner is a multisig. Today it contains 1 signer (me), with the goal of adding additional parties as the project
          grows.
        </div>
      </>
    ),
  },
  {
    id: "owner-rug",
    q: "Can the owner steal funds or change the winner?",
    a: (
      <>
        <b>No</b> — winners are selected by verifiable randomness, enforced by the contract.
        <br />
        <br />
        Also, payouts are designed as <b>pull payments</b>:
        <ul className="faq-ul">
          <li>The contract tracks what each address is owed.</li>
          <li>Only the user can claim their own funds.</li>
        </ul>
        That design reduces risk and prevents “push payments” to unknown addresses.
        <br />
        <br />
        The owner can pause the system in emergencies, but <b>cannot</b> arbitrarily redirect prize funds to themselves.
      </>
    ),
  },
  {
    id: "pull-payments",
    q: "What does “pull payments” mean, and why is it safer?",
    a: (
      <>
        “Pull payments” means the contract doesn’t automatically send money to people during the draw. Instead:
        <ul className="faq-ul">
          <li>the contract records what you are owed,</li>
          <li>and you claim it yourself from your wallet.</li>
        </ul>
        This is a common security pattern because it reduces complexity and risk around forced transfers.
      </>
    ),
  },
  {
    id: "canceled",
    q: "What happens if a raffle is canceled?",
    a: (
      <>
        If a raffle is canceled, <b>no one loses funds</b>.
        <br />
        <br />
        <ul className="faq-ul">
          <li>🎟 Players can reclaim a <b>full refund</b> for their tickets.</li>
          <li>👤 The creator can reclaim their <b>original prize pot</b>.</li>
          <li>💸 <b>No fees</b> are taken on canceled raffles.</li>
        </ul>
        Refunds are done through the <b>Dashboard</b> (claim portal).
      </>
    ),
  },
  {
    id: "etherlink",
    q: "Why Etherlink?",
    a: (
      <>
        Etherlink is a Tezos Layer 2 with an EVM environment. It combines Tezos roots with an Ethereum-compatible developer experience.
        <br />
        <br />
        <ul className="faq-ul">
          <li>
            <b>Fast + low fees:</b> buying tickets is smooth without expensive gas.
          </li>
          <li>
            <b>EVM compatibility:</b> supports common wallets like MetaMask.
          </li>
          <li>
            <b>Good UX:</b> quick confirmations help raffles feel responsive.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "open-source",
    q: "Is the code open-source?",
    a: (
      <>
        Yes. Links to the Frontend, Smart Contracts, and Finalizer Bot are available in the <b>Transparency</b> section of the site
        footer.
      </>
    ),
  },
];

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="faq-h2">{children}</h2>;
}

export function FaqPage() {
  const [openId, setOpenId] = useState<string | null>("what-is");
  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <div className="faq-page">
      <div className="faq-hero">
        <h1 className="faq-h1">FAQ</h1>
        <p className="faq-sub">Everything you need to know about trust, fees, and how Ppopgi works.</p>
      </div>

      {/* ✅ Mermaid lifecycle diagram */}
      <div className="faq-mermaid">
        <div className="faq-diagram-title">Raffle Lifecycle (All States)</div>
        <MermaidDiagram code={RAFFLE_FLOW} />
        <div className="faq-diagram-note">Scroll to view the full lifecycle</div>
      </div>

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

      <div className="faq-footer-note">Still curious? Check the "Blockchain Journey" on any raffle card.</div>
    </div>
  );
}

export default FaqPage;