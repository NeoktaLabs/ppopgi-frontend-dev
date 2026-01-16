// src/features/home/HomePage.tsx
import { useBigPrizes, useEndingSoon } from "../raffles/useRafflesHome";
import { RaffleCard } from "../raffles/RaffleCard";

export function HomePage({
  onOpenRaffle,
  onOpenSafety,
}: {
  onOpenRaffle: (id: string) => void;
  onOpenSafety: (raffleId: string) => void;
}) {
  const big = useBigPrizes();
  const soon = useEndingSoon();

  return (
    <main className="container mx-auto px-4 pt-2 max-w-[100rem] animate-fade-in">
      {/* SECTION: Big prizes */}
      <div className="w-fit mx-auto bg-white/10 backdrop-blur-sm rounded-3xl p-6 mb-6 border border-white/30 shadow-lg relative overflow-visible mt-6">
        <div className="flex items-center gap-3 mb-2 pl-1">
          <div className="p-2 rounded-xl bg-yellow-400 text-white shadow-md rotate-[-6deg]">
            <span className="text-lg">🎟️</span>
          </div>
          <h2 className="text-2xl font-black text-gray-800/90 tracking-tight uppercase drop-shadow-sm">
            Big prizes right now
          </h2>
        </div>

        <p className="text-gray-600 font-bold text-xs md:text-sm leading-relaxed max-w-2xl pl-1">
          The biggest rewards you can win today.
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 justify-items-center">
          {big.isLoading && <div className="text-white font-bold opacity-80 py-10">Loading…</div>}

          {big.error && (
            <div className="text-white font-bold opacity-90 py-10">
              Loading directly from the network… This may take a moment.
            </div>
          )}

          {(big.data?.raffles ?? []).map((r) => (
            <div key={r.id} className="w-full flex justify-center">
              <RaffleCard raffle={r} onOpen={onOpenRaffle} onOpenSafety={onOpenSafety} />
            </div>
          ))}
        </div>
      </div>

      {/* SECTION: Ending soon */}
      <div className="w-fit mx-auto bg-white/10 backdrop-blur-sm rounded-3xl p-6 mb-10 border border-white/30 shadow-lg relative overflow-visible">
        <div className="flex items-center gap-3 mb-2 pl-1">
          <div className="p-2 rounded-xl bg-red-400 text-white shadow-md rotate-[-6deg]">
            <span className="text-lg">🧭</span>
          </div>
          <h2 className="text-2xl font-black text-gray-800/90 tracking-tight uppercase drop-shadow-sm">
            Ending soon
          </h2>
        </div>

        <p className="text-gray-600 font-bold text-xs md:text-sm leading-relaxed max-w-2xl pl-1">
          Last chance to join.
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 justify-items-center">
          {soon.isLoading && <div className="text-white font-bold opacity-80 py-10">Loading…</div>}

          {soon.error && (
            <div className="text-white font-bold opacity-90 py-10">
              Loading directly from the network… This may take a moment.
            </div>
          )}

          {(soon.data?.raffles ?? []).map((r) => (
            <div key={r.id} className="w-full flex justify-center">
              <RaffleCard raffle={r} onOpen={onOpenRaffle} onOpenSafety={onOpenSafety} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}