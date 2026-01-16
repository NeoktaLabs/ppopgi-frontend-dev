// src/features/navbar/Navbar.tsx
import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  Compass,
  LayoutDashboard,
  LogOut,
  Shield,
  Store,
  Ticket,
  Wallet,
} from "lucide-react";
import {
  useAccount,
  useChainId,
  useDisconnect,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { etherlink } from "viem/chains";
import { WalletPill } from "../wallet/WalletPill";

const TARGET_CHAIN_ID = etherlink.id;

function short4(addr?: string) {
  if (!addr) return "";
  return addr.slice(-4);
}

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
  const { address, isConnected } = useAccount();

  const chainId = useChainId();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  // only show wrong network once we’re actually connected
  const wrongNetwork = isConnected && chainId !== TARGET_CHAIN_ID;

  const [switchErr, setSwitchErr] = useState<string | null>(null);

  const etherlinkAddParams = useMemo(() => {
    // Build EIP-3085 params from viem chain object
    const rpc =
      etherlink.rpcUrls?.default?.http?.[0] ||
      etherlink.rpcUrls?.public?.http?.[0] ||
      "";
    const explorer = etherlink.blockExplorers?.default?.url;

    return {
      chainId: `0x${TARGET_CHAIN_ID.toString(16)}`, // 42793 => 0xa729
      chainName: etherlink.name,
      nativeCurrency: etherlink.nativeCurrency,
      rpcUrls: rpc ? [rpc] : [],
      blockExplorerUrls: explorer ? [explorer] : [],
    };
  }, []);

  async function ensureEtherlink() {
    setSwitchErr(null);

    // Try normal switch first
    try {
      await switchChainAsync({ chainId: TARGET_CHAIN_ID });
      return;
    } catch (e: any) {
      // If chain is not added in wallet => 4902 (or message contains 4902)
      const msg = String(e?.message || e);
      const code = e?.code;

      const isNotAdded =
        code === 4902 ||
        msg.includes("4902") ||
        msg.toLowerCase().includes("unrecognized chain") ||
        msg.toLowerCase().includes("addethereumchain");

      if (!isNotAdded) {
        setSwitchErr("Could not switch network. Open MetaMask and switch to Etherlink.");
        return;
      }
    }

    // Try add chain (EIP-3085) then switch again
    try {
      if (!walletClient) {
        setSwitchErr("Wallet client unavailable. Re-open MetaMask and try again.");
        return;
      }

      await walletClient.request({
        method: "wallet_addEthereumChain",
        params: [etherlinkAddParams as any],
      });

      await switchChainAsync({ chainId: TARGET_CHAIN_ID });
    } catch (e: any) {
      setSwitchErr("Please add/switch to Etherlink in MetaMask, then try again.");
    }
  }

  // Optional: once connected, if wrong network, auto-trigger switch prompt once
  const [autoTried, setAutoTried] = useState(false);
  useEffect(() => {
    if (!isConnected) {
      setAutoTried(false);
      return;
    }
    if (!wrongNetwork) return;
    if (autoTried) return;

    setAutoTried(true);
    // fire-and-forget; user may reject
    ensureEtherlink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, wrongNetwork]);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pt-4 px-4">
      <nav className="mx-auto max-w-6xl bg-white/85 backdrop-blur-md border border-white/60 rounded-3xl shadow-sm h-16 flex items-center justify-between px-4 md:px-6">
        <ConnectButton.Custom>
          {({ openConnectModal, mounted }) => {
            const ready = mounted;
            const connected = ready && isConnected && !!address;

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
                      {wrongNetwork ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={ensureEtherlink}
                            disabled={switching}
                            className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200 px-3 py-2 rounded-xl font-black shadow-sm text-sm"
                            title="Switch to Etherlink"
                            type="button"
                          >
                            {switching ? "Switching…" : "Wrong network"}
                          </button>
                        </div>
                      ) : null}

                      <button
                        onClick={onOpenDashboard}
                        className="bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-100 px-3 py-2 rounded-xl font-bold shadow-sm flex items-center gap-2 text-sm transition-colors"
                        title="Open Dashboard"
                        type="button"
                      >
                        <LayoutDashboard size={16} />
                        {address ? `Player ...${short4(address)}` : "Player"}
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

                {/* Tiny inline error (only when connected + wrong network) */}
                {connected && wrongNetwork && switchErr ? (
                  <div className="fixed top-[88px] left-0 right-0 px-4 z-50">
                    <div className="mx-auto max-w-6xl rounded-2xl bg-white/90 border border-white/60 backdrop-blur-md shadow-sm px-4 py-3 text-xs font-black text-amber-900">
                      {switchErr}
                      <span className="ml-2 opacity-70">
                        (Wallet chainId: {chainId})
                      </span>
                    </div>
                  </div>
                ) : null}
              </>
            );
          }}
        </ConnectButton.Custom>
      </nav>
    </div>
  );
}