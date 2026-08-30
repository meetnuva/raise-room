import type { VisualFrameObservation } from "../domain/visual";

export type VisionWorkerRequest =
  | { type: "load" }
  | { type: "analyze"; requestId: string; timestampMs: number; bitmap: ImageBitmap }
  | { type: "close" };

export type VisionWorkerEvent =
  | { type: "loading"; progress: number | null; message: string }
  | { type: "ready"; delegate: "GPU" | "CPU" }
  | { type: "observation"; requestId: string; observation: VisualFrameObservation }
  | { type: "error"; requestId?: string; message: string };

export interface VisionWorkerPort {
  postMessage(message: VisionWorkerRequest, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  terminate(): void;
}

export interface LocalVisionClient {
  subscribe(listener: (event: VisionWorkerEvent) => void): () => void;
  load(): void;
  analyze(bitmap: ImageBitmap, timestampMs: number): Promise<VisualFrameObservation>;
  destroy(): void;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isNullableFiniteNumber = (value: unknown): value is number | null =>
  value === null || isFiniteNumber(value);

function isUnitInterval(value: unknown): value is number | null {
  return value === null || (isFiniteNumber(value) && value >= 0 && value <= 1);
}

function isVisualObservation(value: unknown): value is VisualFrameObservation {
  if (!isObject(value) || !isFiniteNumber(value.timestampMs) || typeof value.hasFace !== "boolean") {
    return false;
  }

  return isUnitInterval(value.faceCenterX)
    && isUnitInterval(value.faceCenterY)
    && isUnitInterval(value.faceAreaRatio)
    && isUnitInterval(value.irisHorizontalOffset)
    && isNullableFiniteNumber(value.faceCenterX)
    && isNullableFiniteNumber(value.faceCenterY);
}

export function parseVisionWorkerEvent(value: unknown): VisionWorkerEvent | null {
  if (!isObject(value) || typeof value.type !== "string") return null;

  if (
    value.type === "loading"
    && typeof value.message === "string"
    && (value.progress === null || (isFiniteNumber(value.progress) && value.progress >= 0 && value.progress <= 1))
  ) {
    return { type: "loading", progress: value.progress, message: value.message };
  }

  if (value.type === "ready" && (value.delegate === "GPU" || value.delegate === "CPU")) {
    return { type: "ready", delegate: value.delegate };
  }

  if (value.type === "observation" && typeof value.requestId === "string" && isVisualObservation(value.observation)) {
    return { type: "observation", requestId: value.requestId, observation: value.observation };
  }

  if (
    value.type === "error"
    && typeof value.message === "string"
    && (value.requestId === undefined || typeof value.requestId === "string")
  ) {
    return value.requestId === undefined
      ? { type: "error", message: value.message }
      : { type: "error", requestId: value.requestId, message: value.message };
  }

  return null;
}

function createWorker(): VisionWorkerPort {
  return new Worker(
    new URL("../workers/face-landmarker.worker.ts", import.meta.url),
    { type: "module" },
  ) as unknown as VisionWorkerPort;
}

export function createLocalVisionClient(
  workerFactory: () => VisionWorkerPort = createWorker,
): LocalVisionClient {
  const worker = workerFactory();
  const listeners = new Set<(event: VisionWorkerEvent) => void>();
  const pending = new Map<string, {
    resolve(observation: VisualFrameObservation): void;
    reject(error: Error): void;
  }>();
  let destroyed = false;
  let serial = 0;

  const onMessage = (event: MessageEvent<unknown>) => {
    const parsed = parseVisionWorkerEvent(event.data);
    if (!parsed || destroyed) return;

    listeners.forEach((listener) => listener(parsed));

    if (parsed.type === "observation") {
      const item = pending.get(parsed.requestId);
      if (!item) return;
      pending.delete(parsed.requestId);
      item.resolve(parsed.observation);
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
    load() {
      if (!destroyed) worker.postMessage({ type: "load" });
    },
    analyze(bitmap, timestampMs) {
      if (destroyed) return Promise.reject(new Error("本機視覺觀察已關閉。"));
      const requestId = `vision-${Date.now()}-${serial++}`;
      return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        worker.postMessage({ type: "analyze", requestId, timestampMs, bitmap }, [bitmap]);
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      pending.forEach(({ reject }) => reject(new Error("本機視覺觀察已關閉。")));
      pending.clear();
      listeners.clear();
      worker.postMessage({ type: "close" });
      worker.removeEventListener("message", onMessage);
      worker.terminate();
    },
  };
}
