import { X } from "lucide-react";

export function PageModal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center animate-fade-in">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full h-full overflow-y-auto overflow-x-hidden pt-4 pb-20">
        <button
          onClick={onClose}
          className="fixed top-6 right-6 z-[70] bg-white text-gray-800 p-3 rounded-full shadow-lg hover:bg-gray-100 hover:scale-110 transition-all border border-gray-200"
          aria-label="Close"
        >
          <X size={24} strokeWidth={3} />
        </button>
        {children}
      </div>
    </div>
  );
}