# Whisper models

Файлы моделей не хранятся в git (см. `.gitignore`).

Перед сборкой iOS:

```bash
npm run download-whisper-base
# или для лучшего русского:
npm run download-whisper-small
```

Скрипт `npm run testflight` скачивает `ggml-base.bin` автоматически, если файла нет.
