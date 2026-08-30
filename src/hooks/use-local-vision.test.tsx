import { act, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { VisualFrameObservation } from "../domain/visual";
import type { LocalVisionClient, VisionWorkerEvent } from "../lib/local-vision";
import { useLocalVision } from "./use-local-vision";

const observation: VisualFrameObservation = {
  timestampMs: 10,
  hasFace: true,
  faceCenterX: 0.5,
  faceCenterY: 0.5,
  faceAreaRatio: 0.2,
  irisHorizontalOffset: 0.2,
};

function fakeClient(): LocalVisionClient & { emit(event: VisionWorkerEvent): void; resolve?: (value: VisualFrameObservation) => void } {
  const listeners = new Set<(event: VisionWorkerEvent) => void>();
  const client: LocalVisionClient & { emit(event: VisionWorkerEvent): void; resolve?: (value: VisualFrameObservation) => void } = {
    subscribe: vi.fn((listener) => { listeners.add(listener); return () => listeners.delete(listener); }),
    load: vi.fn(),
    analyze: vi.fn(() => new Promise<VisualFrameObservation>((resolve) => { client.resolve = resolve; })),
    destroy: vi.fn(),
    emit: (event) => listeners.forEach((listener) => listener(event)),
  };
  return client;
}

function readyVideo() {
  const video = document.createElement("video");
  Object.defineProperty(video, "srcObject", { value: {}, configurable: true });
  Object.defineProperty(video, "readyState", { value: 2, configurable: true });
  return video;
}

test("does not load a model or read a frame on mount", () => {
  const client = fakeClient();
  const createBitmap = vi.fn();
  renderHook(() => useLocalVision({ videoElement: readyVideo(), client, createBitmap }));
  expect(client.load).not.toHaveBeenCalled();
  expect(createBitmap).not.toHaveBeenCalled();
});

test("loads only after an explicit action and reports camera readiness errors", () => {
  const client = fakeClient();
  const { result } = renderHook(() => useLocalVision({ videoElement: null, client }));
  act(() => result.current.loadModel());
  expect(client.load).toHaveBeenCalledOnce();
  act(() => client.emit({ type: "ready", delegate: "CPU" }));
  expect(result.current.status).toBe("ready");
  act(() => result.current.startObserving());
  expect(result.current.errorMessage).toBe("請先開啟並準備好本機鏡頭。");
});

test("samples at five fps with one in-flight bitmap and keeps only aggregate signals", async () => {
  vi.useFakeTimers();
  const client = fakeClient();
  const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
  const { result } = renderHook(() => useLocalVision({
    videoElement: readyVideo(), client, createBitmap: vi.fn().mockResolvedValue(bitmap), now: () => 10,
  }));
  act(() => { client.emit({ type: "ready", delegate: "CPU" }); result.current.startObserving(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(client.analyze).toHaveBeenCalledOnce();
  await act(async () => { await vi.advanceTimersByTimeAsync(400); });
  expect(client.analyze).toHaveBeenCalledOnce();
  await act(async () => { client.resolve?.(observation); });
  expect(result.current.signals).toMatchObject({ sampleCount: 1, faceVisibleRatio: 1 });
  expect(result.current.lastObservation).toEqual(observation);
  act(() => result.current.stopObserving());
  expect(result.current.status).toBe("ready");
  act(() => result.current.resetSignals());
  expect(result.current.signals.sampleCount).toBe(0);
  vi.useRealTimers();
});

test("closes a bitmap created after observing stops", async () => {
  let resolveBitmap = (_value: ImageBitmap) => {};
  const pendingBitmap = new Promise<ImageBitmap>((resolve) => { resolveBitmap = resolve; });
  const client = fakeClient();
  const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
  vi.useFakeTimers();
  const { result } = renderHook(() => useLocalVision({ videoElement: readyVideo(), client, createBitmap: () => pendingBitmap }));
  act(() => { client.emit({ type: "ready", delegate: "CPU" }); result.current.startObserving(); vi.advanceTimersByTime(200); result.current.stopObserving(); });
  await act(async () => { resolveBitmap(bitmap); await Promise.resolve(); });
  expect(bitmap.close).toHaveBeenCalledOnce();
  expect(client.analyze).not.toHaveBeenCalled();
  vi.useRealTimers();
});

test("recreates an owned client after StrictMode cleanup but never destroys an injected client", () => {
  const factory = vi.fn(fakeClient);
  const { unmount } = renderHook(() => useLocalVision({ videoElement: null, clientFactory: factory }));
  expect(factory).toHaveBeenCalledOnce();
  unmount();
  expect(factory.mock.results[0].value.destroy).toHaveBeenCalledOnce();

  const injected = fakeClient();
  const injectedHook = renderHook(() => useLocalVision({ videoElement: null, client: injected, clientFactory: factory }));
  injectedHook.unmount();
  expect(injected.destroy).not.toHaveBeenCalled();
});
