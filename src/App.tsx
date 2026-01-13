import { useMemo, useState } from 'react';
import { WagmiProvider, useDisconnect, useAccount, useBalance, useReadContract, useReadContracts } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, ConnectButton, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain, formatUnits } from 'viem';
import { Ticket, Store, X, Hourglass, Coins, Zap, Wallet, LogOut, AlertTriangle, LayoutDashboard, Compass, Shield, Loader2, Sparkles } from 'lucide-react';

import { RaffleCard } from './components/RaffleCard';
import { DisclaimerModal } from './components/modals/DisclaimerModal';
import { RaffleDetails } from './pages/RaffleDetails';
import { CreateRaffle } from './pages/CreateRaffle';
import { Explore } from './pages/Explore';
import { Profile } from './pages/Profile';
import { Admin } from './pages/Admin';
import { ERC20_ABI, FACTORY_ABI, REGISTRY_ABI, LOTTERY_ABI } from './contracts/abis';
import { CONTRACT_ADDRESSES, CHAIN_ID, WALLET_CONNECT_PROJECT_ID, isConfigured, OFFICIAL_DEPLOYER_ADDRESS } from './config/contracts';

import '@rainbow-me/rainbowkit/styles.css';

const etherlink = defineChain({ id: CHAIN_ID, name: 'Etherlink Mainnet', network: 'etherlink', nativeCurrency: { decimals: 18, name: 'Tezos', symbol: 'XTZ' }, rpcUrls: { default: { http: ['https://node.mainnet.etherlink.com'] } } });
const config = getDefaultConfig({ appName: 'Ppopgi', projectId: WALLET_CONNECT_PROJECT_ID, chains: [etherlink], ssr: true });
const queryClient = new QueryClient();

// --- COMPONENTS ---
function Notifications(){ return null; } 
function SectionHeader({ icon: Icon, title, colorClass }: any) { return <div className="flex items-center gap-3 mb-4 pl-1"><div className={`p-2 rounded-xl ${colorClass} text-white shadow-md rotate-[-6deg]`}><Icon size={20} strokeWidth={3} /></div><h2 className="text-2xl font-black text-gray-800/90 tracking-tight uppercase drop-shadow-sm">{title}</h2></div>; }
function PageModal({ children, onClose }: { children: React.ReactNode, onClose: () => void }) { return <div className="fixed inset-0 z-[60] flex items-center justify-center animate-fade-in"><div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div><div className="relative w-full h-full overflow-y-auto overflow-x-hidden pt-4 pb-20"><button onClick={onClose} className="fixed top-6 right-6 z-[70] bg-white text-gray-800 p-3 rounded-full shadow-lg hover:bg-gray-100 hover:scale-110 transition-all border border-gray-200"><X size={24} strokeWidth={3} /></button>{children}</div></div>; }

function CashierModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    if (!isOpen) return null;
    return <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div><div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up"><div className="bg-[#FFD700] p-5 text-center relative"><button onClick={onClose} className="absolute top-4 right-4 text-amber-900 hover:text-white transition-colors"><X size={24} /></button><div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-md"><Store size={32} className="text-amber-500" /></div><h2 className="text-xl font-black text-amber-900 uppercase tracking-tight">Coin Cashier 🏪</h2></div><div className="p-6 space-y-4"><div className="text-center text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-200"><p className="font-bold text-gray-800 mb-1">How Energy (XTZ) works:</p><p>Energy is used to power the park. If Energy can't be returned instantly after a game, <span className="font-bold text-amber-600">it’s always saved for you to Collect later</span> in your Dashboard.</p></div><div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100"><div className="bg-amber-100 p-2 rounded-lg text-amber-600"><Coins size={24} /></div><div><h4 className="font-bold text-amber-900 text-sm">Entry Coins (USDC)</h4></div></div><div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl border border-green-100"><div className="bg-green-100 p-2 rounded-lg text-green-600"><Zap size={24} /></div><div><h4 className="font-bold text-green-900 text-sm">Energy Coins (XTZ)</h4></div></div></div></div></div>;
}

