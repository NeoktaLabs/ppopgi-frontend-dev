import { useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { formatUnits } from 'viem';
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  Gavel,
  Loader2,
  Search,
  ShieldCheck,
  Ticket,
  Trophy,
  Undo2,
} from 'lucide-react';

import { ENTROPY_ABI, ERC20_ABI, LOTTERY_ABI, REGISTRY_ABI } from '../contracts/abis';
import { CONTRACT_ADDRESSES, OFFICIAL_DEPLOYER_ADDRESS } from '../config/contracts';
import { addToHistory } from '../utils/history';
import { TransparencyModal } from '../components/modals/TransparencyModal';

const MAX_BATCH_BUY_UI = 1000; // matches contract MAX_BATCH_BUY

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function RaffleDetails({ onBack, raffleAddress }: { onBack: () => void; raffleAddress?: string }) {
  const { address } = useAccount();
  const [ticketCount, setTicketCount] = useState(1);
  const [showDetails, setShowDetails] = useState(false);

  const isValidAddress = raffleAddress?.startsWith('0x');

  const config = { address: raffleAddress as `0x${string}`, abi: LOTTERY_ABI, query: { enabled: isValidAddress } };

  // Core raffle reads
  const { data: statusBig } = useReadContract({ ...config, functionName: 'status' });
  const status = statusBig !== undefined ? Number(statusBig) : undefined;

  const { data: ticketPrice } = useReadContract({ ...config, functionName: 'ticketPrice' });
  const { data: winningPot } = useReadContract({ ...config, functionName: 'winningPot' });
  const { data: sold } = useReadContract({ ...config, functionName: 'getSold' });
  const { data: deadline } = useReadContract({ ...config, functionName: 'deadline' });
  const { data: raffleName } = useReadContract({ ...config, functionName: 'name' });
  const { data: maxTickets } = useReadContract({ ...config, functionName: 'maxTickets' });
  const { data: minTickets } = useReadContract({ ...config, functionName: 'minTickets' });
  const { data: minPurchaseAmount } = useReadContract({ ...config, functionName: 'minPurchaseAmount' });
  const { data: creator } = useReadContract({ ...config, functionName: 'creator' });
  const { data: deployer } = useReadContract({ ...config, functionName: 'deployer' });
  const { data: entropyProvider } = useReadContract({ ...config, functionName: 'entropyProvider' });
  const { data: entropyContract } = useReadContract({ ...config, functionName: 'entropy' });

  // Transparency / verification signals
  const { data: feeRecipient } = useReadContract({ ...config, functionName: 'feeRecipient' });
  const { data: feePercent } = useReadContract({ ...config, functionName: 'protocolFeePercent' });

  const { data: typeId } = useReadContract({
    address: CONTRACT_ADDRESSES.registry,
    abi: REGISTRY_ABI,
    functionName: 'typeIdOf',
    args: raffleAddress ? [raffleAddress as `0x${string}`] : undefined,
    query: { enabled: isValidAddress && CONTRACT_ADDRESSES.registry?.startsWith('0x') },
  });

  const isVerified =
    !!deployer &&
    (deployer as string).toLowerCase() === OFFICIAL_DEPLOYER_ADDRESS.toLowerCase() &&
    Number(typeId) === 1;

  // Player reads
  const { data: myTickets } = useReadContract({
    ...config,
    functionName: 'ticketsOwned',
    args: address ? [address] : undefined,
  });
  const { data: claimableFunds } = useReadContract({
    ...config,
    functionName: 'claimableFunds',
    args: address ? [address] : undefined,
  });
  const { data: claimableNative } = useReadContract({
    ...config,
    functionName: 'claimableNative',
    args: address ? [address] : undefined,
  });

  // Draw fee (XTZ) comes from entropy contract
  const { data: drawFee } = useReadContract({
    address: entropyContract as `0x${string}`,
    abi: ENTROPY_ABI,
    functionName: 'getFee',
    args: entropyProvider ? [entropyProvider] : undefined,
    query: { enabled: !!entropyProvider && !!entropyContract },
  });

  // Allowance for buying tickets
  const totalCost = ticketPrice ? ticketPrice * BigInt(ticketCount) : 0n;
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && raffleAddress ? [address, raffleAddress as `0x${string}`] : undefined,
  });

  const now = Math.floor(Date.now() / 1000);
  const isExpired = deadline ? now >= Number(deadline) : false;

  const soldN = sold ? Number(sold) : 0;
  const maxTicketsN = maxTickets ? Number(maxTickets) : 0;
  const hasHardCap = maxTicketsN > 0;
  const remainingTickets = hasHardCap ? Math.max(0, maxTicketsN - soldN) : Number.POSITIVE_INFINITY;
  const isSoldOut = hasHardCap ? soldN >= maxTicketsN : false;

  const minBuy = minPurchaseAmount && Number(minPurchaseAmount) > 0 ? Number(minPurchaseAmount) : 1;
  const maxBuy = remainingTickets === Number.POSITIVE_INFINITY ? MAX_BATCH_BUY_UI : Math.min(MAX_BATCH_BUY_UI, remainingTickets);
  const canEverBuy = maxBuy >= 1;
  const notEnoughForMin = Number.isFinite(maxBuy) ? maxBuy < minBuy : false;

  // Keep ticket count within contract limits as data loads / changes
  useEffect(() => {
    if (!canEverBuy) {
      setTicketCount(1);
      return;
    }
    const effectiveMin = Math.max(1, minBuy);
    const effectiveMax = Number.isFinite(maxBuy) ? Math.max(1, maxBuy) : MAX_BATCH_BUY_UI;
    setTicketCount((prev) => clamp(prev, effectiveMin, effectiveMax));
  }, [minBuy, maxBuy, canEverBuy]);

  const isOpen = status === 1;
  const isCreator = !!creator && !!address && (creator as string).toLowerCase() === address.toLowerCase();

  const buyDisabledReason = useMemo(() => {
    if (!address) return 'Connect your wallet to play.';
    if (!isOpen) return 'This raffle is not open.';
    if (isExpired) return 'This raffle has ended.';
    if (isSoldOut) return 'This raffle is sold out.';
    if (isCreator) return "The creator can't buy tickets.";
    if (!canEverBuy) return 'Tickets are not available.';
    if (notEnoughForMin) return `Not enough tickets left for the minimum purchase (${minBuy}).`;
    if (ticketCount < minBuy) return `Minimum purchase is ${minBuy} ticket${minBuy === 1 ? '' : 's'}.`;
    if (Number.isFinite(maxBuy) && ticketCount > maxBuy) return `Maximum you can buy right now is ${maxBuy}.`;
    if (ticketCount > MAX_BATCH_BUY_UI) return `Max per purchase is ${MAX_BATCH_BUY_UI}.`;
    return null;
  }, [address, isOpen, isExpired, isSoldOut, isCreator, canEverBuy, notEnoughForMin, minBuy, ticketCount, maxBuy]);

  const buyAllowed = buyDisabledReason === null;
  const needsApproval = allowance ? allowance < totalCost : true;

  // Draw eligibility
  const canDraw = isOpen && (isExpired || isSoldOut);
  const drawNote = useMemo(() => {
    const minTicketsN = minTickets ? Number(minTickets) : 0;
    if (!canDraw) return null;
    if (minTicketsN > 0 && soldN < minTicketsN) return 'Not enough tickets sold — drawing will cancel and refund.';
    return 'Anyone can trigger the draw. The fee goes to the randomness provider.';
  }, [canDraw, minTickets, soldN]);

  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      refetchAllowance();
      if (raffleAddress) addToHistory(raffleAddress);
    }
  }, [isSuccess, raffleAddress, refetchAllowance]);

  const handleBuy = () =>
    writeContract({
      address: raffleAddress as `0x${string}`,
      abi: LOTTERY_ABI,
      functionName: 'buyTickets',
      args: [BigInt(ticketCount)],
    });

  const handleDraw = () =>
    writeContract({
      address: raffleAddress as `0x${string}`,
      abi: LOTTERY_ABI,
      functionName: 'finalize',
      value: drawFee || 0n,
    });

  const handleWithdrawFunds = () =>
    writeContract({
      address: raffleAddress as `0x${string}`,
      abi: LOTTERY_ABI,
      functionName: 'withdrawFunds',
    });

  const handleWithdrawNative = () =>
    writeContract({
      address: raffleAddress as `0x${string}`,
      abi: LOTTERY_ABI,
      functionName: 'withdrawNative',
    });

  const handleRefund = () =>
    writeContract({
      address: raffleAddress as `0x${string}`,
      abi: LOTTERY_ABI,
      functionName: 'claimTicketRefund',
    });

  const handleApprove = () =>
    writeContract({
      address: CONTRACT_ADDRESSES.usdc,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [raffleAddress as `0x${string}`, totalCost],
    });

  // Claim flags (use bigint compares, not Number())
  const hasUSDCClaim = (claimableFunds ?? 0n) > 0n;
  const hasNativeClaim = (claimableNative ?? 0n) > 0n;
  const hasAnyClaim = hasUSDCClaim || hasNativeClaim;
  const hasTickets = (myTickets ?? 0n) > 0n;

  if (!isValidAddress) return <div className="p-10 text-center">Invalid Raffle</div>;

  return (
    <div className="min-h-screen pt-20 pb-20 px-4 animate-fade-in-up">
      <div className="max-w-4xl mx-auto mb-6 flex items-center gap-4">
        <button onClick={onBack} className="bg-white/50 p-2.5 rounded-full">
          <ArrowRight size={20} className="rotate-180" />
        </button>
        <span className="text-white font-bold text-lg">Back to Park</span>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left card */}
        <div className="bg-white rounded-[2.5rem] p-8 text-center border-4 border-dashed border-amber-200">
          <div className="bg-amber-100 p-4 rounded-full text-amber-600 mb-6 shadow-inner mx-auto w-fit">
            <Trophy size={48} />
          </div>

          <div className="flex items-center justify-center gap-2 mb-3">
            {isVerified ? (
              <button
                type="button"
                onClick={() => setShowDetails(true)}
                className="bg-green-100 px-2 py-0.5 rounded text-[10px] font-bold text-green-700 uppercase tracking-wide flex items-center gap-1 border border-green-200 hover:bg-green-200 transition-colors"
                title="Verified = created by the official factory and registered on-chain. Click for details."
              >
                <CheckCircle2 size={10} className="fill-green-600 text-white" /> Verified
              </button>
            ) : (
              <span className="bg-black/5 px-2 py-0.5 rounded text-[10px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Ticket size={10} /> Raffle
              </span>
            )}

            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="w-7 h-7 bg-white text-gray-400 hover:text-blue-500 rounded-full flex items-center justify-center shadow-md border border-gray-100 transition-colors"
              title="View Contract Details"
            >
              <Search size={14} strokeWidth={3} />
            </button>
          </div>

          <h1 className="text-3xl font-black text-gray-800 uppercase mb-2">{raffleName || 'Loading...'}</h1>
          <div className="text-5xl font-black text-amber-500 mb-6">
            {winningPot ? formatUnits(winningPot, 6) : '0'} <span className="text-lg text-gray-400">USDC</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-left">
            <div className="bg-gray-50 p-3 rounded-xl">
              <div className="text-xs font-bold text-gray-400">My Tickets</div>
              <div className="text-lg font-black">{(myTickets ?? 0n).toString()}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl">
              <div className="text-xs font-bold text-gray-400">Status</div>
              <div className={`text-lg font-black ${status === 1 ? 'text-green-500' : 'text-gray-500'}`}>
                {status === 1 ? 'OPEN' : status === 2 ? 'DRAWING' : status === 3 ? 'ENDED' : 'CANCELED'}
              </div>
            </div>
          </div>
        </div>

        {/* Right card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-xl flex flex-col justify-center relative">
          {(isPending || isConfirming) && (
            <div className="absolute inset-0 z-50 bg-white/90 rounded-[2.5rem] flex flex-col items-center justify-center text-center p-6">
              <Loader2 size={40} className="animate-spin text-amber-500 mb-4" />
              <h3 className="text-lg font-bold">Processing Transaction...</h3>
            </div>
          )}

          {/* BUY */}
          {isOpen && !canDraw && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-2xl flex justify-between items-center">
                <span className="font-bold text-gray-500">Tickets</span>
                <div className="flex gap-4 items-center">
                  <button
                    onClick={() => setTicketCount((c) => Math.max(1, c - 1))}
                    disabled={!buyAllowed || ticketCount <= minBuy}
                    className="w-8 h-8 bg-white rounded-full shadow font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                    title={minBuy > 1 ? `Minimum purchase: ${minBuy}` : 'Decrease'}
                  >
                    -
                  </button>
                  <span className="text-xl font-black">{ticketCount}</span>
                  <button
                    onClick={() => setTicketCount((c) => c + 1)}
                    disabled={!buyAllowed || (Number.isFinite(maxBuy) && ticketCount >= maxBuy) || ticketCount >= MAX_BATCH_BUY_UI}
                    className="w-8 h-8 bg-white rounded-full shadow font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                    title={Number.isFinite(maxBuy) ? `Max now: ${maxBuy}` : `Max per purchase: ${MAX_BATCH_BUY_UI}`}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex justify-between px-2 text-sm font-bold text-gray-400">
                <span>Cost</span>
                <span className="text-gray-800 text-xl">
                  {ticketPrice ? formatUnits(ticketPrice * BigInt(ticketCount), 6) : '0'} USDC
                </span>
              </div>

              {/* Guidance to avoid reverts */}
              {buyDisabledReason && (
                <div className="text-sm font-bold text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-3">
                  {buyDisabledReason}
                </div>
              )}

              {needsApproval ? (
                <button
                  onClick={handleApprove}
                  disabled={!buyAllowed}
                  className="w-full bg-blue-500 disabled:bg-gray-300 text-white font-black py-4 rounded-xl shadow-lg flex justify-center gap-2"
                >
                  <ShieldCheck /> APPROVE USDC
                </button>
              ) : (
                <button
                  onClick={handleBuy}
                  disabled={!buyAllowed}
                  className="w-full bg-amber-500 disabled:bg-gray-300 text-white font-black py-4 rounded-xl shadow-lg flex justify-center gap-2"
                >
                  <Ticket /> BUY TICKETS
                </button>
              )}
            </div>
          )}

          {/* DRAW */}
          {canDraw && (
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Raffle Ready to Draw</h3>
              <p className="text-sm text-gray-500 mb-4">Time to pick a winner! Anyone can trigger this.</p>

              <button
                onClick={handleDraw}
                disabled={!drawFee}
                className="w-full bg-purple-500 disabled:bg-gray-300 text-white font-black py-4 rounded-xl shadow-lg flex justify-center gap-2"
              >
                <Gavel /> {drawFee ? 'DRAW WINNER' : 'Loading Fee...'}
              </button>

              <p className="text-xs text-gray-500 mt-3">
                Requires {drawFee ? formatUnits(drawFee, 18) : '...'} XTZ. {drawNote}
              </p>
            </div>
          )}

          {/* CLAIMS */}
          {hasAnyClaim && (
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                <h4 className="font-bold text-green-800 mb-2">You have claims!</h4>
                {hasUSDCClaim && (
                  <div className="text-sm">💰 {formatUnits(claimableFunds ?? 0n, 6)} USDC</div>
                )}
                {hasNativeClaim && (
                  <div className="text-sm">⚡ {formatUnits(claimableNative ?? 0n, 18)} XTZ</div>
                )}
              </div>

              {hasUSDCClaim && (
                <button
                  onClick={handleWithdrawFunds}
                  className="w-full bg-green-500 text-white font-black py-3 rounded-xl shadow-lg"
                >
                  WITHDRAW USDC
                </button>
              )}

              {hasNativeClaim && (
                <button
                  onClick={handleWithdrawNative}
                  className="w-full bg-green-600 text-white font-black py-3 rounded-xl shadow-lg"
                >
                  WITHDRAW XTZ
                </button>
              )}
            </div>
          )}

          {/* REFUND */}
          {status === 4 && hasTickets && !hasAnyClaim && (
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Raffle Canceled</h3>
              <p className="text-sm text-gray-500 mb-6">This raffle was canceled. You can claim a full refund.</p>
              <button
                onClick={handleRefund}
                className="w-full bg-gray-500 text-white font-black py-4 rounded-xl shadow-lg flex justify-center gap-2"
              >
                <Undo2 /> APPLY FOR REFUND
              </button>
            </div>
          )}

          {status === 2 && (
            <div className="text-center py-10">
              <Loader2 size={48} className="animate-spin text-purple-500 mx-auto mb-4" />
              <h3 className="font-bold text-gray-600">Picking Winner...</h3>
            </div>
          )}

          {status === 3 && !hasAnyClaim && (
            <div className="text-center py-10">
              <Banknote size={48} className="text-gray-300 mx-auto mb-4" />
              <h3 className="font-bold text-gray-400">Raffle Ended</h3>
            </div>
          )}
        </div>
      </div>

      <TransparencyModal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        raffleAddress={raffleAddress || '0x...'}
        deployerAddress={(deployer as string) || '0x...'}
        feeRecipient={(feeRecipient as string) || undefined}
        feePercent={feePercent ? Number(feePercent) : undefined}
      />
    </div>
  );
}
