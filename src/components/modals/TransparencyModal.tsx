import { X, ExternalLink, ShieldCheck, Database, FileCode, Factory, Coins } from 'lucide-react';
import { OFFICIAL_DEPLOYER_ADDRESS, CONTRACT_ADDRESSES, getExplorerAddressUrl } from '../../config/contracts';

interface TransparencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  raffleAddress: string;
  deployerAddress: string;
  feeRecipient?: string;
  feePercent?: number;
}

export function TransparencyModal({ isOpen, onClose, raffleAddress, deployerAddress, feeRecipient, feePercent }: TransparencyModalProps) {
  if (!isOpen) return null;

  const isOfficial = deployerAddress.toLowerCase() === OFFICIAL_DEPLOYER_ADDRESS.toLowerCase();

  const LinkRow = ({ icon: Icon, label, value }: any) => (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
      <div className="flex items-center gap-3">
        <div className="text-gray-400"><Icon size={16} /></div>
        <span className="text-sm font-bold text-gray-600">{label}</span>
      </div>
      <a href={getExplorerAddressUrl(value)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-bold text-blue-500 hover:text-blue-600 hover:underline">
        {value.slice(0, 6)}...{value.slice(-4)}
        <ExternalLink size={10} />
      </a>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
        <div className="bg-gray-900 p-5 text-white flex justify-between items-center"><h3 className="font-black text-lg flex items-center gap-2"><FileCode size={20} className="text-gray-400" /> Contract Details</h3><button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><X size={18} /></button></div>
        <div className="p-6 space-y-6">
          {isOfficial ? (
            <div className="bg-green-50 border border-green-100 p-4 rounded-2xl flex gap-3"><div className="bg-green-100 p-2 rounded-full h-fit text-green-600"><ShieldCheck size={20} /></div><div><h4 className="font-bold text-green-900 text-sm">Official Verified Raffle</h4><p className="text-xs text-green-700/80 mt-1 leading-relaxed">Created by the official Ppopgi System. Rules are immutable.</p></div></div>
          ) : (
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3"><div className="bg-amber-100 p-2 rounded-full h-fit text-amber-600"><Factory size={20} /></div><div><h4 className="font-bold text-amber-900 text-sm">Community Raffle</h4><p className="text-xs text-amber-700/80 mt-1 leading-relaxed">Created by a community member. Check parameters before playing.</p></div></div>
          )}
          <div className="space-y-2"><h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Economics</h4><div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100"><div className="flex items-center gap-3"><div className="text-gray-400"><Coins size={16} /></div><span className="text-sm font-bold text-gray-600">Protocol Fee</span></div><span className="text-sm font-black text-gray-800">{feePercent !== undefined ? `${feePercent}%` : '...'}</span></div>{feeRecipient && <LinkRow icon={Database} label="Fee Treasury" value={feeRecipient} />}</div>
          <div className="space-y-2"><h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">On-Chain Data</h4><LinkRow icon={FileCode} label="Game Contract" value={raffleAddress} /><LinkRow icon={Factory} label="Factory" value={deployerAddress} /><LinkRow icon={Database} label="Entry Coin (USDC)" value={CONTRACT_ADDRESSES.usdc} /></div>
          <div className="text-center pt-2"><p className="text-[10px] text-gray-400">Ppopgi does not hold custody of your funds. Logic executed on Etherlink.</p></div>
        </div>
      </div>
    </div>
  );
}
