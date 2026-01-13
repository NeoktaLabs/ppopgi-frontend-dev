import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { isAddress } from 'viem';
import { Shield, Settings, AlertTriangle, Save, Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { FACTORY_ABI } from '../contracts/abis';
import { CONTRACT_ADDRESSES } from '../config/contracts';

export function Admin({ onBack }: { onBack: () => void }) {
  const { address } = useAccount();
  const [activeSection, setActiveSection] = useState<'config' | 'emergency'>('config');
  
  const { data: factoryOwner } = useReadContract({ address: CONTRACT_ADDRESSES.factory, abi: FACTORY_ABI, functionName: 'owner' });
  const isOwner = address && factoryOwner && (address.toLowerCase() === (factoryOwner as string).toLowerCase());

  const [feePercent, setFeePercent] = useState('');
  const [feeRecipient, setFeeRecipient] = useState('');
  const [confirmUpdate, setConfirmUpdate] = useState(false);

  const { data: currentUsdc, isLoading: loadingUsdc } = useReadContract({ address: CONTRACT_ADDRESSES.factory, abi: FACTORY_ABI, functionName: 'usdc' });
  const { data: currentEntropy } = useReadContract({ address: CONTRACT_ADDRESSES.factory, abi: FACTORY_ABI, functionName: 'entropy' });
  const { data: currentProvider } = useReadContract({ address: CONTRACT_ADDRESSES.factory, abi: FACTORY_ABI, functionName: 'entropyProvider' });
  const { data: currentRecipient } = useReadContract({ address: CONTRACT_ADDRESSES.factory, abi: FACTORY_ABI, functionName: 'feeRecipient' });
  const { data: currentPercent } = useReadContract({ address: CONTRACT_ADDRESSES.factory, abi: FACTORY_ABI, functionName: 'protocolFeePercent' });

  useEffect(() => {
    if (currentRecipient) setFeeRecipient(currentRecipient as string);
    if (currentPercent !== undefined) setFeePercent(currentPercent.toString());
  }, [currentRecipient, currentPercent]);

  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleSaveConfig = () => {
    if (!isAddress(feeRecipient)) return alert("Invalid Fee Recipient Address");
    if (Number(feePercent) > 20) return alert("Fee cannot exceed 20%");
    
    writeContract({
      address: CONTRACT_ADDRESSES.factory,
      abi: FACTORY_ABI,
      functionName: 'setConfig',
      args: [
        currentUsdc as `0x${string}`,
        currentEntropy as `0x${string}`,
        currentProvider as `0x${string}`,
        feeRecipient as `0x${string}`,
        BigInt(feePercent)
      ]
    });
  };

  const canSave = confirmUpdate && !loadingUsdc && currentUsdc && currentEntropy && currentProvider && isAddress(feeRecipient) && feePercent !== '';

  if (!isOwner) return (
    <div className="min-h-screen pt-24 px-4 flex justify-center">
      <div className="bg-red-50 p-8 rounded-3xl text-center border border-red-100 max-w-md"><Lock size={32} className="mx-auto mb-4 text-red-500"/><h1 className="text-2xl font-black text-red-900 uppercase">Access Denied</h1><button onClick={onBack} className="mt-6 px-6 py-2 bg-white text-red-700 font-bold rounded-xl border border-red-200">Back</button></div>
    </div>
  );

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 animate-fade-in-up">
       <div className="max-w-5xl mx-auto">
         <div className="flex items-center gap-4 mb-8"><div className="w-14 h-14 bg-slate-800 text-white rounded-2xl flex items-center justify-center shadow-lg rotate-3"><Shield size={28} /></div><div><h1 className="text-3xl font-black text-gray-800 uppercase">Admin Console</h1></div></div>
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           <div className="lg:col-span-3 space-y-2"><button onClick={() => setActiveSection('config')} className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors ${activeSection === 'config' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><Settings size={18} /> Config</button><button onClick={() => setActiveSection('emergency')} className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors ${activeSection === 'emergency' ? 'bg-red-600 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><AlertTriangle size={18} /> Emergency</button></div>
           <div className="lg:col-span-9">
             {activeSection === 'config' && (
               <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-xl space-y-8">
                 <div><h2 className="text-xl font-black text-gray-800 mb-1">Fee Configuration</h2><p className="text-sm text-gray-500">Manage protocol fees for future raffles.</p></div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Fee Recipient</label><input type="text" value={feeRecipient} onChange={(e) => setFeeRecipient(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-100 focus:border-blue-500 text-gray-800 font-mono text-sm rounded-xl px-4 py-3 outline-none" placeholder="0x..." /></div><div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Protocol Fee %</label><input type="number" value={feePercent} onChange={(e) => setFeePercent(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-100 focus:border-blue-500 text-gray-800 font-bold text-lg rounded-xl px-4 py-3 outline-none" placeholder="5" max="20" /></div></div>
                 <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3"><AlertTriangle className="text-amber-500 shrink-0" size={20} /><div><h4 className="font-bold text-amber-900 text-sm">Important Note</h4><p className="text-xs text-amber-800/80 mt-1">Updates affect newly created raffles only.</p></div></div>
                 <div className="flex items-center gap-2"><input type="checkbox" id="confirm" checked={confirmUpdate} onChange={(e) => setConfirmUpdate(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /><label htmlFor="confirm" className="text-sm font-bold text-gray-600 cursor-pointer select-none">I confirm these changes are correct.</label></div>
                 <button onClick={handleSaveConfig} disabled={!canSave || isPending || isConfirming} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-xl flex items-center gap-2 shadow-lg transition-all">{isPending || isConfirming ? <Loader2 className="animate-spin" size={18}/> : <Save size={18} />}{loadingUsdc ? 'Loading Data...' : isPending ? 'Check Wallet...' : isConfirming ? 'Updating...' : 'Save Configuration'}</button>
                 {isSuccess && <div className="text-green-600 font-bold flex items-center gap-2"><CheckCircle2 size={18}/> Config Updated!</div>}
               </div>
             )}
             {activeSection === 'emergency' && (<div className="bg-white rounded-3xl p-8 border border-red-100 shadow-xl space-y-4"><h2 className="text-xl font-black text-gray-800">Rescue Registration</h2><p className="text-gray-500 text-sm">Force-register a valid raffle.</p><input type="text" placeholder="Raffle Address (0x...)" className="w-full bg-gray-50 border-2 border-gray-100 focus:border-red-500 text-gray-800 font-mono text-sm rounded-xl px-4 py-3 outline-none" /><button className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl shadow-lg">Force Register</button></div>)}
           </div>
         </div>
       </div>
    </div>
  );
}