function Navbar({ onOpenCashier, onNavigate }: { onOpenCashier: () => void, onNavigate: (view: any) => void }) {
    const { disconnect } = useDisconnect();
    const { address } = useAccount(); // Removed isConnected
    
    const { data: xtzBalance } = useBalance({ address });
    const { data: usdcBalance } = useReadContract({ address: CONTRACT_ADDRESSES.usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: address ? [address] : undefined, query: { enabled: !!address } });
    const { data: factoryOwner } = useReadContract({ address: CONTRACT_ADDRESSES.factory, abi: FACTORY_ABI, functionName: 'owner' });
    const isOwner = address && factoryOwner && (address.toLowerCase() === (factoryOwner as string).toLowerCase());
    const formatBalance = (value: unknown, decimals: number, symbol: string) => { if (value === undefined || value === null) return `... ${symbol}`; const val = value as bigint; const formatted = parseFloat(formatUnits(val, decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 }); return `${formatted} ${symbol}`; };
    
    return (
        <nav className="w-full h-20 bg-white/85 backdrop-blur-md border-b border-white/50 fixed top-0 z-50 flex items-center justify-between px-4 md:px-8 shadow-sm">
            <ConnectButton.Custom>
                {({ account, chain, openConnectModal, mounted }) => { // Removed openAccountModal
                    const connected = mounted && account && chain;
                    return (
                        <>
                            <div className="flex items-center gap-6"><div onClick={() => onNavigate('home')} className="flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"><div className="w-9 h-9 bg-[#FFD700] rounded-full flex items-center justify-center text-white font-bold shadow-inner border-2 border-white"><Ticket size={18} className="text-amber-700" /></div><span className="font-bold text-xl text-amber-800 tracking-tight hidden md:block">Ppopgi</span></div><div className="hidden md:flex items-center gap-2"><button onClick={() => onNavigate('explore')} className="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Compass size={16} /> Explore</button>{connected && (<button onClick={() => onNavigate('profile')} className="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-colors animate-fade-in"><LayoutDashboard size={16} /> Dashboard</button>)}{connected && isOwner && (<button onClick={() => onNavigate('admin')} className="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors animate-fade-in"><Shield size={16} /> Admin</button>)}<button onClick={() => connected ? onNavigate('create') : openConnectModal()} className="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm text-gray-600 hover:text-amber-700 hover:bg-amber-100 transition-colors"><Ticket size={16} /> Create</button></div></div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-3 bg-gray-50/80 p-1.5 pr-2 rounded-2xl border border-gray-200/60 shadow-inner">{connected && (<div className="hidden lg:flex flex-col gap-1 pl-1"><div className="w-36 bg-[#E8F5E9] text-green-700 px-2.5 py-1 rounded-md font-bold text-[10px] flex items-center justify-between border border-green-200 shadow-sm tracking-tight"><div className="flex items-center gap-1.5"><Zap size={10} className="fill-green-600" /> <span>Energy</span></div><span>{xtzBalance ? `${parseFloat(xtzBalance.formatted).toFixed(2)} XTZ` : '...'}</span></div><div className="w-36 bg-[#FFF8E1] text-amber-700 px-2.5 py-1 rounded-md font-bold text-[10px] flex items-center justify-between border border-amber-200 shadow-sm tracking-tight"><div className="flex items-center gap-1.5"><Coins size={10} className="fill-amber-500" /> <span>Entry</span></div><span>{formatBalance(usdcBalance, 6, 'USDC')}</span></div></div>)}<button onClick={onOpenCashier} className="bg-amber-500 hover:bg-amber-600 text-white p-2 md:px-4 md:py-2.5 rounded-xl font-bold shadow-sm active:shadow-none active:translate-y-1 transition-all flex items-center gap-2 text-xs md:text-sm h-full"><Store size={18} /><span className="hidden md:inline">Cashier</span></button></div>
                                {connected ? (<div className="flex items-center gap-2"><button onClick={() => onNavigate('profile')} className="bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-100 px-4 py-2 rounded-xl font-bold shadow-sm flex items-center gap-2 text-sm transition-colors"><div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>{`Player ...${account.address.slice(-4)}`}</button><button onClick={() => disconnect()} className="bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500 p-2.5 rounded-xl transition-colors border border-transparent hover:border-red-100" title="Disconnect Wallet"><LogOut size={18} /></button></div>) : (<button onClick={openConnectModal} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-[0_4px_0_0_#1e3a8a] active:shadow-none active:translate-y-1 transition-all flex items-center gap-2 text-sm"><Wallet size={18} /><span className="hidden md:inline">Join the Park</span><span className="md:hidden">Join</span></button>)}
                            </div>
                        </>
                    );
                }}
            </ConnectButton.Custom>
        </nav>
    );
}

const HomeRaffleFetcher = ({ address, onNavigate, color, rank }: { address: string, onNavigate: (id: string) => void, color: any, rank?: number }) => {
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
    return (
      <div className="w-64 h-[22rem] bg-white/20 backdrop-blur-sm rounded-[2rem] border border-white/30 animate-pulse flex items-center justify-center">
        <Loader2 className="animate-spin text-white/50" />
      </div>
    );
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
        deployer={deployer}
        title={name as string}
        prize={fmtUSDC(prize as bigint)}
        ticketPrice={fmtUSDC(price as bigint)}
        sold={Number(sold ?? 0n)}
        minTickets={Number(minTickets ?? 0n)}
        maxTickets={Number(maxTickets ?? 0n)}
        endsIn={getEndsInString(deadline as bigint)}
        color={color}
        creator={creator ? `Player ...${creator.slice(-4)}` : undefined}
        rank={rank}
        feeRecipient={feeRecipient}
        feePercent={feePercent ? Number(feePercent) : undefined}
        isVerified={!!isVerified}
      />
    </div>
  );
};

function HomeView({ onNavigate }: { onNavigate: (id: string) => void }) {
  // Pull a larger page so the sort feels meaningful without an indexer.
  const { data: lotteryAddresses, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.registry,
    abi: REGISTRY_ABI,
    functionName: 'getAllLotteries',
    args: [BigInt(0), BigInt(100)],
  });

  const nowSec = Math.floor(Date.now() / 1000);

  const metricsContracts = useMemo(() => {
    if (!lotteryAddresses || lotteryAddresses.length === 0) return [];
    return (lotteryAddresses as string[]).flatMap((addr) => {
      const a = addr as `0x${string}`;
      return [
        { address: a, abi: LOTTERY_ABI, functionName: 'winningPot' as const },
        { address: a, abi: LOTTERY_ABI, functionName: 'deadline' as const },
        { address: a, abi: LOTTERY_ABI, functionName: 'status' as const },
      ];
    });
  }, [lotteryAddresses]);

  const { data: metrics } = useReadContracts({
    contracts: metricsContracts,
    allowFailure: true,
    query: { enabled: !!lotteryAddresses && (lotteryAddresses as any[])?.length > 0 },
  });

  const homeLists = useMemo(() => {
    if (!lotteryAddresses || !metrics || metrics.length === 0) {
      return { biggest: [] as string[], expiring: [] as string[] };
    }

    const rows: { addr: string; pot: bigint; deadline: bigint; status: number }[] = [];

    for (let i = 0; i < (lotteryAddresses as string[]).length; i++) {
      const addr = (lotteryAddresses as string[])[i];
      const pot = (metrics[i * 3 + 0]?.result as bigint) ?? 0n;
      const dl = (metrics[i * 3 + 1]?.result as bigint) ?? 0n;
      const st = Number((metrics[i * 3 + 2]?.result as bigint) ?? 0n);
      rows.push({ addr, pot, deadline: dl, status: st });
    }

    // Prefer Open raffles (status=1). If none exist, fall back to all.
    const open = rows.filter((r) => r.status === 1);
    const source = open.length > 0 ? open : rows;

    const biggest = [...source]
      .filter((r) => r.deadline === 0n || Number(r.deadline) > 0)
      .sort((a, b) => (a.pot === b.pot ? 0 : a.pot > b.pot ? -1 : 1))
      .slice(0, 3)
      .map((r) => r.addr);

    const used = new Set(biggest);

    const expiring = [...source]
      .filter((r) => !used.has(r.addr))
      .filter((r) => Number(r.deadline) > nowSec) // only future deadlines
      .sort((a, b) => Number(a.deadline) - Number(b.deadline))
      .slice(0, 5)
      .map((r) => r.addr);

    return { biggest, expiring };
  }, [lotteryAddresses, metrics, nowSec]);

  const biggestPots = homeLists.biggest;
  const expiringSoon = homeLists.expiring;

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 size={64} className="text-amber-500 animate-spin"/></div>;

  return (
    <main className="container mx-auto px-4 pt-20 max-w-[100rem] animate-fade-in">
      <div className="w-fit mx-auto bg-white/10 backdrop-blur-sm rounded-3xl p-6 mb-6 border border-white/30 shadow-lg relative overflow-visible mt-8">
          <SectionHeader icon={Sparkles} title="Biggest Winning Pots" colorClass="bg-yellow-400" />
          {biggestPots.length > 0 ? (
            <div className="flex flex-col md:flex-row items-center md:items-end justify-center gap-6 md:gap-4 pt-4 md:pt-8 pb-4 relative z-10">
              {biggestPots[1] && <div className="w-full max-w-[260px] order-2 md:order-1 relative flex flex-col items-center"><HomeRaffleFetcher address={biggestPots[1]} onNavigate={onNavigate} color="silver" rank={2} /><div className="hidden md:block w-[90%] h-6 bg-gradient-to-t from-slate-200 to-slate-100/50 rounded-b-2xl mt-[-10px] z-0 border-b-2 border-slate-200"></div></div>}
              {biggestPots[0] && <div className="w-full max-w-[260px] order-1 md:order-2 md:-mt-12 relative z-20 flex flex-col items-center"><HomeRaffleFetcher address={biggestPots[0]} onNavigate={onNavigate} color="gold" rank={1} /><div className="hidden md:block w-full h-10 bg-gradient-to-t from-yellow-300/60 via-yellow-200/40 to-transparent rounded-b-3xl mt-[-12px] z-0 shadow-[0_10px_20px_-5px_rgba(234,179,8,0.3)] border-b-4 border-yellow-400/50"></div></div>}
              {biggestPots[2] && <div className="w-full max-w-[260px] order-3 md:order-3 relative flex flex-col items-center"><HomeRaffleFetcher address={biggestPots[2]} onNavigate={onNavigate} color="bronze" rank={3} /><div className="hidden md:block w-[90%] h-6 bg-gradient-to-t from-orange-200/50 to-orange-100/30 rounded-b-2xl mt-[-10px] z-0 border-b-2 border-orange-300/50"></div></div>}
            </div>
          ) : <div className="text-center py-20 text-white/80 font-bold">No raffles live yet. Be the first!</div>}
          <div className="hidden md:block absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-gradient-to-t from-yellow-100/60 to-transparent rounded-t-[50%] blur-3xl -z-10"></div>
      </div>

      {expiringSoon.length > 0 && (
        <div className="w-fit mx-auto bg-white/10 backdrop-blur-sm rounded-3xl p-6 mb-6 border border-white/30 shadow-lg">
          <SectionHeader icon={Hourglass} title="Expiring Soon" colorClass="bg-red-400" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 justify-items-center">
            {expiringSoon.map((addr) => (
              <HomeRaffleFetcher key={addr} address={addr} onNavigate={onNavigate} color="pink" />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

export default function App() {
  const [isCashierOpen, setCashierOpen] = useState(false);
  const [currentModal, setCurrentModal] = useState<'none' | 'details' | 'create' | 'explore' | 'profile' | 'admin'>('none');
  const [selectedRaffleId, setSelectedRaffleId] = useState<string | null>(null);
  const openDetails = (id: string) => { setSelectedRaffleId(id); setCurrentModal('details'); };
  const closeModal = () => setCurrentModal('none');

  if (!isConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md"><AlertTriangle size={48} className="text-red-500 mx-auto mb-4"/><h1 className="text-2xl font-black text-gray-800">Setup Required</h1><p className="text-gray-600 mt-2">The application is missing contract configuration. Please set <code className="bg-gray-200 px-1 rounded">VITE_FACTORY_ADDRESS</code> in your .env file.</p></div>
      </div>
    );
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider coolMode>
          <div className="min-h-screen pb-12 relative">
            <Navbar onOpenCashier={() => setCashierOpen(true)} onNavigate={(view) => { if (view === 'home') closeModal(); else setCurrentModal(view); }} />
            <DisclaimerModal />
            <CashierModal isOpen={isCashierOpen} onClose={() => setCashierOpen(false)} />
            <Notifications />
            <div className={`transition-all duration-300 ${currentModal !== 'none' ? 'scale-[0.98] blur-[2px] opacity-50 pointer-events-none' : ''}`}><HomeView onNavigate={openDetails} /></div>
            {currentModal === 'explore' && <PageModal onClose={closeModal}><Explore onNavigate={openDetails} /></PageModal>}
            {currentModal === 'create' && <PageModal onClose={closeModal}><CreateRaffle onBack={closeModal} /></PageModal>}
            {currentModal === 'details' && <PageModal onClose={closeModal}><RaffleDetails onBack={closeModal} raffleAddress={selectedRaffleId || undefined} /></PageModal>}
            {currentModal === 'profile' && <PageModal onClose={closeModal}><Profile onNavigate={openDetails} /></PageModal>}
            {currentModal === 'admin' && <PageModal onClose={closeModal}><Admin onBack={closeModal} /></PageModal>}
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
