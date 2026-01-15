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

// --- ABIs you pasted (as-is) ---

export const LOTTERY_REGISTRY_ABI = [
  // (paste 1st ABI here) - you already pasted it; keep it as-is in your file
] as const;

export const LOTTERY_SINGLE_WINNER_ABI = [
  // (paste 2nd ABI here) - you already pasted it; keep it as-is in your file
] as const;

export const SINGLE_WINNER_DEPLOYER_ABI = [
  // (paste 3rd ABI here) - you already pasted it; keep it as-is in your file
] as const;