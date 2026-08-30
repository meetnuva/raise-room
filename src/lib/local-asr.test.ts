import { expect, test, vi } from "vitest";
import { createLocalAsrClient, parseAsrWorkerEvent, type WorkerPort } from "./local-asr";

function fakeWorker(): WorkerPort & { emit(value: unknown): void } {
  let listener: ((event: MessageEvent<unknown>) => void) | undefined;
  return {
    postMessage: vi.fn(), addEventListener: vi.fn((_type, next) => { listener = next; }),
    removeEventListener: vi.fn(), terminate: vi.fn(), emit: (value) => listener?.({ data: value } as MessageEvent<unknown>),
  };
}

test("rejects malformed worker data at the boundary", () => {
  expect(parseAsrWorkerEvent({ type: "ready", device: "gpu" })).toBeNull();
  expect(parseAsrWorkerEvent({ type: "loading", progress: 2, message: "x" })).toBeNull();
  expect(parseAsrWorkerEvent({ type: "complete", requestId: "a", text: "好" })).toEqual({ type: "complete", requestId: "a", text: "好" });
});

test("correlates requests, transfers audio, errors and destroys pending work", async () => {
  const worker = fakeWorker(); const client = createLocalAsrClient(() => worker);
  client.load(); expect(worker.postMessage).toHaveBeenCalledWith({ type: "load" });
  const promise = client.transcribe(new Float32Array([0]), "zh");
  const call = vi.mocked(worker.postMessage).mock.calls[1];
  expect(call[0]).toMatchObject({ type: "transcribe", language: "zh" }); expect(call[1]).toHaveLength(1);
  worker.emit({ type: "complete", requestId: (call[0] as { requestId: string }).requestId, text: "完成" });
  await expect(promise).resolves.toBe("完成");
  const pending = client.transcribe(new Float32Array([1]), "en"); client.destroy();
  await expect(pending).rejects.toThrow("已關閉"); expect(worker.terminate).toHaveBeenCalledOnce();
});
