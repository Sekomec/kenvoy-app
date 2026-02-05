#!/bin/bash

# Eğer /tmp/swapfile yoksa oluştur
if [ ! -f /tmp/swapfile ]; then
    echo "Swap dosyası oluşturuluyor..."
    fallocate -l 512M /tmp/swapfile
    chmod 600 /tmp/swapfile
    mkswap /tmp/swapfile
    swapon /tmp/swapfile
    echo "Swap aktif edildi! Ekstra hafıza hazır."
fi

# Sunucuyu başlat
node server.js