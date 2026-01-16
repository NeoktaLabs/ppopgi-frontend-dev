// src/features/navbar/Navbar.tsx
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Compass, LayoutDashboard, LogOut, Shield, Store, Ticket, Wallet } from "lucide-react";
import { useAccount, useDisconnect } from "wagmi";
import { WalletPill } from "../wallet/WalletPill";

export function Navbar({
  onOpenCashier,
  onOpenCreate,
  onOpenDashboard,
  onOpenSafety,
  onGoHome,
  onGoExplore,
}: {
  onOpenCashier: () => void;
  onOpenCreate: () => void;
  onOpenDashboard: () => void;
  onOpenSafety: () => void;
  onGoHome: () => void;
  onGoExplore: () => void;
}) {
  const { disconnect } = useDisconnect();

  // ✅ FIX: wagmi state updates instantly without refresh
  const { address, isConnected } = useAccount();

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pt-4 px-4">
      <nav className="mx-auto max-w-6xl bg-white/85 backdrop-blur-md border border-white/60 rounded-3xl shadow-sm h-16 flex items-center justify-between px-4 md:px-6">
        <ConnectButton.Custom>
          {({ openConnectModal, mounted }) => {
            // ✅ FIX: rely on wagmi connection state, not rainbowkit render state
            const connected = mounted && isConnected && !!address;

            return (
              <>
                {/* Left */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={onGoHome}
                    className="flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
                    title="Home"
                    type="button"
                  >
                    <div className="w-9 h-9 bg-[#FFD700] rounded-full flex items-center justify-center shadow-inner border-2 border-white">
                      <Ticket size={18} className="text-amber-700" />
                    </div>
                    <span className="font-black text-lg text-amber-800 tracking-tight hidden sm:block">
                      Ppopgi
                    </span>
                  </button>

                  <div className="hidden md:flex items-center gap-2">
                    <button
                      onClick={onGoExplore}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      type="button"
                    >
                      <Compass size={16} /> Explore
                    </button>

                    <button
                      onClick={() => (connected ? onOpenCreate() : openConnectModal())}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm text-gray-600 hover:text-amber-700 hover:bg-amber-100 transition-colors"
                      type="button"
                    >
                      <Ticket size={16} /> Create
                    </button>
                  </div>
                </div>

                {/* Right */}
                <div className="flex items-center gap-3">
                  <div className="hidden lg:block">
                    <WalletPill />
                  </div>

                  {/* Safety / Proof (global) */}
                  <button
                    onClick={onOpenSafety}
                    className="bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-100 px-3 py-2 rounded-xl font-bold shadow-sm flex items-center gap-2 text-sm transition-colors"
                    title="Safety & Proof"
                    type="button"
                  >
                    <Shield size={18} />
                    <span className="hidden md:inline">Safety</span>
                  </button>

                  <button
                    onClick={onOpenCashier}
                    className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-xl font-bold shadow-sm active:shadow-none active:translate-y-1 transition-all flex items-center gap-2 text-sm"
                    title="Cashier"
                    type="button"
                  >
                    <Store size={18} />
                    <span className="hidden md:inline">Cashier</span>
                  </button>

                  {connected ? (
                    <>
                      <button
                        onClick={onOpenDashboard}
                        className="bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-100 px-3 py-2 rounded-xl font-bold shadow-sm flex items-center gap-2 text-sm transition-colors"
                        title="Open Dashboard"
                        type="button"
                      >
                        <LayoutDashboard size={16} />
                        {address ? `Player ...${address.slice(-4)}` : "Player"}
                      </button>

                      <button
                        onClick={() => disconnect()}
                        className="bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500 p-2.5 rounded-xl transition-colors border border-transparent hover:border-red-100"
                        title="Disconnect Wallet"
                        type="button"
                      >
                        <LogOut size={18} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={openConnectModal}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold shadow-[0_4px_0_0_#1e3a8a] active:shadow-none active:translate-y-1 transition-all flex items-center gap-2 text-sm"
                      type="button"
                    >
                      <Wallet size={18} />
                      <span className="hidden sm:inline">Join the Park</span>
                      <span className="sm:hidden">Join</span>
                    </button>
                  )}
                </div>
              </>
            );
          }}
        </ConnectButton.Custom>
      </nav>
    </div>
  );
}