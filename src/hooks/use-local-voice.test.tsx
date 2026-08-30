import { act, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { useLocalVoice } from "./use-local-voice";
import type { LocalAsrClient } from "../lib/local-asr";

function asr(): LocalAsrClient & { emit(event: { type: "ready"; device: "wasm" } | { type: "loading"; progress: number | null; message: string } | { type: "error"; message: string }): void } {
  let listener = (_event: never) => {}; return {
    subscribe: vi.fn((next) => { listener = next as never; return () => {}; }), load: vi.fn(), destroy: vi.fn(),
    transcribe: vi.fn().mockResolvedValue(" 本機文字 "), emit: (event) => listener(event as never),
  };
}

test("never loads a model or microphone until explicit actions, then releases tracks before transcription", async () => {
  const client = asr(); const stop = vi.fn(); const recorder = { state: "recording", start: vi.fn(), stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaRecorder;
  const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
  const { result } = renderHook(() => useLocalVoice({ modelPreset: "quality", asrClient: client, mediaDevices: { getUserMedia }, mediaRecorderFactory: () => recorder, now: () => 10_000 }));
  expect(client.load).not.toHaveBeenCalled(); expect(getUserMedia).not.toHaveBeenCalled();
  act(() => result.current.loadModel()); expect(client.load).toHaveBeenCalledExactlyOnceWith("quality"); act(() => client.emit({ type: "ready", device: "wasm" }));
  await act(() => result.current.startRecording()); expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
  await act(() => result.current.cancel()); expect(stop).toHaveBeenCalled();
});

test("shows denied permission without automatic retry", async () => {
  const client = asr(); const getUserMedia = vi.fn().mockRejectedValue(new DOMException("no", "NotAllowedError"));
  const { result } = renderHook(() => useLocalVoice({ modelPreset: "fast", asrClient: client, mediaDevices: { getUserMedia } }));
  act(() => client.emit({ type: "ready", device: "wasm" })); await act(() => result.current.startRecording());
  expect(result.current.status).toBe("denied"); expect(getUserMedia).toHaveBeenCalledOnce();
});

test("keeps the worker loading message only for the active model lifecycle", () => {
  const client = asr();
  const { result } = renderHook(() => useLocalVoice({ modelPreset: "fast", asrClient: client }));
  act(() => client.emit({ type: "loading", progress: 0.42, message: "快速模型 · WebGPU" }));
  expect(result.current.loadingMessage).toBe("快速模型 · WebGPU");
  act(() => client.emit({ type: "ready", device: "wasm" }));
  expect(result.current.loadingMessage).toBeNull();
  act(() => client.emit({ type: "loading", progress: null, message: "快速模型 · WASM" }));
  act(() => client.emit({ type: "error", message: "下載失敗" }));
  expect(result.current.loadingMessage).toBeNull();
  act(() => result.current.releaseModel());
  expect(result.current.loadingMessage).toBeNull();
});

test("recreates an owned client after the StrictMode effect lifecycle", () => {
  const first = asr(); const second = asr(); const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
  const { result } = renderHook(() => useLocalVoice({ modelPreset: "fast", asrClientFactory: factory }), { reactStrictMode: true });
  act(() => result.current.loadModel());
  expect(factory).toHaveBeenCalledTimes(2); expect(second.load).toHaveBeenCalledExactlyOnceWith("fast");
  act(() => second.emit({ type: "ready", device: "wasm" })); expect(result.current.status).toBe("ready");
});

test("transcribes final recorder data locally and releases every temporary resource", async () => {
  let now = 1_000; const client = asr(); const stopTrack = vi.fn(); const close = vi.fn().mockResolvedValue(undefined);
  const transcribe = vi.fn().mockImplementation(async () => { expect(stopTrack).toHaveBeenCalledBefore(transcribe); return " 本機文字 "; }); client.transcribe = transcribe;
  const listeners = new Map<string, (event: { data: Blob }) => void>();
  const recorder = { state: "recording", mimeType: "audio/webm", start: vi.fn(), addEventListener: vi.fn((type, listener) => listeners.set(type, listener as never)), removeEventListener: vi.fn(), stop: vi.fn(() => { listeners.get("dataavailable")?.({ data: new Blob(["audio"]) }); listeners.get("stop")?.({ data: new Blob() }); }) } as unknown as MediaRecorder;
  const context = { decodeAudioData: vi.fn().mockResolvedValue({ getChannelData: () => new Float32Array(16_000) }), close } as unknown as AudioContext;
  const { result } = renderHook(() => useLocalVoice({ modelPreset: "quality", asrClient: client, mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) }, mediaRecorderFactory: () => recorder, audioContextFactory: () => context, now: () => now }));
  act(() => client.emit({ type: "ready", device: "wasm" })); await act(() => result.current.startRecording()); now = 6_000;
  let received: Awaited<ReturnType<typeof result.current.stopAndTranscribe>> | undefined = undefined; await act(async () => { received = await result.current.stopAndTranscribe(); });
  expect(received).toEqual({ rawText: "本機文字", text: "本機文字", durationSeconds: 5, language: "zh", modelPreset: "quality" }); expect(transcribe).toHaveBeenCalledExactlyOnceWith(expect.any(Float32Array), "zh", "quality"); expect(close).toHaveBeenCalledOnce(); expect(result.current.status).toBe("ready");
});

