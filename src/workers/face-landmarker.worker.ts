import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { extractVisualObservation, type LandmarkPoint } from "../domain/visual";
import type { VisionWorkerEvent, VisionWorkerRequest } from "../lib/local-vision";

const wasmBase = "/mediapipe/wasm";
const modelUrl = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarker: FaceLandmarker | null = null;
let loading: Promise<void> | null = null;
let activeDelegate: "GPU" | "CPU" | null = null;
let lastTimestamp = -1;
let analyzing = false;
let closed = false;

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
  const vision = await FilesetResolver.forVisionTasks(wasmBase);
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
