import { expect, test, vi } from "vitest";
import {
  createLocalVisionClient,
  parseVisionWorkerEvent,
  type VisionWorkerPort,
} from "./local-vision";

function fakeWorker(): VisionWorkerPort & { emit(value: unknown): void } {
  let listener: ((event: MessageEvent<unknown>) => void) | undefined;
  return {
    postMessage: vi.fn(),
    addEventListener: vi.fn((_type, next) => { listener = next; }),
    removeEventListener: vi.fn(),
    terminate: vi.fn(),
    emit: (value) => listener?.({ data: value } as MessageEvent<unknown>),
  };
}

const observation = {
  timestampMs: 10,
  hasFace: true,
  faceCenterX: 0.5,
  faceCenterY: 0.5,
  faceAreaRatio: 0.2,
  irisHorizontalOffset: 0.2,
};

test("rejects malformed worker events at the local vision boundary", () => {
  expect(parseVisionWorkerEvent({ type: "ready", delegate: "webgpu" })).toBeNull();
  expect(parseVisionWorkerEvent({ type: "loading", progress: 2, message: "x" })).toBeNull();
  expect(parseVisionWorkerEvent({ type: "observation", requestId: "a", observation: { ...observation, faceAreaRatio: 2 } })).toBeNull();
  expect(parseVisionWorkerEvent({ type: "observation", requestId: "a", observation })).toEqual({
    type: "observation", requestId: "a", observation,
  });
});

test("loads, transfers a bitmap, correlates observations, and forwards validated events", async () => {
  const worker = fakeWorker();
  const client = createLocalVisionClient(() => worker);
  const listener = vi.fn();
  client.subscribe(listener);
  client.load();
  expect(worker.postMessage).toHaveBeenCalledWith({ type: "load" });

  const bitmap = {} as ImageBitmap;
  const pending = client.analyze(bitmap, 10);
  const call = vi.mocked(worker.postMessage).mock.calls[1];
  expect(call[0]).toMatchObject({ type: "analyze", timestampMs: 10 });
  expect(call[1]).toEqual([bitmap]);
  worker.emit({ type: "observation", requestId: (call[0] as { requestId: string }).requestId, observation });

  await expect(pending).resolves.toEqual(observation);
  expect(listener).toHaveBeenCalledWith({ type: "observation", requestId: (call[0] as { requestId: string }).requestId, observation });
});

test("rejects matching worker errors and closes pending work on destroy", async () => {
  const worker = fakeWorker();
  const client = createLocalVisionClient(() => worker);
  const first = client.analyze({} as ImageBitmap, 10);
  const firstCall = vi.mocked(worker.postMessage).mock.calls[0][0] as { requestId: string };
  worker.emit({ type: "error", requestId: firstCall.requestId, message: "分析失敗" });
  await expect(first).rejects.toThrow("分析失敗");

  const pending = client.analyze({} as ImageBitmap, 20);
  client.destroy();
  await expect(pending).rejects.toThrow("已關閉");
  expect(worker.postMessage).toHaveBeenCalledWith({ type: "close" });
  expect(worker.terminate).toHaveBeenCalledOnce();
});
