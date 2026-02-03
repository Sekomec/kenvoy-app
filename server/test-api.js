require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

console.log("🔍 Modeller Google'dan sorgulanıyor...");

fetch(url)
  .then(res => res.json())
  .then(data => {
    if (data.models) {
        console.log("\n✅ API Anahtarının İzin Verdiği Modeller:");
        console.log("-----------------------------------------");
        // Sadece işimize yarayan 'generateContent' destekleyenleri filtreleyelim
        const usableModels = data.models.filter(m => m.supportedGenerationMethods.includes("generateContent"));
        usableModels.forEach(m => console.log(m.name.replace("models/", "")));
        console.log("-----------------------------------------");
    } else {
        console.log("\n❌ HATA: Google modelleri listelemedi. Cevap şuydu:");
        console.log(JSON.stringify(data, null, 2));
    }
  })
  .catch(err => console.error("\n❌ Bağlantı Hatası:", err));