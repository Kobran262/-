#!/bin/bash
# Сборка без Metro: Release-бандл внутри .app, без Expo Go.
# Обход: путь без кириллицы/пробелов (иначе pod install падает на React-Core-prebuilt).
set -euo pipefail

BUILD_DIR="/tmp/srecha-wms-build"
SRC="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ Копирование в ${BUILD_DIR}..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
rsync -a --exclude node_modules --exclude ios --exclude .expo "$SRC/" "$BUILD_DIR/"
cd "$BUILD_DIR"
npm install --silent

echo "→ Prebuild iOS..."
npx expo prebuild --platform ios --clean

echo "→ Сборка Release и запуск симулятора (без dev-сервера)..."
npx expo run:ios --configuration Release
