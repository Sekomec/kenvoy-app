#!/bin/bash
set -e # Hata olursa dur

echo ">>> SWAP AYARLARI BASLIYOR..."

# Mevcut swap varsa kapat
swapoff -a || true

# 1.5 GB'lık boş dosya oluştur (dd komutu daha garantidir)
dd if=/dev/zero of=/tmp/swapfile bs=1M count=1536 status=progress

# Dosya izinlerini ayarla
chmod 600 /tmp/swapfile

# Dosyayı swap alanı olarak formatla
mkswap /tmp/swapfile

# Swap'i aktif et
swapon /tmp/swapfile

echo ">>> SWAP BASARIYLA OLUSTURULDU! (1.5 GB EK HAFIZA)"
echo ">>> TOPLAM HAFIZA DURUMU:"
free -h

# Sunucuyu başlat
echo ">>> SERVER BASLATILIYOR..."
exec node server.js