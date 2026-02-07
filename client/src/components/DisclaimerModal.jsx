import { useEffect, useState, useRef } from "react";

export default function DisclaimerModal({ onAccept }) {
  const [isOpen, setIsOpen] = useState(false);
  const [canAccept, setCanAccept] = useState(false);
  const [isChecked, setIsChecked] = useState(false); // Checkbox durumu
  const contentRef = useRef(null); // Scroll takibi için referans

  useEffect(() => {
    // Versiyonu v5 yaptık (Yeni metin için)
    const hasAccepted = localStorage.getItem("kenvoy_consent_v5");
    if (!hasAccepted) {
      setIsOpen(true);
    } else {
      if (onAccept) onAccept();
    }
  }, [onAccept]);

  // Scroll olayını dinle
  const handleScroll = () => {
    if (contentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      // Kullanıcı en aşağıya %95 oranında indi mi?
      if (scrollTop + clientHeight >= scrollHeight * 0.95) {
        setCanAccept(true);
      }
    }
  };

  const handleAccept = () => {
    if (canAccept && isChecked) {
      localStorage.setItem("kenvoy_consent_v5", "true");
      setIsOpen(false);
      if (onAccept) onAccept();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 transition-all duration-300">
      <div className="bg-[#0f172a] border border-red-900/50 p-6 md:p-8 rounded-2xl max-w-3xl w-full shadow-2xl shadow-red-900/20 relative flex flex-col max-h-[90vh]">
        
        {/* Başlık Alanı */}
        <div className="flex items-start gap-4 mb-6 border-b border-slate-800 pb-4 shrink-0">
          <div className="p-3 bg-red-900/20 rounded-full shrink-0">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight leading-tight">
              KULLANIM KOŞULLARI, SORUMLULUK REDDİ VE GİZLİLİK TAAHHÜTNAMESİ
            </h2>
            <p className="text-red-400 text-sm mt-1 font-medium">
              Devam etmeden önce lütfen aşağıya kadar okuyunuz.
            </p>
          </div>
        </div>

        {/* Metin Alanı (Scroll) */}
        <div 
          ref={contentRef}
          onScroll={handleScroll}
          className="bg-[#1e293b]/50 p-5 rounded-xl border border-slate-700/50 text-slate-300 text-sm space-y-6 mb-6 overflow-y-auto leading-relaxed custom-scrollbar flex-grow shadow-inner"
        >
          
          <p className="font-semibold text-white bg-red-900/20 p-3 rounded border border-red-900/30">
            ⚠️ Lütfen Dikkat: Kenvoy AI ("Platform") hizmetlerine erişerek veya dosya yükleyerek, aşağıda yer alan tüm şartları okuduğunuzu, anladığınızı ve gayrikabili rücu (geri dönülemez) bir şekilde kabul ettiğinizi beyan edersiniz.
          </p>

          <div className="space-y-2">
            <h3 className="text-cyan-400 font-bold uppercase text-xs tracking-wider border-b border-slate-700 pb-1">1. HİZMETİN "OLDUĞU GİBİ" SUNULMASI VE GARANTİ FERAGATİ</h3>
            <p>
              Bu Platform, Google Gemini ve Groq ("Sağlayıcılar") API altyapılarını kullanan deneysel bir yapay zeka arayüzüdür. Hizmet, <strong>"OLDUĞU GİBİ" (AS-IS) ve "MEVCUT OLDUĞU ŞEKİLDE"</strong> sunulmaktadır.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li><strong>Doğruluk Garantisi Yoktur:</strong> Üretilen analizler, özetler ve dökümler yapay zeka tarafından oluşturulur ve "halüsinasyon" (gerçek dışı bilgi üretme) riski taşır. Çıktıların akademik, ticari veya hukuki kullanımından doğacak sonuçlarda kesinlikle doğruluk taahhüt edilmez.</li>
              <li><strong>Kesintisiz Hizmet Garantisi Yoktur:</strong> Geliştirici, hizmeti herhangi bir bildirimde bulunmaksızın durdurma, kısıtlama veya tamamen kaldırma hakkını saklı tutar.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-cyan-400 font-bold uppercase text-xs tracking-wider border-b border-slate-700 pb-1">2. VERİ GİZLİLİĞİ, ÜÇÜNCÜ TARAF İŞLEME VE RİSK KABULÜ</h3>
            <p>
              Platformumuzda işlenen veriler sunucularımızda <strong>BARINDIRILMAZ</strong> ve işlem anlık olarak gerçekleştirilip silinir. ANCAK:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
               <li><strong>Üçüncü Taraf İşleme:</strong> Analiz için verileriniz Google ve Groq sunucularına iletilir.</li>
               <li className="text-red-300 font-semibold bg-red-900/10 p-1 rounded">
                 ⚠️ KRİTİK UYARI (Eğitim Verisi): Ücretsiz API altyapısı kullanılması nedeniyle, yüklediğiniz verilerin (ses, metin vb.) Google veya diğer sağlayıcılar tarafından yapay zeka modellerinin eğitilmesi, iyileştirilmesi ve kalite kontrolü amacıyla kaydedilebileceğini, saklanabileceğini ve insanlar tarafından incelenebileceğini kabul edersiniz.
               </li>
               <li><strong>Hassas Veri Yasağı:</strong> Gizli, ticari sır içeren, devlet sırrı niteliğindeki veya KVKK/GDPR kapsamında "Özel Nitelikli Kişisel Veri" içeren dosyaların yüklenmesi yasaktır. Bu yasağa uymamanız durumunda doğacak veri sızıntılarından Platform geliştiricisi sorumlu tutulamaz.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-cyan-400 font-bold uppercase text-xs tracking-wider border-b border-slate-700 pb-1">3. KULLANICI SORUMLULUĞU VE FİKRİ MÜLKİYET</h3>
            <p>Sisteme yüklediğiniz her türlü dosyanın içeriğinden münhasıran siz sorumlusunuz.</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
                <li><strong>Telif Hakkı ve İzinler:</strong> Yüklediğiniz ses kayıtlarındaki kişilerin açık rızasını aldığınızı (KVKK Aydınlatma Metni uyarınca) ve dosyanın telif haklarını ihlal etmediğinizi beyan edersiniz.</li>
                <li><strong>Yasadışı İçerik:</strong> Suç teşkil eden, tehditkar, müstehcen veya yasa dışı içeriklerin analizi için sistemin kullanılması yasaktır.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-cyan-400 font-bold uppercase text-xs tracking-wider border-b border-slate-700 pb-1">4. SORUMLULUK SINIRLANDIRILMASI VE TAZMİNAT (RÜCU)</h3>
            <p>
              Kenvoy AI geliştiricisi ve iştirakleri; hizmetin kullanımından, kullanılamamasından, yapay zeka hatalarından kaynaklı akademik başarısızlık, ticari kayıp veya itibar kaybından, veri kaybı veya üçüncü taraf API sağlayıcılarından kaynaklanan güvenlik ihlallerinden <strong>DOĞRUDAN, DOLAYLI, ARIZİ VEYA CEZAİ HİÇBİR ZARARDAN SORUMLU TUTULAMAZ.</strong>
            </p>
            <p className="text-slate-400 italic mt-2">
              Kullanıcı, bu şartların ihlali, yüklediği içerik nedeniyle üçüncü şahısların haklarının ihlali veya yasal mevzuata aykırı kullanımı sonucunda Platform geliştiricisine yöneltilecek her türlü dava, talep ve tazminat yükümlülüğünü (avukatlık ücretleri dahil) üstlenmeyi ve geliştiriciyi bu durumlardan beri kılmayı (tazmin etmeyi) kabul eder.
            </p>
          </div>
          
           <div className="space-y-2">
            <h3 className="text-cyan-400 font-bold uppercase text-xs tracking-wider border-b border-slate-700 pb-1">5. TAVSİYE NİTELİĞİ TAŞIMAMASI</h3>
            <p>
              Bu platformun çıktıları; hukuki, tıbbi, finansal veya profesyonel tavsiye niteliği taşımaz. Profesyonel kararlar almadan önce mutlaka yetkili bir uzmana danışılmalıdır.
            </p>
          </div>

        </div>
        
        {/* Onay Alanı (Checkbox ve Buton) */}
        <div className="space-y-4 shrink-0 bg-[#0f172a] pt-2">
            
            {/* Checkbox */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer select-none ${canAccept ? 'border-slate-700 hover:bg-slate-800/50' : 'border-slate-800 opacity-50 cursor-not-allowed'}`}>
                <div className="relative flex items-center mt-1">
                    <input 
                        type="checkbox" 
                        disabled={!canAccept}
                        checked={isChecked}
                        onChange={(e) => setIsChecked(e.target.checked)}
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-600 bg-slate-900 transition-all checked:border-red-500 checked:bg-red-600 hover:border-red-400"
                    />
                    <svg className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 14 14" fill="none">
                        <path d="M3 8L6 11L11 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
                <span className="text-sm text-slate-300">
                    Yukarıdaki metni okudum, anladım. Ses kaydındaki kişilerin rızasının alındığını ve doğacak tüm hukuki sorumluluğu üstlendiğimi taahhüt ediyorum.
                </span>
            </label>

            <button
            onClick={handleAccept}
            disabled={!canAccept || !isChecked}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 transform shadow-lg flex items-center justify-center gap-2 ${
                (canAccept && isChecked)
                ? 'bg-gradient-to-r from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 text-white shadow-red-900/40 hover:scale-[1.01] cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed grayscale'
            }`}
            >
            {(canAccept && isChecked) ? (
                <>
                <span>Hizmeti Başlat</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </>
            ) : (
                !canAccept ? 'Lütfen Metni Aşağıya Kadar Okuyunuz...' : 'Lütfen Yukarıdaki Kutucuğu Onaylayınız'
            )}
            </button>
        </div>
        
        <p className="text-[10px] text-center text-slate-600 mt-3 font-mono">
           IP Adresiniz ve Onay Zamanınız güvenlik amacıyla kaydedilmektedir. (v5.0)
        </p>

      </div>
    </div>
  );
}