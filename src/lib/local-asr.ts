import type { AsrModelPresetId } from "../domain/asr-models";

export type VoiceLanguage = "zh" | "en" | "ja";

export type AsrWorkerRequest =
  | { type: "load"; preset: AsrModelPresetId }
  | { type: "transcribe"; requestId: string; preset: AsrModelPresetId; audio: Float32Array; language: VoiceLanguage }
  | { type: "close" };

export type AsrWorkerEvent =
  | { type: "loading"; progress: number | null; message: string }
  | { type: "ready"; device: "webgpu" | "wasm" }
  | { type: "transcribing"; requestId: string }
  | { type: "partial"; requestId: string; text: string }
  | { type: "complete"; requestId: string; text: string }
  | { type: "error"; requestId?: string; message: string };

export interface WorkerPort {
  postMessage(message: AsrWorkerRequest, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  terminate(): void;
}

export interface LocalAsrClient {
  subscribe(listener: (event: AsrWorkerEvent) => void): () => void;
  load(preset: AsrModelPresetId): void;
  transcribe(audio: Float32Array, language: VoiceLanguage, preset: AsrModelPresetId): Promise<string>;
  destroy(): void;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

export function normalizeAsrProgress(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  const normalized = value <= 1 ? value : value <= 100 ? value / 100 : null;
  return normalized === null ? null : Math.min(1, Math.max(0, normalized));
}

export function parseAsrWorkerEvent(value: unknown): AsrWorkerEvent | null {
  if (!isObject(value) || !isString(value.type)) {
    return null;
  }

  if (
    value.type === "loading" &&
    isString(value.message) &&
    (value.progress === null ||
      (typeof value.progress === "number" &&
        Number.isFinite(value.progress) &&
        value.progress >= 0 &&
        value.progress <= 1))
  ) {
    return { type: "loading", progress: value.progress, message: value.message };
  }

  if (value.type === "ready" && (value.device === "webgpu" || value.device === "wasm")) {
    return { type: "ready", device: value.device };
  }

  if (
    (value.type === "transcribing" || value.type === "partial" || value.type === "complete") &&
    isString(value.requestId) &&
    (value.type === "transcribing" || isString(value.text))
  ) {
    return value as AsrWorkerEvent;
  }

  if (
    value.type === "error" &&
    isString(value.message) &&
    (value.requestId === undefined || isString(value.requestId))
  ) {
    return value as AsrWorkerEvent;
  }

  return null;
}

function createWorker(): WorkerPort {
  return new Worker(
    new URL("../workers/whisper.worker.ts", import.meta.url),
    { type: "module" },
  ) as unknown as WorkerPort;
}

export function createLocalAsrClient(
  workerFactory: () => WorkerPort = createWorker,
): LocalAsrClient {
  const worker = workerFactory();
  const listeners = new Set<(event: AsrWorkerEvent) => void>();
  const pending = new Map<string, { resolve(text: string): void; reject(error: Error): void }>();
  let destroyed = false;
  let serial = 0;

  const onMessage = (event: MessageEvent<unknown>) => {
    const parsed = parseAsrWorkerEvent(event.data);
    if (!parsed || destroyed) return;

    listeners.forEach((listener) => listener(parsed));

    if (parsed.type === "complete") {
      const item = pending.get(parsed.requestId);
      if (!item) return;

      pending.delete(parsed.requestId);
      item.resolve(parsed.text);
    }

    if (parsed.type === "error" && parsed.requestId) {
      const item = pending.get(parsed.requestId);
      if (!item) return;

      pending.delete(parsed.requestId);
      item.reject(new Error(parsed.message));
    }
  };

  worker.addEventListener("message", onMessage);

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load(preset) {
      if (!destroyed) worker.postMessage({ type: "load", preset });
    },
    transcribe(audio, language, preset) {
      if (destroyed) return Promise.reject(new Error("語音轉錄已關閉。"));

      const requestId = `asr-${Date.now()}-${serial++}`;
      return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        worker.postMessage(
          { type: "transcribe", requestId, preset, audio, language },
          [audio.buffer],
        );
      });
    },
    destroy() {
      if (destroyed) return;

      destroyed = true;
      pending.forEach(({ reject }) => reject(new Error("語音轉錄已關閉。")));
      pending.clear();
      listeners.clear();
      worker.removeEventListener("message", onMessage);
      worker.postMessage({ type: "close" });
      worker.terminate();
    },
  };
}
