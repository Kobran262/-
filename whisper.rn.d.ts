declare module 'whisper.rn' {
  export type TranscribeResult = {
    result: string;
    language?: string;
    segments?: unknown[];
    isAborted?: boolean;
  };

  export class WhisperContext {
    transcribe(
      filePathOrBase64: string,
      options?: { language?: string; translate?: boolean; maxThreads?: number }
    ): {
      stop: () => Promise<void>;
      promise: Promise<TranscribeResult>;
    };
    release(): Promise<void>;
  }

  export function initWhisper(options: {
    filePath: string | number;
    isBundleAsset?: boolean;
    useCoreMLIos?: boolean;
    useGpu?: boolean;
  }): Promise<WhisperContext>;
}

declare module '*.bin' {
  const assetId: number;
  export default assetId;
}
