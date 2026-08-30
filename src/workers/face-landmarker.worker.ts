import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import visionWasmInternalLoaderUrl from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import visionWasmInternalBinaryUrl from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";
import visionWasmNoSimdLoaderUrl from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url";
import visionWasmNoSimdBinaryUrl from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url";
import visionWasmModuleLoaderUrl from "@mediapipe/tasks-vision/vision_wasm_module_internal.js?url";
import visionWasmModuleBinaryUrl from "@mediapipe/tasks-vision/vision_wasm_module_internal.wasm?url";
import { extractVisualObservation, type LandmarkPoint } from "../domain/visual";
import type { VisionWorkerEvent, VisionWorkerRequest } from "../lib/local-vision";

const wasmSelectionBase = "vite-asset-selection";
const modelUrl = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const bundledWasmAssetUrls = {
  "vision_wasm_internal.js": visionWasmInternalLoaderUrl,
  "vision_wasm_internal.wasm": visionWasmInternalBinaryUrl,
  "vision_wasm_nosimd_internal.js": visionWasmNoSimdLoaderUrl,
  "vision_wasm_nosimd_internal.wasm": visionWasmNoSimdBinaryUrl,
  "vision_wasm_module_internal.js": visionWasmModuleLoaderUrl,
  "vision_wasm_module_internal.wasm": visionWasmModuleBinaryUrl,
};

let landmarker: FaceLandmarker | null = null;
let loading: Promise<void> | null = null;
let activeDelegate: "GPU" | "CPU" | null = null;
let lastTimestamp = -1;
let analyzing = false;
let closed = false;

type VisionFileset = { wasmLoaderPath: string; wasmBinaryPath: string };

function assetName(path: string) {
  const segments = path.split("/");
  return segments[segments.length - 1];
}

export async function createVisionFileset<T extends VisionFileset>(
  forVisionTasks: (basePath?: string, useModule?: boolean) => Promise<T>,
  assetUrls: Record<string, string> = bundledWasmAssetUrls,
): Promise<T> {
  const selected = await forVisionTasks(wasmSelectionBase, true);
  const wasmLoaderPath = assetUrls[assetName(selected.wasmLoaderPath) ?? ""];
  const wasmBinaryPath = assetUrls[assetName(selected.wasmBinaryPath) ?? ""];
  if (!wasmLoaderPath || !wasmBinaryPath) {
    throw new Error("找不到相容的 MediaPipe WASM 資產。");
  }
  return { ...selected, wasmLoaderPath, wasmBinaryPath };
}

function post(event: VisionWorkerEvent) {
  self.postMessage(event);
}

function closeBitmap(value: unknown) {
  if (typeof value === "object" && value !== null && "close" in value && typeof value.close === "function") {
    value.close();
  }
}

function isBitmapLike(value: unknown): value is ImageBitmap {
  return typeof value === "object" && value !== null && "close" in value && typeof value.close === "function";
}

async function readModel(): Promise<ArrayBuffer> {
  const response = await fetch(modelUrl);
  if (!response.ok) throw new Error("無法下載本機視覺模型。");

  const contentLength = Number(response.headers.get("content-length"));
  const canReportProgress = Number.isFinite(contentLength) && contentLength > 0 && response.body;
  if (!canReportProgress) {
    post({ type: "loading", progress: null, message: "正在下載本機視覺模型" });
    return response.arrayBuffer();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    chunks.push(next.value);
    received += next.value.byteLength;
    post({ type: "loading", progress: Math.min(1, received / contentLength), message: "正在下載本機視覺模型" });
  }

  const buffer = new Uint8Array(received);
  let offset = 0;
  chunks.forEach((chunk) => {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return buffer.buffer;
}

async function createLandmarker(delegate: "GPU" | "CPU", modelAssetBuffer: ArrayBuffer) {
  const vision = await createVisionFileset(FilesetResolver.forVisionTasks);
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetBuffer: new Uint8Array(modelAssetBuffer), delegate },
    runningMode: "VIDEO",
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });
}

async function load() {
  if (landmarker && activeDelegate) {
    post({ type: "ready", delegate: activeDelegate });
    return;
  }
  if (loading) return loading;

  loading = (async () => {
    try {
      post({ type: "loading", progress: 0, message: "正在準備本機視覺模型" });
      const modelAssetBuffer = await readModel();
      if (closed) return;

      try {
        landmarker = await createLandmarker("GPU", modelAssetBuffer);
        activeDelegate = "GPU";
      } catch {
        landmarker?.close();
        landmarker = null;
        landmarker = await createLandmarker("CPU", modelAssetBuffer);
        activeDelegate = "CPU";
      }
      if (!closed && activeDelegate) post({ type: "ready", delegate: activeDelegate });
    } catch (error) {
      if (!closed) post({ type: "error", message: error instanceof Error ? error.message : "本機視覺模型載入失敗。" });
    } finally {
      loading = null;
    }
  })();
  return loading;
}

function analyze(requestId: string, bitmap: ImageBitmap, requestedTimestamp: unknown) {
  if (analyzing) {
    closeBitmap(bitmap);
    post({ type: "error", requestId, message: "本機視覺觀察忙碌中。" });
    return;
  }

  analyzing = true;
  try {
    if (!landmarker) throw new Error("本機視覺模型尚未載入。");
    const timestampMs = typeof requestedTimestamp === "number" && Number.isFinite(requestedTimestamp) && requestedTimestamp > lastTimestamp
      ? requestedTimestamp
      : lastTimestamp + 1;
    lastTimestamp = timestampMs;
    const result = landmarker.detectForVideo(bitmap, timestampMs);
    const landmarks = result.faceLandmarks[0]?.map(({ x, y }) => ({ x, y } satisfies LandmarkPoint));
    post({
      type: "observation",
      requestId,
      observation: extractVisualObservation(timestampMs, landmarks),
    });
  } catch (error) {
    post({ type: "error", requestId, message: error instanceof Error ? error.message : "本機視覺分析失敗。" });
  } finally {
    analyzing = false;
    closeBitmap(bitmap);
  }
}

self.addEventListener("message", (event: MessageEvent<unknown>) => {
  const value = event.data;
  if (closed || typeof value !== "object" || value === null || !("type" in value)) return;

  const request = value as Partial<VisionWorkerRequest>;
  if (request.type === "load") {
    void load();
    return;
  }

  if (request.type === "close") {
    closed = true;
    landmarker?.close();
    landmarker = null;
    activeDelegate = null;
    return;
  }

  if (request.type === "analyze") {
    if (typeof request.requestId !== "string" || !isBitmapLike(request.bitmap)) {
      closeBitmap(request.bitmap);
      post({ type: "error", message: "本機視覺請求格式無效。" });
      return;
    }
    analyze(request.requestId, request.bitmap, request.timestampMs);
  }
});