test("returns null for an empty local transcript and still cleans up", async () => {
  let now = 0; const client = asr(); client.transcribe = vi.fn().mockResolvedValue("   "); const stopTrack = vi.fn(); const close = vi.fn().mockResolvedValue(undefined);
  const listeners = new Map<string, (event: { data: Blob }) => void>(); const recorder = { state: "recording", mimeType: "audio/webm", start: vi.fn(), addEventListener: vi.fn((type, listener) => listeners.set(type, listener as never)), removeEventListener: vi.fn(), stop: vi.fn(() => { listeners.get("dataavailable")?.({ data: new Blob(["audio"]) }); listeners.get("stop")?.({ data: new Blob() }); }) } as unknown as MediaRecorder;
  const { result } = renderHook(() => useLocalVoice({ modelPreset: "quality", asrClient: client, mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) }, mediaRecorderFactory: () => recorder, audioContextFactory: () => ({ decodeAudioData: vi.fn().mockResolvedValue({ getChannelData: () => new Float32Array(1) }), close } as unknown as AudioContext), now: () => now }));
  act(() => client.emit({ type: "ready", device: "wasm" })); await act(() => result.current.startRecording()); now = 1_000;
  let received: Awaited<ReturnType<typeof result.current.stopAndTranscribe>> | undefined = undefined; await act(async () => { received = await result.current.stopAndTranscribe(); }); expect(received).toBeNull(); expect(stopTrack).toHaveBeenCalled(); expect(close).toHaveBeenCalledOnce(); expect(result.current.status).toBe("ready");
});

test("releases an owned model before switching preset and can recreate it after explicit release", () => {
  const first = asr(); const second = asr(); const third = asr();
  const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second).mockReturnValueOnce(third);
  const { result, rerender } = renderHook(({ modelPreset }: { modelPreset: "fast" | "balanced" }) => useLocalVoice({ modelPreset, asrClientFactory: factory }), { initialProps: { modelPreset: "fast" as "fast" | "balanced" } });
  act(() => result.current.loadModel());
  expect(first.load).toHaveBeenCalledExactlyOnceWith("fast");
  rerender({ modelPreset: "balanced" });
  expect(first.destroy).toHaveBeenCalledOnce();
  act(() => result.current.loadModel());
  expect(second.load).toHaveBeenCalledExactlyOnceWith("balanced");
  act(() => result.current.releaseModel());
  expect(second.destroy).toHaveBeenCalledOnce();
  act(() => result.current.loadModel());
  expect(third.load).toHaveBeenCalledExactlyOnceWith("balanced");
});

test("subscribes to a recreated owned client after explicit model release", () => {
  const first = asr();
  const second = asr();
  const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
  const { result } = renderHook(() => useLocalVoice({ modelPreset: "fast", asrClientFactory: factory }));

  act(() => result.current.loadModel());
  expect(first.subscribe).toHaveBeenCalledOnce();
  act(() => result.current.releaseModel());
  expect(first.destroy).toHaveBeenCalledOnce();

  act(() => result.current.loadModel());
  expect(second.subscribe).toHaveBeenCalledOnce();
  expect(second.load).toHaveBeenCalledExactlyOnceWith("fast");
  act(() => second.emit({ type: "loading", progress: 0.4, message: "快速模型（fast）· WebGPU" }));
  expect(result.current.loadingMessage).toBe("快速模型（fast）· WebGPU");
  act(() => second.emit({ type: "ready", device: "wasm" }));
  expect(result.current).toMatchObject({ status: "ready", device: "wasm", loadingMessage: null });
});

