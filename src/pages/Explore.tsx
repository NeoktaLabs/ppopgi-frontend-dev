import { useMemo, useState } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { Search, Compass, Loader2, AlertCircle } from 'lucide-react';
import { RaffleCard } from '../components/RaffleCard';
import { REGISTRY_ABI, LOTTERY_ABI } from '../contracts/abis';
import { CONTRACT_ADDRESSES, OFFICIAL_DEPLOYER_ADDRESS } from '../config/contracts';

const RaffleCardFetcher = ({ address, onNavigate }: { address: string, onNavigate: (id: string) => void }) => {
  const addr = address as `0x${string}`;

  const contracts = useMemo(
    () => [
      { address: addr, abi: LOTTERY_ABI, functionName: 'name' as const },
      { address: addr, abi: LOTTERY_ABI, functionName: 'winningPot' as const },
      { address: addr, abi: LOTTERY_ABI, functionName: 'ticketPrice' as const },
      { address: addr, abi: LOTTERY_ABI, functionName: 'getSold' as const },
      { address: addr, abi: LOTTERY_ABI, functionName: 'deadline' as const },
      { address: addr, abi: LOTTERY_ABI, functionName: 'minTickets' as const },
      { address: addr, abi: LOTTERY_ABI, functionName: 'maxTickets' as const },
      { address: addr, abi: LOTTERY_ABI, functionName: 'creator' as const },
      { address: addr, abi: LOTTERY_ABI, functionName: 'deployer' as const },
      { address: addr, abi: LOTTERY_ABI, functionName: 'feeRecipient' as const },
      { address: addr, abi: LOTTERY_ABI, functionName: 'protocolFeePercent' as const },
      {
        address: CONTRACT_ADDRESSES.registry,
        abi: REGISTRY_ABI,
        functionName: 'typeIdOf' as const,
        args: [addr],
      },
    ],
    [addr]
  );

  const { data: results } = useReadContracts({ contracts, allowFailure: true });

  const name = results?.[0]?.result as string | undefined;
  const prize = results?.[1]?.result as bigint | undefined;
  const price = results?.[2]?.result as bigint | undefined;
  const sold = results?.[3]?.result as bigint | undefined;
  const deadline = results?.[4]?.result as bigint | undefined;
  const minTickets = results?.[5]?.result as bigint | undefined;
  const maxTickets = results?.[6]?.result as bigint | undefined;
  const creator = results?.[7]?.result as string | undefined;
  const deployer = results?.[8]?.result as string | undefined;
  const feeRecipient = results?.[9]?.result as string | undefined;
  const feePercent = results?.[10]?.result as bigint | undefined;
  const typeId = results?.[11]?.result as bigint | undefined;

  const isVerified =
    !!deployer &&
    deployer.toLowerCase() === OFFICIAL_DEPLOYER_ADDRESS.toLowerCase() &&
    Number(typeId ?? 0n) === 1;

  if (!name || !prize || !price || !deadline || !minTickets) {
    return <div className="w-64 h-[22rem] bg-gray-100/50 rounded-[2rem] animate-pulse"></div>;
  }

  const fmtUSDC = (val: bigint) => formatUnits(val, 6) + ' USDC';
  const getEndsInString = (dl: bigint) => {
    const diff = Number(dl) * 1000 - Date.now();
    if (diff < 0) return "Ended";
    const days = Math.floor(diff / (86400000));
    const hours = Math.floor((diff % 86400000) / 3600000);
    return days > 0 ? `${days}d ${hours}h` : `${hours}h ${(Math.floor((diff % 3600000) / 60000))}m`;
  };

  return (
    <div onClick={() => onNavigate(address)} className="cursor-pointer">
      <RaffleCard 
        address={address}
        deployer={deployer as string}
        title={name as string}
        prize={fmtUSDC(prize as bigint)}
        ticketPrice={fmtUSDC(price as bigint)}
        sold={Number(sold ?? 0n)}
        minTickets={Number(minTickets ?? 0n)}
        maxTickets={Number(maxTickets ?? 0n)}
        endsIn={getEndsInString(deadline as bigint)}
        color="blue"
        creator={creator ? `Player ...${creator.slice(-4)}` : undefined}
        feeRecipient={feeRecipient}
        feePercent={feePercent ? Number(feePercent) : undefined}
        isVerified={!!isVerified}
      />
    </div>
  );
};

export function Explore({ onNavigate }: { onNavigate: (id: string) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: lotteryAddresses, isLoading, isError } = useReadContract({
    address: CONTRACT_ADDRESSES.registry,
    abi: REGISTRY_ABI,
    functionName: 'getAllLotteries',
    args: [BigInt(0), BigInt(20)],
  });

  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-[100rem] mx-auto">
        <div className="mb-6 w-fit">
          <div className="bg-white/60 backdrop-blur-md rounded-2xl p-4 border border-white/60 shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2"><div className="p-2 rounded-xl bg-blue-500 text-white shadow-md rotate-[-6deg]"><Compass size={20} strokeWidth={3} /></div><h2 className="text-2xl font-black text-gray-800/90 tracking-tight uppercase drop-shadow-sm">Explore Market</h2></div>
              <p className="text-gray-600 font-bold text-xs md:text-sm leading-relaxed max-w-2xl pl-1">Real-time feed from the Etherlink Blockchain.</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-3 border border-white/60 shadow-xl flex flex-col md:flex-row items-center gap-3 sticky top-0 z-40 ring-1 ring-black/5 mb-8">
          <div className="relative flex-1 w-full group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none"><Search size={22} className="text-gray-400 group-focus-within:text-blue-500 transition-colors" /></div>
            <input type="text" placeholder="Filter by address..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-gray-50/50 border-2 border-transparent focus:border-blue-400 focus:bg-white rounded-2xl py-4 pl-14 pr-4 text-gray-800 font-bold text-lg focus:outline-none transition-all placeholder:text-gray-400" />
          </div>
        </div>

        {isLoading ? (<div className="flex justify-center py-20"><Loader2 size={48} className="animate-spin text-amber-500"/></div>) : isError ? (<div className="text-center py-20 text-red-500 font-bold">Error connecting to Registry. Check contract address.</div>) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 justify-items-center">
            {lotteryAddresses && lotteryAddresses.length > 0 ? ([...lotteryAddresses].reverse().map((addr) => (<div key={addr} className="w-full flex justify-center"><RaffleCardFetcher address={addr} onNavigate={onNavigate} /></div>))) : (<div className="col-span-full flex flex-col items-center justify-center py-24 text-center bg-white/30 backdrop-blur-sm rounded-3xl border border-white/40"><AlertCircle size={48} className="text-gray-300 mb-4"/><h3 className="text-2xl font-black text-gray-600">No Raffles Found</h3></div>)}
          </div>
        )}
      </div>
    </div>
  );
}
