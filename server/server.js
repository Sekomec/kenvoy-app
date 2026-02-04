require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const Groq = require('groq-sdk');

const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

// --- AKILLI MODEL YÖNETİCİSİ ---
class KeyManager {
    constructor(keysString) {
        // Virgülle ayrılmış anahtarları temizle ve listeye ekle
        this.keys = keysString.split(',').map(k => k.trim()).filter(k => k).map(k => ({
            key: k,
            status: 'ACTIVE', // ACTIVE, COOLDOWN (1dk), DEAD (Günlük kota)
            retryAfter: 0,
            failures: 0
        }));
        
        // --- DEV MODEL KADROSU (LİSTENDEN SEÇİLDİ) ---
        // Sıralama: En Zeki -> En Hızlı -> En Deneysel -> En Eski
        this.models = [
            // 1. Kademe: En Yeni 2.5 Serisi
            "gemini-2.5-pro",
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            
            // 2. Kademe: Gelecek Nesil (Preview 3)
            "gemini-3-pro-preview",
            "gemini-3-flash-preview",

            // 3. Kademe: Sağlam 2.0 Serisi
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-2.0-flash-001",
            "gemini-2.0-flash-lite-001",

            // 4. Kademe: Deneysel ve Genel (Fallback)
            "gemini-exp-1206",
            "gemini-pro-latest",
            "gemini-flash-latest",
            "gemini-flash-lite-latest"
        ];
    }

    // Kullanılabilir bir anahtar bul
    getAvailableKey() {
        const now = Date.now();
        // Cezası bitenleri affet
        this.keys.forEach(k => {
            if (k.status === 'COOLDOWN' && now > k.retryAfter) {
                console.log(`🔄 [SİSTEM] Anahtar cezası bitti, sahaya dönüyor: ...${k.key.slice(-4)}`);
                k.status = 'ACTIVE';
            }
        });

        // Aktif olanları bul
        const activeKeys = this.keys.filter(k => k.status === 'ACTIVE');
        if (activeKeys.length === 0) return null;

        // Rastgele birini seç (Yükü dağıtmak için)
        return activeKeys[Math.floor(Math.random() * activeKeys.length)];
    }

    // Hataya göre ceza kes
    punishKey(keyStr, errorMsg) {
        const keyObj = this.keys.find(k => k.key === keyStr);
        if (!keyObj) return;

        // Kota veya Yetki Hatası
        if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('403')) {
            if (errorMsg.includes('limit: 0') || errorMsg.includes('API key not valid')) {
                // Bu anahtarın bu modelde hiç hakkı yok veya bozuk
                console.log(`💀 [SİSTEM] Anahtar devre dışı (Yetki Yok/Bozuk): ...${keyObj.key.slice(-4)}`);
                keyObj.status = 'DEAD';
            } else {
                // Kota doldu veya hız limiti -> 1 dakika ceza
                console.log(`⏳ [SİSTEM] Anahtar 60sn dinlenmeye alındı: ...${keyObj.key.slice(-4)}`);
                keyObj.status = 'COOLDOWN';
                keyObj.retryAfter = Date.now() + 60000;
            }
        } 
        // Model Bulunamadı Hatası (404)
        else if (errorMsg.includes('404') || errorMsg.includes('not found')) {
             console.log(`⚠️ [MODEL] Bu anahtar bu modeli (${keyObj.key.slice(-4)}) desteklemiyor. Sıradaki modele geçilecek.`);
             // Anahtarı cezalandırma, sadece bu deneme başarısız olsun.
        }
        else {
            console.log(`⚠️ [BİLİNMEYEN] Anahtar hata verdi: ...${keyObj.key.slice(-4)} -> ${errorMsg}`);
        }
    }
}

