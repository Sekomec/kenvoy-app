import React, { useState, useEffect } from 'react';
import { Play, Unlock } from 'lucide-react';

const AdGate = ({ onComplete, title = "Devam Etmek İçin", buttonText = "Reklamı İzle" }) => {
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (loading && timeLeft === 0) {
      setLoading(false);
      onComplete();
    }
  }, [timeLeft, loading, onComplete]);

  const startAd = () => {
    setLoading(true);
    setTimeLeft(5); // 5 saniyelik simülasyon
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center max-w-md w-full mx-auto my-4 shadow-lg">
      <div className="mb-4 flex justify-center text-[#40E0D0]">
        {loading ? <Unlock className="animate-bounce w-12 h-12" /> : <Play className="w-12 h-12" />}
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400 mb-6 text-sm">Sistemi ücretsiz tutabilmemiz için kısa bir işlem gerekiyor.</p>
      
      <button 
        onClick={startAd}
        disabled={loading}
        className={`w-full py-3 rounded-lg font-bold transition-all ${
          loading 
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
            : 'bg-[#40E0D0] hover:bg-[#3BCcc0] text-slate-900 shadow-[0_0_15px_rgba(64,224,208,0.3)]'
        }`}
      >
        {loading ? `Bekleyin... ${timeLeft}s` : buttonText}
      </button>
    </div>
  );
};

export default AdGate;