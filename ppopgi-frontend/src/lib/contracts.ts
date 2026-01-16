// src/lib/contracts.ts
export const ADDR = {
  registry: "0xE26d8B29d116540C7B181389D8e5a4990E41BcB5",
  deployer: "0x6ce44c2c89779F8f20deB1435B99a96d29Cd21C3",
  usdc: "0x796Ea11Fa2dD751eD01b53C372fFDB4AAa8f00F9",
} as const;

// Minimal ERC20 ABI for balance + decimals + allowance + approve
export const ERC20_ABI = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

// --- LotterySingleWinner (claims + proof reads + actions) ---
export const LOTTERY_SINGLE_WINNER_ABI = [
  // ===== reads (for proof UI + dashboard actions) =====
  {
    type: "function",
    name: "creator",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "deployer",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "usdcToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "entropy",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "entropyProvider",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "feeRecipient",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "protocolFeePercent",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "winner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "ticketsOwned",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "claimableFunds",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "claimableNative",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },

  // ===== writes (dashboard buttons) =====
  {
    type: "function",
    name: "withdrawFunds",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawNative",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "claimTicketRefund",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },

  // (optional later)
  {
    type: "function",
    name: "buyTickets",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256", name: "count" }],
    outputs: [],
  },
  {
    type: "function",
    name: "finalize",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "cancel",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

// Keep placeholders until you paste them (not needed for dashboard actions)
export const LOTTERY_REGISTRY_ABI = [] as const;
export const SINGLE_WINNER_DEPLOYER_ABI = [] as const;