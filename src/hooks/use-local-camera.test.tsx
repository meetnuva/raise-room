import { act, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { useLocalCamera } from "./use-local-camera";

test("does not request then starts the exact local-preview constraints and stops tracks", async () => {
  const stop = vi.fn();
  const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
  const { result, unmount } = renderHook(() => useLocalCamera({ mediaDevices: { getUserMedia } }));
  expect(getUserMedia).not.toHaveBeenCalled();
  await act(() => result.current.start());
  expect(getUserMedia).toHaveBeenCalledWith({ audio: false, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } });
  expect(result.current.status).toBe("active");
  unmount();
  expect(stop).toHaveBeenCalledOnce();
});

test("makes a declined permission visible", async () => {
  const getUserMedia = vi.fn().mockRejectedValue(new DOMException("no", "NotAllowedError"));
  const { result } = renderHook(() => useLocalCamera({ mediaDevices: { getUserMedia } }));
  await act(() => result.current.start());
  expect(result.current.status).toBe("denied");
});
