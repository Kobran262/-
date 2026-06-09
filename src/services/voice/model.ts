import * as FileSystem from 'expo-file-system/legacy';

const MODEL_FILENAME = 'ggml-base.bin';
const REMOTE_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';

export type ModelDownloadProgress = {
  totalBytes: number;
  downloadedBytes: number;
  percent: number;
};

type ProgressCallback = (p: ModelDownloadProgress) => void;

let downloadPromise: Promise<string> | null = null;
let onProgressGlobal: ProgressCallback | null = null;

function bundledCandidates(): string[] {
  const base = FileSystem.bundleDirectory ?? '';
  return [`${base}assets/models/${MODEL_FILENAME}`, `${base}${MODEL_FILENAME}`];
}

async function downloadToDocuments(onProgress?: ProgressCallback): Promise<string> {
  const dir = `${FileSystem.documentDirectory ?? ''}models/`;
  const docPath = `${dir}${MODEL_FILENAME}`;
  const cached = await FileSystem.getInfoAsync(docPath);
  if (cached.exists) return docPath;

  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

  return new Promise<string>((resolve, reject) => {
    const task = FileSystem.createDownloadResumable(
      REMOTE_URL,
      docPath,
      {},
      (downloadProgress) => {
        const { totalBytesWritten, totalBytesExpectedToWrite } = downloadProgress;
        const percent =
          totalBytesExpectedToWrite > 0
            ? Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100)
            : 0;
        const payload = {
          totalBytes: totalBytesExpectedToWrite,
          downloadedBytes: totalBytesWritten,
          percent,
        };
        onProgress?.(payload);
        onProgressGlobal?.(payload);
      }
    );
    task
      .downloadAsync()
      .then((res) => {
        if (res?.uri) resolve(res.uri);
        else reject(new Error('Download failed'));
      })
      .catch(reject);
  });
}

export async function getWhisperModelPath(onProgress?: ProgressCallback): Promise<string> {
  for (const path of bundledCandidates()) {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) return path;
  }

  const docPath = `${FileSystem.documentDirectory ?? ''}models/${MODEL_FILENAME}`;
  const docInfo = await FileSystem.getInfoAsync(docPath);
  if (docInfo.exists) return docPath;

  if (!downloadPromise) {
    downloadPromise = downloadToDocuments(onProgress).catch((e) => {
      downloadPromise = null;
      throw e;
    });
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

export function subscribeModelProgress(cb: ProgressCallback): () => void {
  onProgressGlobal = cb;
  return () => {
    onProgressGlobal = null;
  };
}
