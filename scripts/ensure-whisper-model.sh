#!/bin/bash
# Скачивает ggml-base.bin если отсутствует (нужен для offline Whisper в TestFlight).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODEL_DIR="$ROOT/assets/models"
MODEL_FILE="$MODEL_DIR/ggml-base.bin"
URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"

if [ -f "$MODEL_FILE" ]; then
  echo "✓ Whisper model already present: $MODEL_FILE ($(du -h "$MODEL_FILE" | cut -f1))"
  exit 0
fi

mkdir -p "$MODEL_DIR"
echo "→ Downloading Whisper ggml-base.bin (~145 MB)..."
curl -L --fail --progress-bar "$URL" -o "$MODEL_FILE"
echo "✓ Downloaded: $MODEL_FILE ($(du -h "$MODEL_FILE" | cut -f1))"
