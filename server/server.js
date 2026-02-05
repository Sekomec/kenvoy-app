/**
 * ==========================================================================================
 * PROJECT: ROBUST AUDIO TRANSCRIPTION GATEWAY (GEMINI & GROQ FALLBACK)
 * VERSION: 2.1.0 (COMPATIBLE EDITION)
 * AUTHOR: Kodlama Desteği AI & User
 * ==========================================================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const Groq = require('groq-sdk');

// --- TİP TANIMLAMALARI VE SABİTLER ---

const UPLOAD_DIR = 'uploads/';
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB (Eşitledik)
const SERVER_PORT = process.env.PORT || 5000;

// İstatistikleri hafızada tutmak için global obje
const SYSTEM_STATS = {
    totalRequests: 0,
    successfulTranscriptions: 0,
    failedTranscriptions: 0,
    groqFallbacks: 0,
    modelUsage: {},
    startTime: new Date()
};

// --- YARDIMCI SINIFLAR (LOGLAMA) ---
class Logger {
    static getTime() {
        return new Date().toISOString().replace('T', ' ').substring(0, 19);
    }
    static info(msg, context = "SİSTEM") {
        console.log(`\x1b[36m[${this.getTime()}]\x1b[0m \x1b[1m[INFO]\x1b[0m [${context}]: ${msg}`);
    }
    static success(msg, context = "BAŞARI") {
        console.log(`\x1b[32m[${this.getTime()}]\x1b[0m \x1b[1m[SUCCESS]\x1b[0m [${context}]: ${msg}`);
    }
    static warn(msg, context = "UYARI") {
        console.warn(`\x1b[33m[${this.getTime()}]\x1b[0m \x1b[1m[WARN]\x1b[0m [${context}]: ${msg}`);
    }
    static error(msg, context = "HATA", errorObj = null) {
        console.error(`\x1b[31m[${this.getTime()}]\x1b[0m \x1b[1m[ERROR]\x1b[0m [${context}]: ${msg}`);
    }
    static divider() {
        console.log(`\x1b[90m------------------------------------------------------------\x1b[0m`);
    }
}

// --- KEY MANAGER (ANAHTAR YÖNETİCİSİ) ---
class KeyManager {
    constructor(keysString) {
        this.keys = [];
        this._initializeKeys(keysString);
    }

    _initializeKeys(keysString) {
        if (!keysString) {
            Logger.error("ENV dosyasında GEMINI_API_KEYS bulunamadı!");
            return;
        }
        // Virgülle ayır ve temizle
        const rawKeys = keysString.split(',').map(k => k.trim()).filter(k => k.length > 0);
        
        rawKeys.forEach((k, index) => {
            this.keys.push({
                id: index + 1,
                key: k,
                status: 'ACTIVE', // ACTIVE, COOLDOWN, DEAD
                cooldownUntil: 0
            });
        });
        Logger.info(`${this.keys.length} adet Gemini anahtarı yüklendi.`, "KEY-MGR");
    }

    getActiveKeys() {
        const now = Date.now();
        // Cooldown süresi bitenleri kurtar
        this.keys.forEach(k => {
            if (k.status === 'COOLDOWN' && now > k.cooldownUntil) {
                Logger.info(`Anahtar #${k.id} cezası bitti, tekrar aktif.`, "KEY-MGR");
                k.status = 'ACTIVE';
            }
        });
        return this.keys.filter(k => k.status === 'ACTIVE');
    }

    reportFailure(keyStr, error) {
        const keyObj = this.keys.find(k => k.key === keyStr);
        if (!keyObj) return;

        if (error.message && error.message.includes('API key not valid')) {
            keyObj.status = 'DEAD';
            Logger.error(`Anahtar #${keyObj.id} GEÇERSİZ olduğu için silindi (DEAD).`, "KEY-MGR");
        } else {
            // Geçici hata -> 10 saniye dinlendir
            keyObj.status = 'COOLDOWN';
            keyObj.cooldownUntil = Date.now() + 10000;
            Logger.warn(`Anahtar #${keyObj.id} 10sn dinlenmeye alındı.`, "KEY-MGR");
        }
    }
}

// --- MODEL STRATEJİSİ ---
class ModelStrategy {
    constructor() {
        this.models = [
            // 1. Kademe: En Hızlı ve Güvenilir (Render ortamı için ideal)
            { id: "gemini-2.0-flash", desc: "Hızlı" },
            { id: "gemini-2.0-flash-lite", desc: "Hafif" },
            
            // 2. Kademe: Akıllı Modeller
            { id: "gemini-2.5-pro", desc: "Zeki" },
            { id: "gemini-2.5-flash", desc: "Dengeli" },

            // 3. Kademe: Eski/Deneysel
            { id: "gemini-1.5-flash", desc: "Eski Flash" },
            { id: "gemini-exp-1206", desc: "Deneysel" }
        ];
    }
    getModels() { return this.models; }
}

// --- GEMINI SERVİSİ ---
class GeminiService {
    async delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    async uploadAndPoll(filePath, mimeType, originalName, apiKey) {
        const fileManager = new GoogleAIFileManager(apiKey);
        
        Logger.info(`Upload başlıyor: ${originalName}`, "GEMINI-UPLOAD");
        const uploadResult = await fileManager.uploadFile(filePath, {
            mimeType: mimeType,
            displayName: originalName,
        });

        const fileName = uploadResult.file.name;
        
        // İşlenmesini bekle
        let file = await fileManager.getFile(fileName);
        let attempts = 0;
        while (file.state === "PROCESSING" && attempts < 20) {
            await this.delay(1000);
            file = await fileManager.getFile(fileName);
            attempts++;
        }

        if (file.state !== "ACTIVE") throw new Error("Dosya Google tarafında işlenemedi.");
        return { fileUri: file.uri, name: fileName, manager: fileManager };
    }

    async attemptGeneration(modelId, apiKey, filePath, mimeType, originalName) {
        let uploadedFile = null;
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            uploadedFile = await this.uploadAndPoll(filePath, mimeType, originalName, apiKey);

            const model = genAI.getGenerativeModel({ model: modelId });
            Logger.info(`Analiz ediliyor... Model: ${modelId}`, "GEMINI-GEN");
            
            const result = await model.generateContent([
                {
                    fileData: { mimeType: mimeType, fileUri: uploadedFile.fileUri }
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
            await uploadedFile.manager.deleteFile(uploadedFile.name);
            return responseText;

        } catch (error) {
            // Hata olsa bile dosyayı silmeye çalış
            if (uploadedFile) {
                try { await uploadedFile.manager.deleteFile(uploadedFile.name); } catch(e){}
            }
            throw error;
        }
    }
}

// --- ORKESTRA ŞEFİ (ORCHESTRATOR) ---
class Orchestrator {
    constructor(keyManager, modelStrategy) {
        this.keyManager = keyManager;
        this.modelStrategy = modelStrategy;
        this.geminiService = new GeminiService();
        this.groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }

    async processAudio(filePath, mimeType, originalName) {
        const models = this.modelStrategy.getModels();

        // 1. PLAN: GEMINI ORDUSU
        for (const model of models) {
            Logger.info(`>>> STRATEJİ: Model [${model.id}] deneniyor.`, "ORCHESTRATOR");

            // Bu model için max 3 farklı anahtar dene (Sonsuz döngüye girmesin)
            let attempts = 0;
            while (attempts < 3) {
                const activeKeys = this.keyManager.getActiveKeys();
                if (activeKeys.length === 0) {
                    Logger.error("Tüm anahtarlar tükendi!", "ORCHESTRATOR");
                    break;
                }

                // Rastgele bir anahtar seç
                const currentKeyObj = activeKeys[Math.floor(Math.random() * activeKeys.length)];

                try {
                    const resultText = await this.geminiService.attemptGeneration(
                        model.id, 
                        currentKeyObj.key, 
                        filePath, 
                        mimeType, 
                        originalName
                    );

                    SYSTEM_STATS.successfulTranscriptions++;
                    SYSTEM_STATS.modelUsage[model.id] = (SYSTEM_STATS.modelUsage[model.id] || 0) + 1;
                    
                    return { text: resultText, source: `Gemini (${model.id})` };

                } catch (error) {
                    const errorMsg = error.message || error.toString();
                    Logger.warn(`BAŞARISIZ: ${model.id} -> ${errorMsg.substring(0, 50)}...`, "FAIL");
                    
                    this.keyManager.reportFailure(currentKeyObj.key, error);

                    // Eğer model bulunamadıysa (404), bu modelde ısrar etme, diğer modele geç
                    if (errorMsg.includes("404") || errorMsg.includes("not found")) {
                        Logger.info("Bu model desteklenmiyor, sonraki modele geçiliyor.", "SKIP");
                        break; // while döngüsünü kır, for döngüsü sonraki modele geçer
                    }
                }
                attempts++;
            }
        }

        // 2. PLAN: GROQ (SON KALE)
        return await this.fallbackToGroq(filePath);
    }

    async fallbackToGroq(filePath) {
        Logger.info("DEVREYE GİRİYOR: Groq Whisper", "FALLBACK");
        SYSTEM_STATS.groqFallbacks++;

        try {
            const stream = fs.createReadStream(filePath);
            const transcription = await this.groqClient.audio.transcriptions.create({
                file: stream,
                model: "whisper-large-v3",
                response_format: "verbose_json",
                language: "tr"
            });

            return {
                text: `### ⚠️ Sistem Notu\nGemini yanıt veremedi, Groq Whisper kullanıldı.\n\n${transcription.text}`,
                source: "Groq (Whisper)"
            };
        } catch (error) {
            SYSTEM_STATS.failedTranscriptions++;
            throw new Error("Tüm sistemler çöktü.");
        }
    }
}

// --- EXPRESS SETUP ---
const app = express();
const keyManager = new KeyManager(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY);
const modelStrategy = new ModelStrategy();
const orchestrator = new Orchestrator(keyManager, modelStrategy);

app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json());

// Upload Ayarları
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 500 * 1024 * 1024 } });

// --- ENDPOINTLER ---

// ÖNEMLİ DÜZELTME: Frontend '/upload' bekliyor, '/api/transcribe' değil!
app.post('/upload', upload.single('file'), async (req, res) => {
    SYSTEM_STATS.totalRequests++;
    
    if (!req.file) return res.status(400).json({ error: "Dosya yok." });
    
    // Uzantı ekle
    const originalExt = path.extname(req.file.originalname) || ".mp3";
    const filePath = `${req.file.path}${originalExt}`;
    
    try {
        fs.renameSync(req.file.path, filePath);
    } catch(e) { return res.status(500).json({ error: "Dosya işleme hatası" }); }

    try {
        const result = await orchestrator.processAudio(
            filePath, 
            req.file.mimetype, 
            req.file.originalname
        );

        // ÖNEMLİ DÜZELTME: Frontend { transkript, source } bekliyor!
        res.json({
            transkript: result.text,
            source: result.source
        });

    } catch (error) {
        Logger.error("Kritik Hata", "API", error);
        res.status(500).json({ error: "İşlem başarısız oldu." });
    } finally {
        // Temizlik
        if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
    }
});

// İstatistikleri görmek için ekstra endpoint (Tarayıcıdan girip bakabilirsin)
app.get('/status', (req, res) => {
    res.json({
        uptime: process.uptime(),
        stats: SYSTEM_STATS,
        activeKeys: keyManager.keys.filter(k => k.status === 'ACTIVE').length
    });
});

app.listen(SERVER_PORT, () => {
    Logger.divider();
    Logger.success(`🚀 GÖREV HAZIR: Port ${SERVER_PORT}`, "BOOT");
    Logger.divider();
});