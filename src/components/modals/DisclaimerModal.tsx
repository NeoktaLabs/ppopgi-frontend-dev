import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export function DisclaimerModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem('ppopgi_disclaimer_accepted')) {
      setIsOpen(true);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md"></div>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-fade-in-up border border-gray-200">
        <div className="flex justify-center mb-4 bg-amber-100 w-20 h-20 rounded-full items-center mx-auto"><AlertTriangle size={40} className="text-amber-500" /></div>
        <h2 className="text-2xl font-black text-center mb-2 text-gray-800 uppercase">Welcome to Ppopgi</h2>
        <p className="text-center text-gray-500 text-sm mb-6 leading-relaxed">By entering, you confirm you are 18+ years of age and accept the risks associated with blockchain gaming.</p>
        <button onClick={() => { sessionStorage.setItem('ppopgi_disclaimer_accepted', 'true'); setIsOpen(false); }} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-amber-200">Enter Park</button>
      </div>
    </div>
  );
}
