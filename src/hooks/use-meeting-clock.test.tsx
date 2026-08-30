import { act, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { useMeetingClock } from "./use-meeting-clock";

test("uses monotonic elapsed time and completes exactly once", () => {
  vi.useFakeTimers(); let now = 1000; const onTick = vi.fn(); const onComplete = vi.fn();
  const { result, unmount } = renderHook(() => useMeetingClock({ durationSeconds: 2, onTick, onComplete, now: () => now, intervalMs: 250 }));
  now = 2100; act(() => vi.advanceTimersByTime(250)); expect(result.current.elapsedSeconds).toBe(1);
  now = 4000; act(() => vi.advanceTimersByTime(500)); expect(result.current.elapsedSeconds).toBe(2); expect(onComplete).toHaveBeenCalledOnce();
  unmount(); vi.useRealTimers();
});
