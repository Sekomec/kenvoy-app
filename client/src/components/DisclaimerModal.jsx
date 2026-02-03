import { useEffect, useState } from "react";

export default function DisclaimerModal({ onAccept }) {
  const [isOpen, setIsOpen] = useState(false);
  const [canAccept, setCanAccept] = useState(false);

  useEffect(() => {
    // Versiyonu v4 yaptık ki eski onayı olanlar da bu yeni metni görüp onaylamak zorunda kalsın.
    const hasAccepted = localStorage.getItem("kenvoy_consent_v4");
    if (!hasAccepted) {
      setIsOpen(true);
      // Okuma süresini 3 saniyeye çıkardık, ciddiyet artsın.
      setTimeout(() => setCanAccept(true), 3000);
    } else {
      if (onAccept) onAccept();
    }
  }, [onAccept]);

  const handleAccept = () => {
    localStorage.setItem("kenvoy_consent_v4", "true");
    setIsOpen(false);
    if (onAccept) onAccept();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="bg-[#0f172a] border border-red-900/30 p-8 rounded-2xl max-w-2xl w-full shadow-2xl relative">
        
        {/* Başlık Alanı */}
        <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Yasal Sorumluluk Reddi ve Hizmet Şartları
          </h2>
        </div>

        {/* Metin Alanı (Scroll) */}
        <div className="bg-[#1e293b]/50 p-4 rounded-xl border border-slate-700/50 text-slate-300 text-sm space-y-4 mb-8 max-h-[60vh] overflow-y-auto leading-relaxed custom-scrollbar">
          
          <p className="font-semibold text-white">
            Lütfen Kenvoy AI ("Platform") hizmetini kullanmadan önce aşağıdaki hükümleri dikkatlice okuyunuz. Bu sisteme dosya yükleyerek bu şartları kayıtsız şartsız kabul etmiş sayılırsınız.
          </p>

          <div className="space-y-2">
            <h3 className="text-cyan-400 font-bold uppercase text-xs tracking-wider">1. Hizmetin Niteliği ve Yapay Zeka Hata Payı</h3>
            <p>
              Bu Platform, Google Gemini ve Groq ("Sağlayıcılar") altyapılarını kullanan deneysel bir yapay zeka arayüzüdür. Üretilen analizler, özetler ve metin dökümleri yapay zeka tarafından oluşturulur ve <strong>kesin doğruluk taahhüt etmez.</strong> Yapay zeka "halüsinasyon" (gerçek dışı bilgi uydurma) görebilir. Çıktıların doğruluğunu teyit etmek tamamen kullanıcının sorumluluğundadır.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-cyan-400 font-bold uppercase text-xs tracking-wider">2. Veri İşleme ve Üçüncü Taraf Politikaları</h3>
            <p>
              Platformumuzda işlenen veriler sunucularımızda barınmaz ve işlem bitiminde <strong>tarafımızca kalıcı olarak silinir.</strong> Ancak, analiz işlemi için verileriniz Google ve Groq sunucularına iletilir. 
              <span className="text-red-400 font-semibold block mt-1">
                 ÖNEMLİ: Ücretsiz API kullanımı nedeniyle, yüklediğiniz veriler Google tarafından yapay zeka modellerinin iyileştirilmesi ve eğitilmesi amacıyla işlenebilir, saklanabilir veya incelenebilir.
              </span>
               Gizli, ticari sır içeren veya KVKK/GDPR kapsamında hassas veri niteliğindeki dosyaları yüklememeniz şiddetle tavsiye edilir. Bu tür dosyaların yüklenmesinden doğacak her türlü veri ihlali riskini kullanıcı üstlenir.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-cyan-400 font-bold uppercase text-xs tracking-wider">3. Sorumluluk Reddi (Disclaimer)</h3>
            <p>
              Kenvoy AI geliştiricileri, bu hizmetin kullanımından, kullanılamamasından, üretilen hatalı içerikten veya veri kaybından doğabilecek <strong>doğrudan veya dolaylı hiçbir zarardan (ticari kayıp, veri kaybı, itibar kaybı vb.) sorumlu tutulamaz.</strong> Hizmet "olduğu gibi" (AS-IS) sunulmaktadır ve kesintisiz çalışacağı garanti edilmez.
            </p>
          </div>

        </div>
        
        {/* Buton Alanı */}
        <button
          onClick={handleAccept}
          disabled={!canAccept}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 transform ${
            canAccept
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/40 hover:scale-[1.01]'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed grayscale'
          }`}
        >
          {canAccept ? 'Yukarıdaki Riskleri Anladım ve Kabul Ediyorum' : `Lütfen Okuyunuz...`}
        </button>
        
        <p className="text-xs text-center text-slate-600 mt-4">
          Bu onay işlemini gerçekleştirerek Kenvoy AI geliştiricisini tüm hukuki yükümlülüklerden beri kılmış olursunuz.
        </p>

      </div>
    </div>
  );
}