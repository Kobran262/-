import * as FileSystem from 'expo-file-system/legacy';

const MODEL_FILENAME = 'ggml-base.bin';
const REMOTE_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';

let downloadPromise: Promise<string> | null = null;

async function downloadToDocuments(): Promise<string> {
  const dir = `${FileSystem.documentDirectory ?? ''}models/`;
  const docPath = `${dir}${MODEL_FILENAME}`;
  const cached = await FileSystem.getInfoAsync(docPath);
  if (cached.exists) return docPath;

  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const result = await FileSystem.downloadAsync(REMOTE_URL, docPath);
  return result.uri;
}

/** Пути в iOS-бандле (Expo assetBundlePatterns) */
function bundledCandidates(): string[] {
  const base = FileSystem.bundleDirectory ?? '';
  return [
    `${base}assets/models/${MODEL_FILENAME}`,
    `${base}${MODEL_FILENAME}`,
  ];
}

/**
 * Путь к модели Whisper: bundled asset → кэш в Documents → скачивание (~145 MB).
 */
export async function getWhisperModelPath(): Promise<string> {
  for (const path of bundledCandidates()) {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) return path;
  }

  if (!downloadPromise) {
    downloadPromise = downloadToDocuments();
  }
  return downloadPromise;
}

export async function isWhisperModelAvailable(): Promise<boolean> {
  for (const path of bundledCandidates()) {
    if ((await FileSystem.getInfoAsync(path)).exists) return true;
  }
  const docPath = `${FileSystem.documentDirectory ?? ''}models/${MODEL_FILENAME}`;
  return (await FileSystem.getInfoAsync(docPath)).exists;
}