function sharedAudioStream(input?: { enabled?: boolean; readyState?: MediaStreamTrackState }) {
  const track = { kind: "audio", enabled: input?.enabled ?? true, readyState: input?.readyState ?? "live", stop: vi.fn() } as unknown as MediaStreamTrack;
  return { stream: { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream, track };
}

function recorderThatFinishes() {
  const listeners = new Map<string, (event: { data: Blob }) => void>();
  return {
    state: "recording",
    mimeType: "audio/webm",
    start: vi.fn(),
    addEventListener: vi.fn((type, listener) => listeners.set(type, listener as never)),
    removeEventListener: vi.fn(),
    stop: vi.fn(() => {
      listeners.get("dataavailable")?.({ data: new Blob(["audio"]) });
      listeners.get("stop")?.({ data: new Blob() });
    }),
  } as unknown as MediaRecorder;
}

test("reuses an enabled shared audio stream across recording turns without requesting or stopping it", async () => {
  const client = asr(); const { stream, track } = sharedAudioStream(); const getUserMedia = vi.fn(); const recorderFactory = vi.fn(() => recorderThatFinishes());
  const contextFactory = vi.fn(() => ({ decodeAudioData: vi.fn().mockResolvedValue({ getChannelData: () => new Float32Array(1) }), close: vi.fn().mockResolvedValue(undefined) } as unknown as AudioContext));
  const { result } = renderHook(() => useLocalVoice({ modelPreset: "fast", asrClient: client, sharedAudioStream: stream, mediaDevices: { getUserMedia }, mediaRecorderFactory: recorderFactory, audioContextFactory: contextFactory }));

  act(() => client.emit({ type: "ready", device: "wasm" }));
  await act(() => result.current.startRecording());
  await act(async () => { await result.current.stopAndTranscribe(); });
  await act(() => result.current.startRecording());
  act(() => result.current.cancel());

  expect(getUserMedia).not.toHaveBeenCalled();
  expect(recorderFactory).toHaveBeenCalledTimes(2);
  expect(track.stop).not.toHaveBeenCalled();
});

test("falls back to an owned audio stream only when no shared stream was supplied", async () => {
  const client = asr(); const { stream } = sharedAudioStream(); const getUserMedia = vi.fn().mockResolvedValue(stream);
  const { result } = renderHook(() => useLocalVoice({ modelPreset: "fast", asrClient: client, sharedAudioStream: null, mediaDevices: { getUserMedia }, mediaRecorderFactory: () => recorderThatFinishes() }));

  act(() => client.emit({ type: "ready", device: "wasm" }));
  await act(() => result.current.startRecording());

  expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({ audio: true, video: false });
});

test("does not request a second microphone when the shared audio track is disabled", async () => {
  const client = asr(); const { stream } = sharedAudioStream({ enabled: false }); const getUserMedia = vi.fn();
  const { result } = renderHook(() => useLocalVoice({ modelPreset: "fast", asrClient: client, sharedAudioStream: stream, mediaDevices: { getUserMedia }, mediaRecorderFactory: () => recorderThatFinishes() }));

  act(() => client.emit({ type: "ready", device: "wasm" }));
  await act(() => result.current.startRecording());

  expect(getUserMedia).not.toHaveBeenCalled();
  expect(result.current).toMatchObject({ status: "error", errorMessage: "麥克風目前未啟用，請先開啟麥克風。" });
});

test("does not request a second microphone when the shared audio track has ended", async () => {
  const client = asr(); const { stream } = sharedAudioStream({ readyState: "ended" }); const getUserMedia = vi.fn();
  const { result } = renderHook(() => useLocalVoice({ modelPreset: "fast", asrClient: client, sharedAudioStream: stream, mediaDevices: { getUserMedia }, mediaRecorderFactory: () => recorderThatFinishes() }));

  act(() => client.emit({ type: "ready", device: "wasm" }));
  await act(() => result.current.startRecording());

  expect(getUserMedia).not.toHaveBeenCalled();
  expect(result.current).toMatchObject({ status: "error", errorMessage: "麥克風目前未啟用，請先開啟麥克風。" });
});

test("releaseModel destroys ASR resources without stopping a shared audio track", () => {
  const client = asr(); const { stream, track } = sharedAudioStream();
  const { result } = renderHook(() => useLocalVoice({ modelPreset: "fast", asrClientFactory: () => client, sharedAudioStream: stream }));

  act(() => result.current.releaseModel());

  expect(client.destroy).toHaveBeenCalledOnce();
  expect(track.stop).not.toHaveBeenCalled();
});
