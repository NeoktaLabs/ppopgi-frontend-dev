// src/components/RaffleCard.tsx
import { useState } from "react";
import { Ticket, Clock, Trophy, Users, CheckCircle2, Search, Target } from "lucide-react";
import { TransparencyModal } from "./modals/TransparencyModal";
import { OFFICIAL_DEPLOYER_ADDRESS } from "../config/contracts";

interface RaffleCardProps {
  address?: string;
  deployer?: string;
  title: string;
  prize: string;
  ticketPrice: string;
  sold: number;
  minTickets: number;
  maxTickets: number;
  endsIn: string;
  color: any;
  creator?: string;
  rank?: number;
  feePercent?: number;
  feeRecipient?: string;
  isVerified?: boolean;
}

export function RaffleCard({
  address,
  deployer,
  title,
  prize,
  ticketPrice,
  sold,
  minTickets,
  maxTickets,
  endsIn,
  color,
  creator,
  rank,
  feePercent,
  feeRecipient,
  isVerified,
}: RaffleCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const isOfficial =
    isVerified || (deployer && deployer.toLowerCase() === OFFICIAL_DEPLOYER_ADDRESS.toLowerCase());

  const getTheme = (c: string) => {
    switch (c) {
      case "gold":
        return "from-yellow-300 via-amber-400 to-yellow-500 shadow-yellow-200 border-yellow-300";
      case "silver":
        return "from-slate-300 via-slate-400 to-slate-500 shadow-slate-200 border-slate-300";
      case "bronze":
        return "from-orange-300 via-orange-400 to-orange-500 shadow-orange-200 border-orange-300";
      case "pink":
        return "from-pink-400 to-rose-500 shadow-pink-200 border-pink-300";
      default:
        return "from-blue-400 to-indigo-500 shadow-blue-200 border-blue-300";
    }
  };

  const hasHardCap = maxTickets > 0;
  const percent = hasHardCap ? Math.min((sold / maxTickets) * 100, 100) : 0;
  const minReached = sold >= minTickets;

  return (
    <>
      <div
        className={`relative w-64 h-[22rem] rounded-[2rem] p-1.5 bg-gradient-to-br ${getTheme(
          color
        )} shadow-xl transform transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:scale-[1.02] border-2`}
      >
        {rank && (
          <div className="absolute -top-4 -left-4 w-10 h-10 bg-white rounded-full flex items-center justify-center font-black text-gray-800 shadow-lg border-2 border-gray-100 z-20">
            #{rank}
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDetails(true);
          }}
          className="absolute -top-3 -right-3 z-30 w-8 h-8 bg-white text-gray-400 hover:text-blue-500 rounded-full flex items-center justify-center shadow-md border border-gray-100 transition-colors"
          title="View Contract Details"
        >
          <Search size={14} strokeWidth={3} />
        </button>

        <div className="absolute inset-x-4 top-[-6px] h-3 bg-white/30 rounded-t-xl z-0 mx-4"></div>

        <div className="relative h-full bg-white rounded-[1.7rem] overflow-hidden flex flex-col z-10">
          <div className="bg-gray-50 p-4 pb-8 border-b border-dashed border-gray-200 relative">
            <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-white rounded-full border border-gray-100 z-10"></div>
            <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-white rounded-full border border-gray-100 z-10"></div>

            <div className="flex justify-between items-start mb-2">
              {isOfficial ? (
                <span className="bg-green-100 px-2 py-0.5 rounded text-[10px] font-bold text-green-700 uppercase tracking-wide flex items-center gap-1 border border-green-200">
                  <CheckCircle2 size={10} className="fill-green-600 text-white" /> Official
                </span>
              ) : (
                <span className="bg-black/5 px-2 py-0.5 rounded text-[10px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <Ticket size={10} /> Raffle
                </span>
              )}

              {creator && (
                <span className="text-[10px] font-bold text-gray-400 truncate max-w-[80px]">
                  {creator}
                </span>
              )}
            </div>

            <h3 className="font-black text-gray-800 text-lg leading-tight mb-1 truncate">{title}</h3>

            <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
              <Trophy size={14} className="fill-current" />
              <span>{prize}</span>
            </div>
          </div>

          <div className="flex-1 p-4 flex flex-col justify-center space-y-3">
            {hasHardCap ? (
              <>
                <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <span>Sold Out Progress</span>
                  <span>
                    {sold}/{maxTickets}
                  </span>
                </div>

                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <span>Minimum Goal</span>
                  <span>
                    {sold}/{minTickets}
                  </span>
                </div>

                <div
                  className={`flex items-center gap-2 p-2 rounded-lg text-xs font-bold ${
                    minReached ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <Target size={14} /> {minReached ? "Minimum Met (Active)" : "Funding..."}
                </div>
              </>
            )}

            <div className="flex justify-between items-center mt-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-lg">
                <Users size={12} /> {sold} Sold
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg">
                <Clock size={12} /> {endsIn}
              </div>
            </div>
          </div>

          <div className="p-3 bg-gray-50 border-t border-dashed border-gray-200">
            <button className="w-full py-2.5 rounded-xl bg-gray-900 text-white font-bold text-sm shadow-lg shadow-gray-200 active:scale-95 transition-transform flex items-center justify-center gap-2 group">
              <span>Buy for {ticketPrice}</span>
              <Ticket size={14} className="group-hover:rotate-12 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      <TransparencyModal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        raffleAddress={address || "0x..."}
        deployerAddress={deployer || "0x..."}
        feeRecipient={feeRecipient}
        feePercent={feePercent}
      />
    </>
  );
}