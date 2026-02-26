// src/pages/FaqPage.tsx
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import "./FaqPage.css";

import { MermaidDiagram } from "../components/MermaidDiagram";

type FaqItem = {
  id: string;
  q: string;
  a: ReactNode;
  tags?: string[];
};

// ✅ UPDATED: Mermaid Theme matches Brand (Pink/Crimson)
const RAFFLE_FLOW = `
%%{
  init: {
    'theme': 'base',
    'themeVariables': {
      'primaryColor': '#ffffff',
      'primaryTextColor': '#4A0F2B',
      'primaryBorderColor': '#fce7f3',
      'lineColor': '#be185d',
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
  classDef decision fill:#ffffff,stroke:#9d174d,stroke-width:2px,color:#4A0F2B,rx:6,ry:6,stroke-dasharray: 5 5;
  classDef success fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#15803d,rx:12,ry:12;
  classDef fail fill:#fff1f2,stroke:#e11d48,stroke-width:2px,color:#9f1239,rx:12,ry:12;
  classDef tech fill:#fff,stroke:#4A0F2B,stroke-width:2px,color:#4A0F2B,rx:4,ry:4,stroke-dasharray: 2 2;

  A[Creator Launches]:::brand
  B[Prize Pot Funded]:::brand
  C[Lottery OPEN]:::brand

  D{Max Tickets?}:::decision
  E{Deadline?}:::decision
  F{Min Tickets?}:::decision

  Bot[Finalizer Bot<br/>runs ~every 5 min]:::tech
  User[Any User]:::tech

  H[Drawing Phase]:::tech
  I[Pyth Entropy<br/>Verifiable Randomness]:::tech

  J[Winner Selected]:::success
  G[Lottery Canceled]:::fail

  K[Winner Claims Prize]:::success
  L[Creator Claims Revenue]:::success
  M[Players Refund Tickets]:::fail
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

  linkStyle default stroke:#db2777,stroke-width:2px,fill:none;
`;

// ✅ NEW: Architecture diagram (same theme + style)
const SYSTEM_ARCH = `
%%{
  init: {
    'theme': 'base',
    'themeVariables': {
      'primaryColor': '#ffffff',
      'primaryTextColor': '#4A0F2B',
      'primaryBorderColor': '#fce7f3',
      'lineColor': '#be185d',
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
  classDef decision fill:#ffffff,stroke:#9d174d,stroke-width:2px,color:#4A0F2B,rx:6,ry:6,stroke-dasharray: 5 5;
  classDef success fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#15803d,rx:12,ry:12;
  classDef fail fill:#fff1f2,stroke:#e11d48,stroke-width:2px,color:#9f1239,rx:12,ry:12;
  classDef tech fill:#fff,stroke:#4A0F2B,stroke:#4A0F2B,color:#4A0F2B,rx:4,ry:4,stroke-dasharray: 2 2;

  User[User Wallet<br/>(MetaMask etc.)]:::tech
  App[Ppopgi Frontend<br/>(React)]:::brand

  RPC[RPC / Etherlink Node]:::tech
  Chain[Etherlink (EVM)<br/>Lottery Contracts]:::brand

  Entropy[Pyth Entropy<br/>Verifiable Randomness]:::tech
  Bot[Finalizer Bot<br/>permissionless caller]:::tech

  Subgraph[The Graph Subgraph<br/>(indexed events)]:::tech
  Worker[Edge Cache Worker<br/>(GraphQL cache)]:::tech

  User --> App
  App --> RPC
  RPC --> Chain

  Bot -.-> Chain
  Chain --> Entropy
  Entropy --> Chain

  Chain --> Subgraph
  App --> Worker --> Subgraph

  linkStyle default stroke:#db2777,stroke-width:2px,fill:none;
`;

/**
 * ✅ OPTIONAL: Put your real addresses here (or import from config)
 * Keeping it local makes the FAQ very easy to update.
 */
const CONTRACTS = {
  registry: "0x…",
  deployer: "0x…",
  usdc: "0x…",
  pythEntropy: "0x…",
  entropyProvider: "0x…",
};

