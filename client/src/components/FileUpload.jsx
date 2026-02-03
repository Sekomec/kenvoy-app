import React, { useState } from 'react';

// loading prop'unu buraya ekledik 👇
const FileUpload = ({ onFileSelect, loading }) => {
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) setSelectedFile(file);
  };

  const handleUpload = () => {
    if (selectedFile) onFileSelect(selectedFile);
  };

  return (
    <div className="border-2 border-dashed border-[#38bdf8]/30 bg-[#1e293b]/50 rounded-2xl p-10 text-center hover:border-[#38bdf8]/60 transition-all duration-300">
      
      {/* EĞER YÜKLENİYORSA: Dönen Tekerlek Göster */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-6">
          <div className="w-12 h-12 border-4 border-[#38bdf8] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-[#38bdf8] animate-pulse">Yapay zeka sesi dinliyor...</p>
        </div>
      ) : (
        /* YÜKLENMİYORSA: Normal Butonları Göster */
        <>
          <div className="text-5xl mb-4 text-[#38bdf8]">☁️</div>
          <h3 className="text-xl font-semibold text-slate-200 mb-2">
            Ses dosyasını buraya sürükle
          </h3>
          <p className="text-slate-500 mb-6 text-sm">veya seçmek için tıkla</p>

          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer bg-[#334155] hover:bg-[#475569] text-slate-200 px-4 py-2 rounded-lg text-sm transition mr-2"
          >
            {selectedFile ? "Dosya Değiştir" : "Dosya Seç"}
          </label>

          {selectedFile && (
            <div className="mt-6 animate-fade-in-up">
              <p className="text-[#38bdf8] text-sm mb-4 font-medium">
                Seçilen: {selectedFile.name}
              </p>
              <button
                onClick={handleUpload}
                className="bg-gradient-to-r from-[#0ea5e9] to-[#38bdf8] text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-sky-500/20 hover:shadow-sky-500/40 transform hover:-translate-y-1 transition-all"
              >
                Analizi Başlat 🚀
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FileUpload;