// Anahtarları yükle
const keyManager = new KeyManager(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Upload ayarları
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({ dest: uploadDir });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- ANA İŞLEM FONKSİYONU ---
async function processWithGemini(filePath, mimeType, originalName) {
    // 1. DÖNGÜ: Modelleri sırayla dene 
    for (const modelName of keyManager.models) {
        
        // Bu model için uygun anahtar var mı kontrol et
        const activeKeysCount = keyManager.keys.filter(k => k.status === 'ACTIVE').length;
        if (activeKeysCount === 0) {
             console.log("❌ [KRİTİK] Hiçbir aktif anahtar kalmadı!");
             break;
        }

        console.log(`🎯 [STRATEJİ] Hedef Model: ${modelName}`);
        
        // 2. DÖNGÜ: O model için eldeki sağlam anahtarları dene
        let attempts = 0;
        const maxAttempts = keyManager.keys.length; 

        while (attempts < maxAttempts) {
            const keyObj = keyManager.getAvailableKey();
            if (!keyObj) break;

            try {
                // Bağlantı Kur
                const genAI = new GoogleGenerativeAI(keyObj.key);
                const fileManager = new GoogleAIFileManager(keyObj.key);

                // Dosyayı Yükle
                const uploadResult = await fileManager.uploadFile(filePath, {
                    mimeType: mimeType,
                    displayName: originalName,
                });
                
                // İşlenmesini Bekle
                let file = await fileManager.getFile(uploadResult.file.name);
                let waitCount = 0;
                while (file.state === "PROCESSING" && waitCount < 15) {
                    await delay(2000);
                    file = await fileManager.getFile(uploadResult.file.name);
                    waitCount++;
                }

                if (file.state !== "ACTIVE") throw new Error("Dosya işlenemedi (Processing Timeout).");

                // Analiz İste
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent([
                    {
                        fileData: {
                            mimeType: uploadResult.file.mimeType,
                            fileUri: uploadResult.file.uri
                        }
                    },
                    { text: `
GÖREV: Ses dosyasını analiz et.
ÇIKTI FORMATI (Markdown):
## 1. Bağlam ve Katılımcılar
## 2. Diyaloglu Tam Metin (Temizlenmiş)
## 3. Yönetici Özeti
## 4. Ana Çıkarımlar
DİL: Türkçe` }
                ]);

                const responseText = result.response.text();
                
                // Temizlik
                await fileManager.deleteFile(uploadResult.file.name);
                
                return { text: responseText, source: `Gemini (${modelName})` }; // ZAFER! 🏆

            } catch (error) {
                const errMsg = error.message || error.toString();
                // Sadece 404 değilse logla, 404 ise sessizce geç
                if (!errMsg.includes('404')) {
                    console.error(`💥 [HATA] ${modelName} başarısız (Anahtar: ...${keyObj.key.slice(-4)}): ${errMsg}`);
                }
                
                // Ceza Kes
                keyManager.punishKey(keyObj.key, errMsg);
                attempts++;
            }
        }
        // Bu model ile hiçbir anahtar çalışmadıysa sonraki modele geç
    }
    throw new Error("Tüm Gemini modelleri ve anahtarları denendi, hepsi başarısız oldu.");
}

app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Dosya yok." });

    const originalExt = path.extname(req.file.originalname) || ".mp3";
    const filePath = `${req.file.path}${originalExt}`;

    try {
        fs.renameSync(req.file.path, filePath);
    } catch (err) {
        return res.status(500).json({ error: "Dosya hatası." });
    }

    try {
        // --- PLAN A: GEMINI ORDUSU ---
        const result = await processWithGemini(filePath, req.file.mimetype, req.file.originalname);
        res.json({ transkript: result.text, source: result.source });

    } catch (geminiError) {
        console.log("🚨 [SİSTEM UYARISI] Gemini filosu başarısız. Yedeğe geçiliyor...");
        
        // --- PLAN B: GROQ (SON KALE) ---
        try {
            const stream = fs.createReadStream(filePath);
            const transcription = await groq.audio.transcriptions.create({
                file: stream,
                model: "whisper-large-v3",
                response_format: "verbose_json",
                language: "tr"
            });

            const outputText = `
## ⚠️ Sistem Notu
*Gemini sunucuları (tüm modeller ve anahtarlar) şu an yanıt vermiyor. Yedek sistem devreye girdi.*

## 2. Ham Metin (Whisper)
${transcription.text}
            `;
            res.json({ transkript: outputText, source: 'Groq Whisper (Yedek)' });

        } catch (groqError) {
            res.status(500).json({ error: "Tüm sistemler başarısız." });
        }
    } finally {
        if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Akıllı Yönetici Devrede: Port ${PORT}`));