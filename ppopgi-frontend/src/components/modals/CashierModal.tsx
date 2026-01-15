import { Coins, Store, X, Zap } from "lucide-react";

export function CashierModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
        <div className="bg-[#FFD700] p-5 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-amber-900 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>

          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-md">
            <Store size={32} className="text-amber-500" />
          </div>

          <h2 className="text-xl font-black text-amber-900 uppercase tracking-tight">
            Coin Cashier 🏪
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-center text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-200">
            <p className="font-bold text-gray-800 mb-1">How Energy (XTZ) works:</p>
            <p>
              Energy is used to power the park. If Energy can't be returned instantly
              after a game,{" "}
              <span className="font-bold text-amber-600">
                it’s always saved for you to Collect later
              </span>{" "}
              in your Dashboard.
            </p>
          </div>

          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
            <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
              <Coins size={24} />
            </div>
            <div>
              <h4 className="font-bold text-amber-900 text-sm">Entry Coins (USDC)</h4>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
            <div className="bg-green-100 p-2 rounded-lg text-green-600">
              <Zap size={24} />
            </div>
            <div>
              <h4 className="font-bold text-green-900 text-sm">Energy Coins (XTZ)</h4>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}