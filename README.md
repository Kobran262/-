# Srecha WMS

Мобильное приложение складского учёта для DOO «Srecha» (Сербия).

## Возможности MVP

- Авторизация по PIN (1234) + Face ID / Touch ID
- База товаров: 83 SKU + 9 упаковочных материалов
- Сканер штрихкодов (expo-camera) с привязкой к SKU
- Акты: АП, АТ, КУ, АО
- Журнал движений при закрытии акта
- PDF (expo-print) + шаринг
- Экспорт CSV (товары, движения, акты)
- Firebase sync (offline-first, sync_pending)

## Запуск в симуляторе (без dev-сервера)

Приложение собирается как **нативный Release** — JS-бандл внутри `.app`, Metro и Expo Go не нужны.

```bash
npm run ios:sim
```

Скрипт копирует проект в `/tmp/srecha-wms-build` (обход кириллицы в пути `склад/`, из‑за которой падает `pod install`) и запускает `expo run:ios --configuration Release`.

> **Важно:** кириллица в пути проекта (`склад/`) ломает CocoaPods и нативную сборку. Для стабильной работы рекомендуется перенести репозиторий в путь только с латиницей, например `~/Projects/srecha-wms`.

**Требования:** Xcode, ~5 ГБ свободного места на диске для первой сборки.

Альтернатива — перенести проект в путь только с латиницей, например `~/Projects/srecha-wms`, затем:

```bash
npm run ios:release
```

## Обычный dev-режим (с Metro)

```bash
npm start
```

## Конфигурация Firebase

Создайте `.env` или задайте переменные в `app.config.ts`:

```
FIREBASE_API_KEY=...
FIREBASE_PROJECT_ID=...
GOOGLE_OAUTH_CLIENT_ID=...
```

## Пользователи по умолчанию

| Имя | PIN | Роль |
|-----|-----|------|
| Бранко К. | 1234 | admin |
| Павел М. | 1234 | cto |
| Иван И. | 1234 | warehouse |
| Наталья К. | 1234 | warehouse |

## Голосовой ввод (Whisper)

Offline-распознавание речи через [whisper.rn](https://github.com/mybigday/whisper.rn). Не работает в Expo Go — только development/release build.

### Подготовка модели

```bash
npm run download-whisper-base   # 145 МБ, рекомендуется для TestFlight
# или
npm run download-whisper-small  # 465 МБ, лучший русский
```

`npm run testflight` скачивает `ggml-base.bin` автоматически, если файла нет.

### Сборка с голосом

```bash
npm run ensure-whisper-model
npx expo prebuild --platform ios
npm run ios:release
```

При первом запуске без bundled-модели приложение скачает ~145 МБ в Documents (нужен интернет один раз).

### Разрешения

- iOS: `NSMicrophoneUsageDescription` в Info.plist
- Android: `RECORD_AUDIO`

## Стек

- Expo SDK 56, TypeScript, Expo Router
- SQLite + Drizzle ORM
- NativeWind (Tailwind)
- Zustand, TanStack Query
- Firebase Firestore
