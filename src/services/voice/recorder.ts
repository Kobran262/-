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

export async function transcribeRecording(
  uri: string,
  onTranscribeStart?: () => void
): Promise<TranscribeResult> {
  const ctx = whisperCtx ?? (await initVoice());

  onTranscribeStart?.();

  const start = Date.now();
  const { promise } = ctx.transcribe(uri, {
    language: 'ru',
    translate: false,
    maxThreads: 4,
  });
  const { result } = await promise;
  const durationMs = Date.now() - start;

  await FileSystem.deleteAsync(uri, { idempotent: true });

  return { text: result.trim(), durationMs };
}

export async function releaseVoice(): Promise<void> {
  if (whisperCtx) {
    await whisperCtx.release();
    whisperCtx = null;
    initPromise = null;
  }
}
