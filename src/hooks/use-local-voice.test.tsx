import { act, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { useLocalVoice } from "./use-local-voice";
import type { LocalAsrClient } from "../lib/local-asr";

function asr(): LocalAsrClient & { emit(event: { type: "ready"; device: "wasm" }): void } {
  let listener = (_event: never) => {}; return {
    subscribe: vi.fn((next) => { listener = next as never; return () => {}; }), load: vi.fn(), destroy: vi.fn(),
    transcribe: vi.fn().mockResolvedValue(" 本機文字 "), emit: (event) => listener(event as never),
  };
}

test("never loads a model or microphone until explicit actions, then releases tracks before transcription", async () => {
  const client = asr(); const stop = vi.fn(); const recorder = { state: "recording", start: vi.fn(), stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaRecorder;
  const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
  const { result } = renderHook(() => useLocalVoice({ asrClient: client, mediaDevices: { getUserMedia }, mediaRecorderFactory: () => recorder, now: () => 10_000 }));
  expect(client.load).not.toHaveBeenCalled(); expect(getUserMedia).not.toHaveBeenCalled();
  act(() => result.current.loadModel()); expect(client.load).toHaveBeenCalledOnce(); act(() => client.emit({ type: "ready", device: "wasm" }));
  await act(() => result.current.startRecording()); expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
  await act(() => result.current.cancel()); expect(stop).toHaveBeenCalled();
});

test("shows denied permission without automatic retry", async () => {
  const client = asr(); const getUserMedia = vi.fn().mockRejectedValue(new DOMException("no", "NotAllowedError"));
  const { result } = renderHook(() => useLocalVoice({ asrClient: client, mediaDevices: { getUserMedia } }));
  act(() => client.emit({ type: "ready", device: "wasm" })); await act(() => result.current.startRecording());
  expect(result.current.status).toBe("denied"); expect(getUserMedia).toHaveBeenCalledOnce();
});
