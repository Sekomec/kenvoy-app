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

// --- 1. DEĞİŞİKLİK: CORS AYARI (Her yerden gelen isteği kabul et) ---
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// --- AYARLAR ---
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Upload klasör kontrolü
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({ dest: uploadDir });

// Bekleme fonksiyonu
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Google File API dosya durumu kontrolü
async function waitForFileActive(fileUri) {
    let file = await fileManager.getFile(fileUri);
    let attempts = 0;
    while (file.state === "PROCESSING" && attempts < 30) {
        console.log(`[Google] İşleniyor... (${attempts}/30)`);
        await delay(2000);
        file = await fileManager.getFile(fileUri);
        attempts++;
    }
    if (file.state !== "ACTIVE") throw new Error(`Dosya durumu: ${file.state}`);
    return file;
}

app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Dosya yok." });

    // Dosya uzantısını koruyarak yeniden adlandır
    const originalExt = path.extname(req.file.originalname) || ".mp3";
    const filePath = `${req.file.path}${originalExt}`;

    try {
        fs.renameSync(req.file.path, filePath);
    } catch (err) {
        return res.status(500).json({ error: "Dosya işleme hatası." });
    }

    let googleFileUri = null;

    try {
        // --- SENARYO 1: GEMINI 2.5 FLASH İLE EVRENSEL ANALİZ ---
        console.log("--- SENARYO 1: GEMINI 2.5 FLASH BAŞLATILIYOR ---");

        const uploadResult = await fileManager.uploadFile(filePath, {
            mimeType: req.file.mimetype,
            displayName: req.file.originalname,
        });
        googleFileUri = uploadResult.file.name;

        await waitForFileActive(googleFileUri);

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Not: 2.5 henüz kararlı olmayabilir, 2.0 Flash veya Pro kullanıyoruz. İsim güncellemesi.

        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: uploadResult.file.mimeType,
                    fileUri: uploadResult.file.uri
                }
            },
            {
                text: `
GÖREV: Aşağıda verilen ham ses dosyasını analiz et ve profesyonel, okunabilir bir formata dönüştür.

1. BAĞLAM VE KONUŞMACI ANALİZİ:
   - Bağlamı tespit et (Toplantı, Ders, Mülakat vb.).
   - Konuşmacıları etiketle (Örn: Eğitmen, Öğrenci, Yönetici).

2. METİN TEMİZLİĞİ:
   - Zaman damgası EKLEME.
   - "Eee, hımm" gibi dolgu sözcüklerini at.
   - Grameri düzelt.

3. ÇIKTI FORMATI (Markdown):
## 1. Bağlam ve Katılımcılar
## 2. Diyaloglu Tam Metin (Temizlenmiş)
## 3. Yönetici Özeti
## 4. Ana Çıkarımlar ve Önemli Maddeler

---
DİL: Türkçe
                `
            }
        ]);

        const text = result.response.text();
        console.log("✅ [BAŞARILI] Gemini yanıt verdi.");
        res.json({ transkript: text, source: 'Gemini 2.0 Flash' });

    } catch (geminiError) {
        console.error("⚠️ [GEMINI HATA]:", geminiError.message);
        console.log("--- SENARYO 2: GROQ (YEDEK) DEVREYE GİRİYOR ---");

        try {
            const stream = fs.createReadStream(filePath);
            const transcription = await groq.audio.transcriptions.create({
                file: stream,
                model: "whisper-large-v3",
                response_format: "verbose_json",
                language: "tr"
            });

            console.log("✅ [BAŞARILI] Groq yanıt verdi.");
            const outputText = `
## 1. Bağlam
*(Yedek sistem kullanıldığı için otomatik bağlam tespiti yapılamadı.)*

## 2. Ham Metin Dökümü (Whisper-Large-v3)
${transcription.text}

## 3. Özet ve Analiz
*(Bu bölüm sadece Gemini aktifken çalışır.)*
            `;
            res.json({ transkript: outputText, source: 'Groq Whisper (Yedek)' });

        } catch (groqError) {
            console.error("❌ [GROQ HATA]:", groqError.message);
            res.status(500).json({ error: "Tüm sistemler meşgul veya hata oluştu." });
        }
    } finally {
        if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
        if (googleFileUri) {
            try { await fileManager.deleteFile(googleFileUri); } catch (e) { console.log("Dosya silme hatası (önemsiz)"); }
        }
    }
});

// --- 2. DEĞİŞİKLİK: RENDER PORT AYARI ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server Hazır: Port ${PORT}`));