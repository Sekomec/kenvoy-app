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
        // Virgül kontrolü ve temizlik
        if (!keysString) {
            console.error("❌ [HATA] API Anahtarları bulunamadı! .env kontrol edin.");
            this.keys = [];
        } else {
            this.keys = keysString.split(',').map(k => k.trim()).filter(k => k).map(k => ({
                key: k,
                status: 'ACTIVE', // ACTIVE, COOLDOWN
                retryAfter: 0
            }));
        }
        
        console.log(`✅ [SİSTEM] Toplam ${this.keys.length} adet Gemini anahtarı yüklendi.`);

        // --- GÜNCELLENMİŞ MODEL SIRALAMASI ---
        // Strateji: Önce "Garanti" çalışanlar, sonra "Lüks" olanlar
        this.models = [
            // 1. Kademe: En Hızlı ve En Güvenilir (Garanti Gol)
            "gemini-2.0-flash", 
            "gemini-2.0-flash-lite",
            
            // 2. Kademe: Zeki Modeller (Varsa kullanır)
            "gemini-2.5-pro",
            "gemini-2.5-flash",
            
            // 3. Kademe: Gelecek Nesil (Deneysel)
            "gemini-3-flash-preview",
            "gemini-exp-1206",
            
            // 4. Kademe: Eski Topraklar
            "gemini-1.5-flash",
            "gemini-pro"
        ];
    }

    getAvailableKey() {
        const now = Date.now();
        // Cezası bitenleri affet
        this.keys.forEach(k => {
            if (k.status === 'COOLDOWN' && now > k.retryAfter) {
                k.status = 'ACTIVE';
            }
        });

        const activeKeys = this.keys.filter(k => k.status === 'ACTIVE');
        if (activeKeys.length === 0) return null;

        return activeKeys[Math.floor(Math.random() * activeKeys.length)];
    }

    punishKey(keyStr, errorMsg) {
        const keyObj = this.keys.find(k => k.key === keyStr);
        if (!keyObj) return;

        // DÜZELTME: Sadece anahtar geçersizse öldür. Kota hatasında sadece dinlendir.
        if (errorMsg.includes('API key not valid')) {
            console.log(`💀 [SİSTEM] Anahtar GEÇERSİZ (Siliniyor): ...${keyObj.key.slice(-4)}`);
            keyObj.status = 'DEAD'; // Bu anahtarı bir daha asla kullanma
        } else {
            // Kota doldu, Limit yok, 429 vs. -> Sadece 10 saniye mola ver
            // Böylece diğer modellere şansı kalsın.
            console.log(`⏳ [SİSTEM] Anahtar yoruldu, 10sn mola: ...${keyObj.key.slice(-4)}`);
            keyObj.status = 'COOLDOWN';
            keyObj.retryAfter = Date.now() + 10000; 
        }
    }
}

// Anahtarları yükle
const keyManager = new KeyManager(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({ dest: uploadDir });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- ANA İŞLEM FONKSİYONU ---
async function processWithGemini(filePath, mimeType, originalName) {
    let lastError = null;

    // 1. DÖNGÜ: Modelleri sırayla dene 
    for (const modelName of keyManager.models) {
        
        // Aktif anahtar var mı? (DEAD olmayanlar dahil, COOLDOWN bitmiş olabilir)
        const usableKeys = keyManager.keys.filter(k => k.status !== 'DEAD');
        if (usableKeys.length === 0) {
             console.log("❌ [KRİTİK] Tüm anahtarlar 'DEAD' (Geçersiz) durumda!");
             break;
        }

        console.log(`🎯 [DENEME] Model: ${modelName}`);
        
        // Bu model için 3 farklı anahtar deneme hakkı verelim
        let attempts = 0;
        const maxAttempts = 3; 

        while (attempts < maxAttempts) {
            const keyObj = keyManager.getAvailableKey();
            
            // Eğer o an hepsi 'COOLDOWN'daysa bekleme, sonraki modele geç
            if (!keyObj) break; 

            try {
                const genAI = new GoogleGenerativeAI(keyObj.key);
                const fileManager = new GoogleAIFileManager(keyObj.key);

                const uploadResult = await fileManager.uploadFile(filePath, {
                    mimeType: mimeType,
                    displayName: originalName,
                });
                
                let file = await fileManager.getFile(uploadResult.file.name);
                let waitCount = 0;
                while (file.state === "PROCESSING" && waitCount < 15) {
                    await delay(1000);
                    file = await fileManager.getFile(uploadResult.file.name);
                    waitCount++;
                }

                if (file.state !== "ACTIVE") throw new Error("Dosya işlenemedi.");

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
                await fileManager.deleteFile(uploadResult.file.name);
                
                console.log(`🏆 [BAŞARILI] ${modelName} sonuç verdi!`);
                return { text: responseText, source: `Gemini (${modelName})` };

            } catch (error) {
                const errMsg = error.message || error.toString();
                // 404 (Model yok) hatasını sessiz geç, diğerlerini logla
                if (!errMsg.includes('404') && !errMsg.includes('not found')) {
                    console.warn(`⚠️ [HATA] ${modelName} başarısız (...${keyObj.key.slice(-4)}): ${errMsg.substring(0, 100)}...`);
                    // Anahtarı cezalandır
                    keyManager.punishKey(keyObj.key, errMsg);
                } else {
                    // Model bulunamadıysa bu modeli geç, anahtara ceza verme
                    console.log(`ℹ️ [BİLGİ] ${modelName} bu anahtarda yok, geçiliyor.`);
                }
                
                lastError = error;
                attempts++;
            }
        }
    }
    throw lastError || new Error("Tüm Gemini modelleri denendi.");
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
        // --- PLAN A: GEMINI ---
        const result = await processWithGemini(filePath, req.file.mimetype, req.file.originalname);
        res.json({ transkript: result.text, source: result.source });

    } catch (geminiError) {
        console.log("🚨 [SİSTEM] Gemini başarısız oldu. Groq devreye giriyor...");
        
        // --- PLAN B: GROQ ---
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
*Gemini sunucuları şu an yoğun. Yedek sistem (Groq Whisper) kullanıldı.*

## 2. Ham Metin
${transcription.text}
            `;
            res.json({ transkript: outputText, source: 'Groq Whisper (Yedek)' });

        } catch (groqError) {
            console.error("Groq Hatası:", groqError);
            res.status(500).json({ error: "Tüm sistemler başarısız." });
        }
    } finally {
        if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Sunucu Hazır: Port ${PORT}`));