const LINKS = {
  explorerBase: "https://explorer.etherlink.com",
  solidityScanProject: "", // e.g. "https://solidityscan.com/..."
  repoContracts: "", // e.g. "https://github.com/<you>/<repo>"
};

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
            A <b>creator deposits a prize pot</b> (USDC) into a new raffle contract.
          </li>
          <li>
            Players <b>buy tickets</b> (USDC) while the raffle is open.
          </li>
          <li>
            When the raffle ends (sold out or deadline), a <b>winner is selected on-chain</b> using verifiable randomness.
          </li>
          <li>
            After the draw, funds are handled as <b>claims</b>: the winner claims the prize (minus protocol fees) and the creator
            claims ticket revenue (minus protocol fees).
          </li>
        </ul>
        <div className="faq-callout">
          Core idea: no hidden server logic deciding outcomes — the important rules are enforced by the raffle smart contract.
        </div>
      </>
    ),
  },

  // ✅ NEW: Tech stack/components (requested)
  {
    id: "tech-stack",
    q: "What is the Ppopgi tech stack / components?",
    a: (
      <>
        Ppopgi is made of a few components. Some are <b>on-chain</b> (custody + rules), and others are <b>off-chain</b> (speed + UX).
        <br />
        <br />

        <b>🧱 On-chain</b>
        <ul className="faq-ul">
          <li>
            <b>Lottery contracts (Etherlink / EVM):</b> hold USDC, enforce rules, request randomness, compute winner, and allocate
            claimable balances.
          </li>
          <li>
            <b>LotteryRegistry:</b> a registry of deployed lotteries (used for discovery and indexing).
          </li>
          <li>
            <b>SingleWinnerDeployer:</b> deploys a new lottery contract per raffle and registers it in the registry.
          </li>
          <li>
            <b>Pyth Entropy:</b> provides on-chain verifiable randomness for winner selection.
          </li>
        </ul>

        <b>🌐 Off-chain (operated by Ppopgi for a smooth UX)</b>
        <ul className="faq-ul">
          <li>
            <b>Frontend (React):</b> the user interface that reads public chain data and sends transactions from your wallet.
          </li>
          <li>
            <b>Indexer (The Graph subgraph):</b> indexes contract events for fast lists, participants, and history views.
          </li>
          <li>
            <b>Edge cache worker:</b> caches GraphQL reads to reduce latency and load.
          </li>
          <li>
            <b>Finalizer bot:</b> periodically calls <code>finalize()</code> when raffles are eligible (permissionless action).
          </li>
        </ul>

        <div className="faq-callout">
          Important: Ppopgi provides the indexer, cache worker, and finalizer bot to make the experience as smooth as possible — but
          these services do <b>not</b> control funds and do <b>not</b> decide winners. They either read public data or call public
          functions that anyone can call.
        </div>
      </>
    ),
  },

  {
    id: "contracts-addresses",
    q: "What are the on-chain contract addresses?",
    a: (
      <>
        You can verify the core contracts on Etherlink Explorer:
        <ul className="faq-ul">
          <li>
            <b>Lottery Registry:</b>{" "}
            <a className="rdm-info-link" target="_blank" rel="noreferrer" href="https://explorer.etherlink.com/address/0xa916e20AbF4d57bCb98f7A845eb74f2EB4Dcbed2">
            0xa916e20AbF4d57bCb98f7A845eb74f2EB4Dcbed2 ↗
          </a>
          </li>
          <li>
            <b>SingleWinner Deployer:</b>{" "}
            <a className="rdm-info-link" target="_blank" rel="noreferrer" href="https://explorer.etherlink.com/address/0xAd0c8Ba0E4e519B4EA97cE945A20E2716dDbDf7D">
            0xAd0c8Ba0E4e519B4EA97cE945A20E2716dDbDf7D ↗
          </a>
          </li>
          <li>
            <b>USDC token:</b>{" "}
            <a className="rdm-info-link" target="_blank" rel="noreferrer" href="https://explorer.etherlink.com/address/0x796Ea11Fa2dD751eD01b53C372fFDB4AAa8f00F9">
            0x796Ea11Fa2dD751eD01b53C372fFDB4AAa8f00F9 ↗
          </a>
          </li>
          <li>
            <b>Pyth Entropy contract:</b>{" "}
            <a className="rdm-info-link" target="_blank" rel="noreferrer" href="https://explorer.etherlink.com/address/0x23f0e8faee7bbb405e7a7c3d60138fcfd43d7509">
            0x23f0e8faee7bbb405e7a7c3d60138fcfd43d7509 ↗
          </a>
          </li>
          <li>
            <b>Entropy provider:</b>{" "}
            <a className="rdm-info-link" target="_blank" rel="noreferrer" href="https://explorer.etherlink.com/address/0x52DeaA1c84233F7bb8C8A45baeDE41091c616506">
            0x52DeaA1c84233F7bb8C8A45baeDE41091c616506 ↗
          </a>
          </li>
        </ul>

        <div className="faq-callout">
          Each lottery also has its <b>own contract address</b>. You can find it on the lottery card and on the Explorer.
        </div>
      </>
    ),
  },

  {
    id: "each-lottery-contract",
    q: "Is each lottery a new contract? How are lotteries secured?",
    a: (
      <>
        <b>Yes.</b> Each raffle is deployed as a <b>new smart contract instance</b> using the deployer.
        <br />
        <br />
        This has two big benefits:
        <ul className="faq-ul">
          <li>
            A raffle’s parameters (ticket price, deadline, max tickets, fee recipient, fee percent, etc.) are fixed inside that
            contract.
          </li>
          <li>
            Funds for that raffle are isolated in that contract. A bug or issue in one raffle should not automatically affect others.
          </li>
        </ul>

        <b>How funds are protected (in practice):</b>
        <ul className="faq-ul">
          <li>USDC is held by the raffle contract itself (not in a website wallet).</li>
          <li>
            There is no function in the raffle contract intended to “withdraw everything to an arbitrary address”.
          </li>
          <li>
            Winner selection is enforced by contract logic and uses <b>Pyth Entropy</b> randomness.
          </li>
          <li>
            Payouts use <b>pull-based claims</b>: the contract records what you’re owed, and only your address can claim it.
          </li>
        </ul>

        <div className="faq-callout">
          Like any smart contract system, the remaining risk is “code risk” (unexpected bugs). The best reassurance is transparency:
          verified addresses, public source code, and on-chain behavior you can verify yourself.
        </div>
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
        Ppopgi uses <b>Pyth Entropy</b> as the randomness source. In plain terms:
        <ol className="faq-ol">
          <li>
            When a raffle is ready to settle (deadline reached or sold out), the raffle calls <code>finalize()</code> and requests a
            random value from Pyth Entropy (paying the Entropy fee).
          </li>
          <li>
            Entropy returns the random value <b>on-chain</b> via a callback.
          </li>
          <li>
            The raffle contract only accepts callbacks from the <b>Entropy contract address</b> and rejects invalid callbacks.
          </li>
          <li>
            The raffle selects a winner deterministically using <code>winningIndex = random % totalSold</code> and maps that index to a
            buyer using on-chain ticket ranges.
          </li>
        </ol>
        <div className="faq-callout">
          There is no private server picking the winner. The randomness is delivered on-chain, and the winner is computed by the
          contract.
        </div>
      </>
    ),
  },

  {
    id: "finalizer-bot",
    q: "What is the finalizer bot?",
    a: (
      <>
        The finalizer bot is a simple automated helper that improves UX.
        <br />
        <br />
        It runs on a schedule (about <b>every ~3 minutes</b>) and checks for raffles that are ready to settle (deadline reached or
        sold out). If it finds one, it can trigger settlement so raffles don’t stay “waiting” forever.
        <br />
        <br />
        <div className="faq-callout">
          Important: the bot does not decide winners and cannot change outcomes — it only triggers the same public <code>finalize()</code>{" "}
          action that any user can call.
        </div>
      </>
    ),
  },

  {
    id: "stuck-drawing",
    q: "What if a raffle gets stuck while settling?",
    a: (
      <>
        Rarely, a raffle could get stuck during settlement (for example: delayed randomness callback, temporary provider issues, or
        unusual network conditions).
        <br />
        <br />
        To protect users, the contracts include an <b>emergency recovery</b> path:
        <ul className="faq-ul">
          <li>
            If a raffle stays in <b>Drawing</b> for too long, <b>anyone</b> can call an emergency function after a safety delay (the
            “hatch” period).
          </li>
          <li>This cancels the raffle and routes funds into the normal refund/claim flow.</li>
        </ul>
        <div className="faq-callout">
          Goal: a raffle should never remain stuck forever — there is always a public path to recover and refund.
        </div>
      </>
    ),
  },

  // ✅ FIXED: fees text now matches protocolFeePercent in your contracts (0..20)
  {
    id: "fees",
    q: "What are the fees?",
    a: (
      <>
        Fees are transparent and enforced by the raffle contract when the raffle completes.
        <br />
        <br />
        Each raffle stores these values on-chain:
        <ul className="faq-ul">
          <li>
            <b>protocolFeePercent</b> (0–20%)
          </li>
          <li>
            <b>feeRecipient</b> (the address that can claim protocol fees)
          </li>
        </ul>
        At settlement time, the contract applies <b>protocolFeePercent</b> to:
        <ul className="faq-ul">
          <li>the prize pot (winner payout)</li>
          <li>the ticket revenue (creator payout)</li>
        </ul>
        <div className="faq-callout">
          You can verify the fee percent and fee recipient for any raffle directly on-chain (it’s part of that raffle’s immutable
          config).
        </div>
      </>
    ),
  },

  {
    id: "why-fees",
    q: "Why are there fees?",
    a: (
      <>
        Ppopgi is self-funded and runs real infrastructure. Fees exist to cover operating costs such as:
        <ul className="faq-ul">
          <li>hosting and app infrastructure,</li>
          <li>RPC usage and reliability costs,</li>
          <li>running the finalizer bot,</li>
          <li>indexing / data services,</li>
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
        Yes — once a raffle is created, its fee settings are <b>fixed for that raffle</b>.
        <br />
        <br />
        The deployer may update defaults for <b>future</b> raffles, but existing raffles remain unchanged.
      </>
    ),
  },

  {
    id: "permissions",
    q: "Who can do what? (Creator vs players vs protocol roles)",
    a: (
      <>
        Here’s the simple breakdown:
        <ul className="faq-ul">
          <li>
            <b>Players</b> can buy tickets and claim refunds/payouts when available.
          </li>
          <li>
            <b>Creators</b> choose raffle parameters, fund the prize pot, and can claim ticket revenue after settlement. Creators{" "}
            <b>cannot</b> buy tickets in their own raffle.
          </li>
          <li>
            <b>Registry/Deployer admins</b> can manage configuration for <b>future</b> raffles (ex: set registrar, update deployer
            config). This does <b>not</b> let them rewrite outcomes of an already deployed raffle.
          </li>
        </ul>
        <div className="faq-callout">
          Best practice: treat smart contracts as the source of truth. You can verify a raffle’s rules (fee recipient, ticket price,
          deadline, etc.) on-chain for that raffle address.
        </div>
      </>
    ),
  },

  {
    id: "owner-rug",
    q: "Can anyone steal funds or change the winner?",
    a: (
      <>
        The winner selection is enforced by the raffle contract and uses verifiable randomness from Pyth Entropy.
        <br />
        <br />
        Payouts are pull-based:
        <ul className="faq-ul">
          <li>The contract records what each address is owed.</li>
          <li>Only that address can claim its own funds.</li>
        </ul>
        <br />
        This design helps protect users from “admin drains” because there is no function intended to move all funds to an arbitrary
        address.
        <div className="faq-callout">
          Important nuance: smart contracts reduce trust in people, but they don’t eliminate “code risk”. The best reassurance is
          transparency: verified contracts, public source code, and behavior you can verify on-chain.
        </div>
      </>
    ),
  },

  {
    id: "solidityscan",
    q: "Where can I find the contracts security score (SolidityScan)?",
    a: (
      <>
        You can review automated scan reports (static analysis) here:
        <br />
        <br />
          <a className="rdm-info-link" target="_blank" rel="noreferrer" href="https://solidityscan.com/quickscan/0xa916e20AbF4d57bCb98f7A845eb74f2EB4Dcbed2/blockscout/etherlink-mainnet">
            View LotteryRegistry SolidityScan report ↗
          </a><br />
          <a className="rdm-info-link" target="_blank" rel="noreferrer" href="https://solidityscan.com/quickscan/0xAd0c8Ba0E4e519B4EA97cE945A20E2716dDbDf7D/blockscout/etherlink-mainnet">
            View LotteryDeployer SolidityScan report ↗
          </a>
        <br />
        <br />
        <div className="faq-callout">
          Automated scanners are helpful, but they are not a substitute for a full audit. Always combine scans + manual review.
        </div>
      </>
    ),
  },

  {
    id: "audit",
    q: "Why haven’t the contracts been audited externally?",
    a: (
      <>
        External audits are valuable — they also cost real time and money. Ppopgi started as a lean project and prioritizes:
        <ul className="faq-ul">
          <li>simple contracts with fewer moving parts,</li>
          <li>public source code and on-chain verification,</li>
          <li>automated scanning + ongoing fixes,</li>
          <li>transparent communication about changes.</li>
        </ul>
        <div className="faq-callout">
          If usage grows, an external audit is a natural next step. Until then, the best defense is transparency: verify addresses,
          review code, and follow on-chain behavior.
        </div>
      </>
    ),
  },

  {
    id: "pull-payments",
    q: "What does “pull payments” mean, and why is it safer?",
    a: (
      <>
        “Pull payments” means the contract doesn’t try to automatically send money to multiple people during the draw.
        Instead:
        <ul className="faq-ul">
          <li>the contract records what you are owed,</li>
          <li>and you claim it yourself from your wallet when you want.</li>
        </ul>
        This pattern is widely used because it reduces failure cases (for example: one transfer failing shouldn’t break the whole
        settlement).
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
          <li>👤 The creator can reclaim their <b>original prize pot</b> (as a claim).</li>
          <li>💸 <b>No protocol fees</b> are allocated on canceled raffles.</li>
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
        Etherlink is a Tezos Layer 2 with an EVM environment. It combines Tezos roots with an Ethereum-compatible developer
        experience.
        <br />
        <br />
        <ul className="faq-ul">
          <li>
            <b>Fast + low fees:</b> buying tickets feels smooth without expensive gas.
          </li>
          <li>
            <b>EVM compatibility:</b> works with common wallets like MetaMask.
          </li>
          <li>
            <b>Good UX:</b> quick confirmations make raffles feel responsive.
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
        <br />
        <br />
        {LINKS.repoContracts ? (
          <a className="rdm-info-link" target="_blank" rel="noreferrer" href={LINKS.repoContracts}>
            View smart contracts repo ↗
          </a>
        ) : null}
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
  useEffect(() => {
    document.title = "Ppopgi 뽑기 — FAQ";
  }, []);

  const [openId, setOpenId] = useState<string | null>("what-is");
  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <div className="faq-page">
      {/* Hero Section */}
      <div className="faq-hero-card">
        <h1 className="faq-h1">FAQ & Rules</h1>
        <p className="faq-sub">Everything you need to know about trust, fees, and how Ppopgi works.</p>
      </div>

      {/* Mermaid Lifecycle */}
      <SectionTitle>How a Lottery Works</SectionTitle>
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
      <div className="faq-footer-card">Still curious? Check the "Blockchain Journey" on any raffle card.</div>
    </div>
  );
}

export default FaqPage;