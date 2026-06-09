import { initWhisper } from 'whisper.rn';
import type { WhisperContext } from 'whisper.rn';
import * as FileSystem from 'expo-file-system/legacy';
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { getWhisperModelPath } from './model';

let whisperCtx: WhisperContext | null = null;
let initPromise: Promise<WhisperContext> | null = null;
let currentTranscribeStop: (() => void) | null = null;

export async function initVoice(): Promise<WhisperContext> {
  if (whisperCtx) return whisperCtx;
  if (!initPromise) {
    initPromise = (async () => {
      const filePath = await getWhisperModelPath();
      const ctx = await initWhisper({
        filePath,
        useCoreMLIos: true,
      });
      whisperCtx = ctx;
      return ctx;
    })();
  }
  return initPromise;
}

export async function requestAudioPermission(): Promise<boolean> {
  const { granted } = await requestRecordingPermissionsAsync();
  return granted;
}

export async function prepareAudioSession(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
  });
}

export interface TranscribeResult {
  text: string;
  durationMs: number;
}

export function abortTranscription(): void {
  currentTranscribeStop?.();
  currentTranscribeStop = null;
}

export async function transcribeRecording(
  uri: string,
  onTranscribeStart?: () => void
): Promise<TranscribeResult> {
  const ctx = whisperCtx ?? (await initVoice());

  onTranscribeStart?.();

  const start = Date.now();
  const TIMEOUT_MS = 30_000;

  const { promise, stop } = ctx.transcribe(uri, {
    language: 'ru',
    translate: false,
    maxThreads: 2,
  });

  currentTranscribeStop = stop;

  const timeoutId = setTimeout(() => {
    stop();
  }, TIMEOUT_MS);

  try {
    const { result } = await promise;
    clearTimeout(timeoutId);
    currentTranscribeStop = null;
    const durationMs = Date.now() - start;
    await FileSystem.deleteAsync(uri, { idempotent: true });
    return { text: result.trim(), durationMs };
  } catch (e) {
    clearTimeout(timeoutId);
    currentTranscribeStop = null;
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    const msg = String(e);
    if (msg.includes('aborted') || msg.includes('stopped') || msg.includes('cancelled')) {
      throw new Error('Транскрипция прервана — попробуйте ещё раз с более чётким произношением');
    }
    throw new Error(`Ошибка транскрипции: ${msg}`);
  }
}

export async function releaseVoice(): Promise<void> {
  abortTranscription();
  if (whisperCtx) {
    await whisperCtx.release();
    whisperCtx = null;
    initPromise = null;
  }
}
