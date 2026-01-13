export const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }
] as const;

export const FACTORY_ABI = [
  // WRITES
  { name: 'createSingleWinnerLottery', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'name', type: 'string' }, { name: 'ticketPrice', type: 'uint256' }, { name: 'winningPot', type: 'uint256' }, { name: 'minTickets', type: 'uint64' }, { name: 'maxTickets', type: 'uint64' }, { name: 'durationSeconds', type: 'uint64' }, { name: 'minPurchaseAmount', type: 'uint32' }], outputs: [{ name: 'lotteryAddr', type: 'address' }] },
  { 
    name: 'setConfig', 
    type: 'function', 
    stateMutability: 'nonpayable', 
    inputs: [
      { name: '_usdc', type: 'address' },
      { name: '_entropy', type: 'address' },
      { name: '_entropyProvider', type: 'address' },
      { name: '_feeRecipient', type: 'address' },
      { name: '_protocolFeePercent', type: 'uint256' }
    ], 
    outputs: [] 
  },
  // READS
  { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'usdc', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'entropy', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'entropyProvider', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'feeRecipient', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'protocolFeePercent', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }
] as const;

export const REGISTRY_ABI = [
  { name: 'getAllLotteries', type: 'function', stateMutability: 'view', inputs: [{ name: 'start', type: 'uint256' }, { name: 'limit', type: 'uint256' }], outputs: [{ name: '', type: 'address[]' }] },
  { name: 'getAllLotteriesCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'isRegisteredLottery', type: 'function', stateMutability: 'view', inputs: [{ name: 'lottery', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'typeIdOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'lottery', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }
] as const;

export const LOTTERY_ABI = [
  // READS
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { name: 'status', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { name: 'winningPot', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'ticketPrice', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'getSold', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'deadline', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint64' }] },
  { name: 'minTickets', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint64' }] },
  { name: 'maxTickets', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint64' }] },
  { name: 'creator', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'deployer', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'winner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'entropyProvider', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'entropy', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  
  // FEES (Transparency)
  { name: 'feeRecipient', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'protocolFeePercent', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },

  // USER SPECIFIC READS
  { name: 'ticketsOwned', type: 'function', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'claimableFunds', type: 'function', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'claimableNative', type: 'function', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  
  // WRITES
  { name: 'buyTickets', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'count', type: 'uint256' }], outputs: [] },
  { name: 'finalize', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] },
  { name: 'withdrawFunds', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'withdrawNative', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'withdrawNativeTo', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }], outputs: [] },
  { name: 'claimTicketRefund', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] }
] as const;

export const ENTROPY_ABI = [
    { name: 'getFee', type: 'function', stateMutability: 'view', inputs: [{ name: 'provider', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }
] as const;
