import { act, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { usePracticeMedia } from "./use-practice-media";

function fakeTrack(kind: "audio" | "video") {
  return { kind, enabled: true, readyState: "live", stop: vi.fn() } as unknown as MediaStreamTrack;
}

function fakeStream() {
  const audio = fakeTrack("audio");
  const video = fakeTrack("video");
  return {
    stream: {
      getTracks: () => [audio, video],
      getAudioTracks: () => [audio],
      getVideoTracks: () => [video],
    } as unknown as MediaStream,
    audio,
    video,
  };
}

test("requests one audio-video stream only after explicit action", async () => {
  const { stream } = fakeStream();
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  const { result } = renderHook(() => usePracticeMedia({ mediaDevices: { getUserMedia } }));

  expect(getUserMedia).not.toHaveBeenCalled();
  await act(async () => result.current.request());

  expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({
    audio: true,
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  expect(result.current).toMatchObject({ status: "active", stream, cameraEnabled: true, microphoneEnabled: true });

  await act(async () => result.current.request());
  expect(getUserMedia).toHaveBeenCalledOnce();
});

test("toggles tracks without stopping them and dispose stops each session track once", async () => {
  const { stream, audio, video } = fakeStream();
  const { result } = renderHook(() => usePracticeMedia({ mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } }));

  await act(async () => result.current.request());
  act(() => result.current.toggleCamera());
  act(() => result.current.toggleMicrophone());

  expect(video.enabled).toBe(false);
  expect(audio.enabled).toBe(false);
  expect(video.stop).not.toHaveBeenCalled();
  expect(audio.stop).not.toHaveBeenCalled();

  act(() => result.current.dispose());
  act(() => result.current.dispose());
  expect(video.stop).toHaveBeenCalledOnce();
  expect(audio.stop).toHaveBeenCalledOnce();
  expect(result.current).toMatchObject({ status: "idle", stream: null, cameraEnabled: false, microphoneEnabled: false });
});

test("exposes a denied media permission", async () => {
  const getUserMedia = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
  const { result } = renderHook(() => usePracticeMedia({ mediaDevices: { getUserMedia } }));

  await act(async () => result.current.request());

  expect(result.current).toMatchObject({ status: "denied", errorMessage: "你尚未允許相機與麥克風權限。" });
});

test("StrictMode unmount cleans the current session once without retaining a stale stream", async () => {
  const { stream, audio, video } = fakeStream();
  const { result, unmount } = renderHook(
    () => usePracticeMedia({ mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } }),
    { reactStrictMode: true },
  );

  await act(async () => result.current.request());
  unmount();

  expect(audio.stop).toHaveBeenCalledOnce();
  expect(video.stop).toHaveBeenCalledOnce();
});
