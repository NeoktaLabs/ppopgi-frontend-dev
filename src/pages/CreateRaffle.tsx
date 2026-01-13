import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { ArrowRight, Coins, Trophy, CheckCircle2, Loader2, ShieldCheck, Ticket, AlertCircle } from 'lucide-react';
import { RaffleCard } from '../components/RaffleCard';
import { FACTORY_ABI, ERC20_ABI } from '../contracts/abis';
import { CONTRACT_ADDRESSES } from '../config/contracts';

export function CreateRaffle({ onBack }: { onBack: () => void }) {
  const { address } = useAccount();
  const [step, setStep] = useState<'idle' | 'approving' | 'creating' | 'success'>('idle');
  
  const [formData, setFormData] = useState({
    title: '',
    prizeAmount: '',
    ticketPrice: '',
    minTickets: '10',
    maxTickets: '',
    minPurchaseAmount: '1',
    durationDays: '1',
    durationHours: '0',
    theme: 'pink'
  });

  const prizeBN = formData.prizeAmount ? parseUnits(formData.prizeAmount, 6) : BigInt(0);
  const priceBN = formData.ticketPrice ? parseUnits(formData.ticketPrice, 6) : BigInt(0);
  const durationSeconds = (parseInt(formData.durationDays || '0') * 86400) + (parseInt(formData.durationHours || '0') * 3600);
  
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESSES.factory] : undefined,
  });

  const needsApproval = allowance ? allowance < prizeBN : true;

  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      if (step === 'approving') {
        refetchAllowance();
        setStep('idle');
      } else if (step === 'creating') {
        setStep('success');
      }
    }
  }, [isSuccess, step, refetchAllowance]);

  const handleApprove = () => {
    setStep('approving');
    writeContract({
      address: CONTRACT_ADDRESSES.usdc,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACT_ADDRESSES.factory, prizeBN],
    });
  };

  const handleCreate = () => {
    if (durationSeconds < 600) return alert("Duration must be at least 10 minutes (600s).");
    if (prizeBN === BigInt(0) || priceBN === BigInt(0)) return alert("Prize and Price must be greater than 0.");

    setStep('creating');
    writeContract({
      address: CONTRACT_ADDRESSES.factory,
      abi: FACTORY_ABI,
      functionName: 'createSingleWinnerLottery',
      args: [
        formData.title,
        priceBN,
        prizeBN,
        BigInt(formData.minTickets || 0),
        formData.maxTickets ? BigInt(formData.maxTickets) : BigInt(0),
        BigInt(durationSeconds),
        Number(formData.minPurchaseAmount || 1)
      ],
    });
  };

  const isValid = formData.title && formData.prizeAmount && formData.ticketPrice && durationSeconds >= 600;

  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fade-in-up">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6 shadow-xl shadow-green-200"><CheckCircle2 size={48} /></div>
        <h2 className="text-3xl font-black text-gray-800 mb-2">Raffle Created!</h2>
        <p className="text-gray-500 max-w-md mb-8">Your raffle is now live on Etherlink. It will appear in the Explore tab shortly.</p>
        <button onClick={onBack} className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all">Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 animate-fade-in">
      <div className="max-w-6xl mx-auto mb-8 flex items-center gap-4"><button onClick={onBack} className="bg-white/50 hover:bg-white/80 p-2.5 rounded-full backdrop-blur-sm transition-all shadow-sm"><ArrowRight size={20} className="rotate-180 text-gray-700" /></button><span className="text-white font-bold text-lg drop-shadow-md">Back to Park</span></div>
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        <div className="lg:col-span-7">
          <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white shadow-xl relative">
             {(isPending || isConfirming) && (<div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm rounded-[2.5rem] flex flex-col items-center justify-center text-center p-8"><div className="animate-spin text-amber-500 mb-4"><Loader2 size={48} /></div><h3 className="text-xl font-bold text-gray-800">{step === 'approving' ? 'Approving Entry Coins...' : 'Minting Raffle...'}</h3><p className="text-gray-500 mt-2">Please confirm in your wallet.</p></div>)}
             <h2 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-2"><Ticket className="text-amber-500" /> Create Raffle</h2>
             <div className="space-y-6">
               <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Raffle Title</label><input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-gray-50 border-2 border-gray-100 focus:border-amber-400 text-gray-800 text-lg font-bold rounded-xl px-4 py-3 outline-none transition-all" placeholder="e.g. Bored Ape Giveaway" maxLength={50} /></div>
               <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Prize Pot (USDC)</label><div className="relative"><input type="number" value={formData.prizeAmount} onChange={e => setFormData({...formData, prizeAmount: e.target.value})} className="w-full bg-gray-50 border-2 border-gray-100 focus:border-amber-400 text-gray-800 font-bold rounded-xl px-4 py-3 pl-10 outline-none" placeholder="1000" /><Trophy size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /></div></div><div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Ticket Price (USDC)</label><div className="relative"><input type="number" value={formData.ticketPrice} onChange={e => setFormData({...formData, ticketPrice: e.target.value})} className="w-full bg-gray-50 border-2 border-gray-100 focus:border-amber-400 text-gray-800 font-bold rounded-xl px-4 py-3 pl-10 outline-none" placeholder="5" /><Coins size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /></div></div></div>
               <div className="grid grid-cols-3 gap-4"><div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Min Tickets</label><input type="number" value={formData.minTickets} onChange={e => setFormData({...formData, minTickets: e.target.value})} className="w-full bg-gray-50 border-2 border-gray-100 focus:border-amber-400 text-gray-800 font-bold rounded-xl px-4 py-3 outline-none" /></div><div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Max (0 = ∞)</label><input type="number" value={formData.maxTickets} onChange={e => setFormData({...formData, maxTickets: e.target.value})} className="w-full bg-gray-50 border-2 border-gray-100 focus:border-amber-400 text-gray-800 font-bold rounded-xl px-4 py-3 outline-none" placeholder="∞" /></div><div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Min Buy</label><input type="number" value={formData.minPurchaseAmount} onChange={e => setFormData({...formData, minPurchaseAmount: e.target.value})} className="w-full bg-gray-50 border-2 border-gray-100 focus:border-amber-400 text-gray-800 font-bold rounded-xl px-4 py-3 outline-none" /></div></div>
               <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Duration</label><div className="flex gap-4"><div className="flex-1 relative"><input type="number" value={formData.durationDays} onChange={e => setFormData({...formData, durationDays: e.target.value})} className="w-full bg-gray-50 border-2 border-gray-100 focus:border-amber-400 text-gray-800 font-bold rounded-xl px-4 py-3 text-center outline-none" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">DAYS</span></div><div className="flex-1 relative"><input type="number" value={formData.durationHours} onChange={e => setFormData({...formData, durationHours: e.target.value})} className="w-full bg-gray-50 border-2 border-gray-100 focus:border-amber-400 text-gray-800 font-bold rounded-xl px-4 py-3 text-center outline-none" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">HRS</span></div></div></div>
               {error && (<div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl flex items-center gap-2"><AlertCircle size={16} /> {error.message.split('.')[0]}</div>)}
               <div className="pt-4 border-t border-gray-100">
                 {needsApproval ? (
                   <button onClick={handleApprove} disabled={!isValid || isPending} className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl shadow-[0_4px_0_0_#1d4ed8] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2"><ShieldCheck size={20} /> APPROVE ENTRY COINS</button>
                 ) : (
                   <button onClick={handleCreate} disabled={!isValid || isPending} className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl shadow-[0_4px_0_0_#b45309] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2"><Ticket size={20} /> CREATE RAFFLE</button>
                 )}
                 <p className="text-center text-xs text-gray-400 mt-3">{needsApproval ? `Approve ${formData.prizeAmount || '0'} USDC for the prize pot.` : 'Ready to mint your raffle contract.'}</p>
               </div>
             </div>
          </div>
        </div>
        <div className="lg:col-span-5 hidden lg:block sticky top-28">
           <div className="text-center mb-6"><h3 className="text-white font-bold text-xl drop-shadow-md">Live Preview</h3></div>
           <div className="transform scale-110 origin-top flex justify-center"><RaffleCard title={formData.title || "Untitled"} prize={`${formData.prizeAmount || 0} USDC`} ticketPrice={`${formData.ticketPrice || 0} USDC`} sold={0} minTickets={Number(formData.minTickets) || 10} maxTickets={Number(formData.maxTickets) || 0} endsIn={`${formData.durationDays}d ${formData.durationHours}h`} color={formData.theme as any} creator="You"/></div>
        </div>
      </div>
    </div>
  );
}
