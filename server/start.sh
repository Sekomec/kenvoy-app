#!/bin/bash
set -e

echo ">>> SWAP ISLEMI BASLIYOR..."

# /tmp YERINE direk oldugumuz yere kuralim (Disk kullanimi icin)
SWAPFILE=$(pwd)/swapfile

# Onceki swap varsa temizle
swapoff -a || true
rm -f $SWAPFILE

# 1.5 GB'lik dosya olustur (Diskte yer acar)
dd if=/dev/zero of=$SWAPFILE bs=1M count=1536

# Izinleri ayarla
chmod 600 $SWAPFILE

# Swap olarak bicimlendir ve ac
mkswap $SWAPFILE
swapon $SWAPFILE

echo ">>> SWAP HAZIR! DURUM:"
free -h

echo ">>> SERVER BASLATILIYOR..."
exec node server.js