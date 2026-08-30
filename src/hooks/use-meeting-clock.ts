import { useEffect, useRef, useState } from "react";

export function useMeetingClock(input: { durationSeconds: number; onTick(elapsedSeconds: number): void; onComplete(): void; now?: () => number; intervalMs?: number }): { elapsedSeconds: number } {
  const [elapsedSeconds, setElapsedSeconds] = useState(0); const tick = useRef(input.onTick); const complete = useRef(input.onComplete); const nowRef = useRef(input.now);
  useEffect(() => { tick.current = input.onTick; complete.current = input.onComplete; nowRef.current = input.now; });
  useEffect(() => {
    const now = () => (nowRef.current ?? performance.now.bind(performance))(); const start = now(); let last = -1; let finished = false;
    const update = () => { const elapsed = Math.min(input.durationSeconds, Math.max(0, Math.floor((now() - start) / 1000))); setElapsedSeconds(elapsed); if (elapsed !== last) { last = elapsed; tick.current(elapsed); } if (elapsed >= input.durationSeconds && !finished) { finished = true; complete.current(); } };
    update(); const timer = window.setInterval(update, input.intervalMs ?? 250); return () => window.clearInterval(timer);
  }, [input.durationSeconds, input.intervalMs]);
  return { elapsedSeconds };
}
