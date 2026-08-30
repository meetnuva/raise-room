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

test("recreates an owned client after the StrictMode effect lifecycle", () => {
  const first = asr(); const second = asr(); const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
  const { result } = renderHook(() => useLocalVoice({ asrClientFactory: factory }), { reactStrictMode: true });
  act(() => result.current.loadModel());
  expect(factory).toHaveBeenCalledTimes(2); expect(second.load).toHaveBeenCalledOnce();
  act(() => second.emit({ type: "ready", device: "wasm" })); expect(result.current.status).toBe("ready");
});

test("transcribes final recorder data locally and releases every temporary resource", async () => {
  let now = 1_000; const client = asr(); const stopTrack = vi.fn(); const close = vi.fn().mockResolvedValue(undefined);
  const transcribe = vi.fn().mockImplementation(async () => { expect(stopTrack).toHaveBeenCalledBefore(transcribe); return " 本機文字 "; }); client.transcribe = transcribe;
  const listeners = new Map<string, (event: { data: Blob }) => void>();
  const recorder = { state: "recording", mimeType: "audio/webm", start: vi.fn(), addEventListener: vi.fn((type, listener) => listeners.set(type, listener as never)), removeEventListener: vi.fn(), stop: vi.fn(() => { listeners.get("dataavailable")?.({ data: new Blob(["audio"]) }); listeners.get("stop")?.({ data: new Blob() }); }) } as unknown as MediaRecorder;
  const context = { decodeAudioData: vi.fn().mockResolvedValue({ getChannelData: () => new Float32Array(16_000) }), close } as unknown as AudioContext;
  const { result } = renderHook(() => useLocalVoice({ asrClient: client, mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) }, mediaRecorderFactory: () => recorder, audioContextFactory: () => context, now: () => now }));
  act(() => client.emit({ type: "ready", device: "wasm" })); await act(() => result.current.startRecording()); now = 6_000;
  let received: Awaited<ReturnType<typeof result.current.stopAndTranscribe>> | undefined = undefined; await act(async () => { received = await result.current.stopAndTranscribe(); });
  expect(received).toEqual({ text: "本機文字", durationSeconds: 5, language: "zh" }); expect(transcribe).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce(); expect(result.current.status).toBe("ready");
});

test("returns null for an empty local transcript and still cleans up", async () => {
  let now = 0; const client = asr(); client.transcribe = vi.fn().mockResolvedValue("   "); const stopTrack = vi.fn(); const close = vi.fn().mockResolvedValue(undefined);
  const listeners = new Map<string, (event: { data: Blob }) => void>(); const recorder = { state: "recording", mimeType: "audio/webm", start: vi.fn(), addEventListener: vi.fn((type, listener) => listeners.set(type, listener as never)), removeEventListener: vi.fn(), stop: vi.fn(() => { listeners.get("dataavailable")?.({ data: new Blob(["audio"]) }); listeners.get("stop")?.({ data: new Blob() }); }) } as unknown as MediaRecorder;
  const { result } = renderHook(() => useLocalVoice({ asrClient: client, mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) }, mediaRecorderFactory: () => recorder, audioContextFactory: () => ({ decodeAudioData: vi.fn().mockResolvedValue({ getChannelData: () => new Float32Array(1) }), close } as unknown as AudioContext), now: () => now }));
  act(() => client.emit({ type: "ready", device: "wasm" })); await act(() => result.current.startRecording()); now = 1_000;
  let received: Awaited<ReturnType<typeof result.current.stopAndTranscribe>> | undefined = undefined; await act(async () => { received = await result.current.stopAndTranscribe(); }); expect(received).toBeNull(); expect(stopTrack).toHaveBeenCalled(); expect(close).toHaveBeenCalledOnce(); expect(result.current.status).toBe("ready");
});
