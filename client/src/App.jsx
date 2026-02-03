import React, { useState, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { Loader2, Sparkles, FileAudio } from "lucide-react";

// Bileşenlerin doğru yolda olduğundan emin olun
import FileUpload from "./components/FileUpload";
import DisclaimerModal from "./components/DisclaimerModal";
import AdGate from "./components/AdGate"; 

// --- 1. DEĞİŞİKLİK: DİNAMİK URL ---
// Eğer Vercel'de bir ayar varsa onu kullan, yoksa (bilgisayarındaysan) localhost'u kullan.
const API_URL = import.meta.env.VITE_API_URL || "https://kenvoy-server.onrender.com";

function App() {
  const [appState, setAppState] = useState({
    disclaimerAccepted: false, 
    uploadUnlocked: false,
    file: null,
    processUnlocked: false,
    isProcessing: false,
    transcript: "",
    source: "",
    error: ""
  });

  // --- 2. DEĞİŞİKLİK: VERSİYON GÜNCELLEMESİ (v4) ---
  // LocalStorage kontrolü (Daha önce v4'ü onayladı mı?)
  useEffect(() => {
    const hasAccepted = localStorage.getItem("kenvoy_consent_v4"); // v2 yerine v4 yaptık
    if (hasAccepted === "true") {
      setAppState(prev => ({ ...prev, disclaimerAccepted: true }));
    }
  }, []);

  // Modal Onay Fonksiyonu
  const handleAcceptDisclaimer = () => {
    // Modal zaten localStorage'a kaydediyor ama state'i güncellemek için burası şart
    // Güvenlik için buraya da aynı key'i yazıyoruz.
    localStorage.setItem("kenvoy_consent_v4", "true"); 
    setAppState(prev => ({ ...prev, disclaimerAccepted: true }));
  };

  // Reklam 1 Tamamlanınca -> Dosya Yüklemeyi Aç
  const handleAd1Complete = () => {
    setAppState(prev => ({ ...prev, uploadUnlocked: true }));
  };

  // Dosya Seçilince -> Hataları temizle, dosyayı kaydet
  const handleFileSelect = (selectedFile) => {
    setAppState(prev => ({ 
      ...prev, 
      file: selectedFile, 
      processUnlocked: false, 
      error: "", 
      transcript: "" 
    }));
  };

  // Reklam 2 Tamamlanınca -> Analizi Başlat
  const handleAd2Complete = () => {
    setAppState(prev => ({ ...prev, processUnlocked: true }));
    startAnalysis(); 
  };

  // Backend'e İstek Atma
  const startAnalysis = async () => {
    if (!appState.file) return;

    setAppState(prev => ({ ...prev, isProcessing: true, error: "" }));

    const formData = new FormData();
    formData.append("file", appState.file);

    try {
      // --- 3. DEĞİŞİKLİK: URL DEĞİŞİMİ ---
      // Artık 'http://localhost:5000/upload' yerine dinamik 'API_URL' kullanıyoruz.
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 600000, // 10 dakika zaman aşımı (Render uyku modu uyanması için gerekli)
      });

      setAppState(prev => ({
        ...prev,
        isProcessing: false,
        transcript: response.data.transkript,
        source: response.data.source
      }));

    } catch (err) {
      console.error(err);
      // Hata mesajını daha güvenli alalım
      const errorMsg = err.response?.data?.error || "Sunucuyla bağlantı kurulamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.";
      setAppState(prev => ({ ...prev, isProcessing: false, error: errorMsg }));
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-300 font-sans flex flex-col items-center py-10 px-4 relative overflow-x-hidden">
      
      {/* --- GİZLİLİK MODALI --- */}
      {/* Eğer kabul edilmediyse göster */}
      {!appState.disclaimerAccepted && (
        <DisclaimerModal onAccept={handleAcceptDisclaimer} />
      )}

      {/* --- ANA HEADER --- */}
      <header className={`mb-12 text-center z-10 transition-all duration-500 ${!appState.disclaimerAccepted ? 'blur-sm' : ''}`}>
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4 drop-shadow-2xl text-white">
          KEN<span className="text-[#40E0D0]">V</span>OY
        </h1>
        <p className="text-slate-400 text-lg md:text-xl font-light">
          Yapay Zeka Destekli Akademik Ses Analizi
        </p>
      </header>

      {/* --- ANA İÇERİK --- */}
      <main className={`w-full max-w-3xl space-y-8 z-10 transition-all duration-500 ${!appState.disclaimerAccepted ? 'blur-sm pointer-events-none' : ''}`}>
        
        {/* ADIM 1: SİSTEMİ BAŞLAT (REKLAM GEÇİŞİ) */}
        {appState.disclaimerAccepted && !appState.uploadUnlocked && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <AdGate 
              title="Sistemi Aktif Et" 
              buttonText="Analiz Motorunu Başlat (Sponsorlu)"
              onComplete={handleAd1Complete} 
            />
          </div>
        )}

        {/* ADIM 2: DOSYA YÜKLEME */}
        {appState.uploadUnlocked && !appState.transcript && (
          <div className={`transition-all duration-500 ${appState.isProcessing ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
             <FileUpload onFileSelect={handleFileSelect} />
          </div>
        )}

        {/* ADIM 3: ANALİZİ BAŞLAT (DOSYA SEÇİLDİYSE GÖRÜNÜR) */}
        {appState.file && !appState.processUnlocked && !appState.isProcessing && !appState.transcript && (
           <div className="animate-in fade-in zoom-in duration-300">
              <AdGate 
                title="Dosya Hazır" 
                buttonText="Analiz Et ve Dönüştür"
                onComplete={handleAd2Complete} 
              />
           </div>
        )}

        {/* YÜKLENİYOR EKRANI */}
        {appState.isProcessing && (
          <div className="flex flex-col items-center gap-6 p-12 bg-slate-800/50 rounded-2xl border border-slate-700 backdrop-blur-md animate-pulse">
             <div className="relative">
                <Loader2 className="w-16 h-16 text-[#40E0D0] animate-spin" />
                <div className="absolute inset-0 bg-[#40E0D0] blur-xl opacity-20 rounded-full"></div>
             </div>
             <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-white">Yapay Zeka Sesi İşliyor...</h3>
                <p className="text-slate-400">Dosya boyutuna göre işlem 1-3 dakika sürebilir.</p>
                <p className="text-xs text-slate-500">Lütfen sayfayı kapatmayınız.</p>
             </div>
          </div>
        )}

        {/* HATA MESAJI */}
        {appState.error && (
          <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-xl text-red-200 text-center flex flex-col items-center gap-2 animate-in shake">
             <span className="text-2xl">⚠️</span>
             <p>{appState.error}</p>
             <button 
               onClick={() => setAppState(prev => ({...prev, error: ""}))}
               className="text-sm underline hover:text-white"
             >
               Tekrar Dene
             </button>
          </div>
        )}

        {/* SONUÇ EKRANI */}
        {appState.transcript && (
          <div className="bg-slate-900/80 backdrop-blur-md p-8 md:p-10 rounded-2xl border border-slate-700 shadow-2xl ring-1 ring-[#40E0D0]/20 animate-in fade-in slide-in-from-bottom-8 duration-700">
            
            {/* Sonuç Başlığı */}
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800">
              <h2 className="text-2xl text-[#40E0D0] font-bold flex items-center gap-3">
                <Sparkles className="w-6 h-6"/> Analiz Sonucu
              </h2>
              <span className="text-xs font-mono bg-slate-800 px-3 py-1 rounded-full text-slate-400 border border-slate-700">
                Model: {appState.source}
              </span>
            </div>
            
            {/* Markdown İçeriği */}
            <div className="prose prose-invert prose-headings:text-[#40E0D0] prose-a:text-blue-400 max-w-none leading-relaxed">
              <ReactMarkdown>{appState.transcript}</ReactMarkdown>
            </div>
            
            {/* Yeni İşlem Butonu */}
            <button 
              onClick={() => window.location.reload()} 
              className="mt-10 w-full py-4 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-[#40E0D0] hover:to-[#33b2a6] hover:text-slate-900 text-white font-bold rounded-xl transition-all duration-300 shadow-lg"
            >
              Yeni Bir Dosya Yükle
            </button>
          </div>
        )}
      </main>

      <footer className="mt-20 text-slate-600 text-sm z-10 py-6 border-t border-slate-800/50 w-full text-center">
        <p>© 2026 KENVOY AI. Tüm hakları saklıdır.</p>
      </footer>
    </div>
  );
}

export default App;