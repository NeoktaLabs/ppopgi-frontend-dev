import { User, Wallet, Ticket } from 'lucide-react';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { getHistory } from '../utils/history';
import { LOTTERY_ABI } from '../contracts/abis';
import { RaffleCard } from '../components/RaffleCard';

const HistoryItem = ({ address, onNavigate }: { address: string, onNavigate: (id: string) => void }) => {
  const config = { address: address as `0x${string}`, abi: LOTTERY_ABI };
  const { data: name } = useReadContract({ ...config, functionName: 'name' });
  const { data: prize } = useReadContract({ ...config, functionName: 'winningPot' });
  const { data: price } = useReadContract({ ...config, functionName: 'ticketPrice' });
  const { data: sold } = useReadContract({ ...config, functionName: 'getSold' });
  const { data: min } = useReadContract({ ...config, functionName: 'minTickets' });
  const { data: max } = useReadContract({ ...config, functionName: 'maxTickets' });
  const { data: statusBig } = useReadContract({ ...config, functionName: 'status' });
  const status = statusBig !== undefined ? Number(statusBig) : undefined;
  const { data: deployer } = useReadContract({ ...config, functionName: 'deployer' });
  
  if (!name) return null;

  return (
    <div onClick={() => onNavigate(address)} className="cursor-pointer relative">
      <RaffleCard 
        address={address}
        deployer={deployer as string}
        title={name as string}
        prize={prize ? formatUnits(prize, 6) + ' USDC' : '...'}
        ticketPrice={price ? formatUnits(price, 6) + ' USDC' : '...'}
        sold={Number(sold)}
        minTickets={Number(min)}
        maxTickets={Number(max)}
        endsIn={status === 1 ? 'Active' : 'Ended'}
        color="purple"
      />
    </div>
  );
};

export function Profile({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { isConnected } = useAccount();
  const history = getHistory(); 

  if (!isConnected) return <div className="min-h-screen pt-40 text-center"><h2 className="text-2xl font-black text-gray-400">Please Connect Wallet</h2></div>;

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 animate-fade-in-up">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8"><div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white shadow-lg border-4 border-white"><User size={32} /></div><div><h1 className="text-3xl font-black text-white uppercase tracking-tight drop-shadow-md">Player Dashboard</h1><p className="text-white/80 font-bold text-sm">Your On-Chain History</p></div></div>
        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 border border-white shadow-xl min-h-[400px]">
          <div className="flex items-center gap-2 mb-6 text-gray-500 font-bold uppercase text-xs tracking-wider"><Ticket size={16} /> Recent Interactions</div>
          {history.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{[...new Set(history)].reverse().map(addr => <HistoryItem key={addr} address={addr} onNavigate={onNavigate} />)}</div>
          ) : (
            <div className="text-center py-20"><div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400"><Wallet size={32}/></div><h3 className="text-xl font-bold text-gray-600">No History Found</h3><p className="text-gray-400 mt-2 text-sm">Raffles you Create or Play will appear here.</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
