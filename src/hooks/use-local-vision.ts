import { useCallback, useEffect, useRef, useState } from "react";
import {
  addVisualObservation,
  createVisualAggregate,
  toVisualSignals,
  type VisualAggregate,
  type VisualFrameObservation,
  type VisualSignals,
} from "../domain/visual";
import { createLocalVisionClient, type LocalVisionClient } from "../lib/local-vision";

export type VisionStatus =
  | "idle"
  | "loading-model"
  | "ready"
  | "observing"
  | "unsupported"
  | "error";

type LocalVisionInput = {
  videoElement: HTMLVideoElement | null;
  client?: LocalVisionClient;
  clientFactory?: () => LocalVisionClient;
  createBitmap?: (source: HTMLVideoElement) => Promise<ImageBitmap>;
  now?: () => number;
  sampleIntervalMs?: number;
};

const defaultNow = () => performance.now();

export function useLocalVision(input: LocalVisionInput): {
  status: VisionStatus;
  progress: number | null;
  lastObservation: VisualFrameObservation | null;
  signals: VisualSignals;
  errorMessage: string | null;
  loadModel(): void;
  startObserving(): void;
  stopObserving(): void;
  resetSignals(): void;
  getSignals(): VisualSignals;
} {
  const clientRef = useRef<LocalVisionClient | null>(input.client ?? null);
  const injectedClient = useRef(Boolean(input.client));
  const clientFactory = useRef(input.clientFactory ?? createLocalVisionClient);
  const mounted = useRef(true);
  const observing = useRef(false);
  const inFlight = useRef(false);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const aggregate = useRef<VisualAggregate>(createVisualAggregate());
  const statusRef = useRef<VisionStatus>(
    input.client || input.clientFactory || typeof Worker !== "undefined" ? "idle" : "unsupported",
  );

  const [status, setStatusState] = useState<VisionStatus>(statusRef.current);
  const [progress, setProgress] = useState<number | null>(null);
  const [lastObservation, setLastObservation] = useState<VisualFrameObservation | null>(null);
  const [signals, setSignals] = useState<VisualSignals>(() => toVisualSignals(aggregate.current));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setStatus = useCallback((next: VisionStatus) => {
    statusRef.current = next;
    if (mounted.current) setStatusState(next);
  }, []);

  const getClient = useCallback(() => {
    if (!clientRef.current && !injectedClient.current) {
      clientRef.current = clientFactory.current();
    }
    return clientRef.current;
  }, []);

  const stopObserving = useCallback(() => {
    observing.current = false;
    if (interval.current !== null) {
      clearInterval(interval.current);
      interval.current = null;
    }
    if (statusRef.current === "observing") setStatus("ready");
  }, [setStatus]);

  useEffect(() => {
    mounted.current = true;
    const client = getClient();
    if (!client) {
      setStatus("unsupported");
      setErrorMessage("此瀏覽器不支援本機視覺觀察。");
      return undefined;
    }

    const unsubscribe = client.subscribe((event) => {
      if (!mounted.current) return;
      if (event.type === "loading") {
        setStatus("loading-model");
        setProgress(event.progress);
      }
      if (event.type === "ready") {
        setStatus("ready");
        setProgress(null);
        setErrorMessage(null);
      }
      if (event.type === "error") {
        stopObserving();
        setStatus("error");
        setErrorMessage(event.message);
      }
    });

    return () => {
      mounted.current = false;
      stopObserving();
      unsubscribe();
      if (!injectedClient.current && clientRef.current === client) {
        client.destroy();
        clientRef.current = null;
      }
    };
  }, [getClient, setStatus, stopObserving]);

  const loadModel = useCallback(() => {
    const client = getClient();
    if (!client) {
      setStatus("unsupported");
      setErrorMessage("此瀏覽器不支援本機視覺觀察。");
      return;
    }
    setStatus("loading-model");
    setProgress(null);
    setErrorMessage(null);
    client.load();
  }, [getClient, setStatus]);

  const sampleFrame = useCallback(async () => {
    if (!observing.current || inFlight.current) return;
    const video = input.videoElement;
    if (!video) return;

    const createBitmap = input.createBitmap ?? globalThis.createImageBitmap;
    if (typeof createBitmap !== "function") {
      stopObserving();
      setStatus("unsupported");
      setErrorMessage("此瀏覽器不支援本機影格處理。");
      return;
    }

    inFlight.current = true;
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createBitmap(video);
      if (!observing.current || !mounted.current) {
        bitmap.close();
        return;
      }
      const observation = await getClient()?.analyze(bitmap, (input.now ?? defaultNow)());
      bitmap = null;
      if (!observation || !observing.current || !mounted.current) return;
      aggregate.current = addVisualObservation(aggregate.current, observation);
      setLastObservation(observation);
      setSignals(toVisualSignals(aggregate.current));
    } catch (error) {
      if (bitmap) bitmap.close();
      if (mounted.current && observing.current) {
        stopObserving();
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "本機視覺分析失敗，請再試一次。" );
      }
    } finally {
      inFlight.current = false;
    }
  }, [getClient, input.createBitmap, input.now, input.videoElement, setStatus, stopObserving]);

  const startObserving = useCallback(() => {
    const video = input.videoElement;
    if (statusRef.current !== "ready") return;
    if (!video || !video.srcObject || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setErrorMessage("請先開啟並準備好本機鏡頭。");
      return;
    }
    observing.current = true;
    setErrorMessage(null);
    setStatus("observing");
    const sampleIntervalMs = input.sampleIntervalMs ?? 200;
    interval.current = setInterval(() => { void sampleFrame(); }, sampleIntervalMs);
  }, [input.sampleIntervalMs, input.videoElement, sampleFrame, setStatus]);

  const resetSignals = useCallback(() => {
    aggregate.current = createVisualAggregate();
    setLastObservation(null);
    setSignals(toVisualSignals(aggregate.current));
  }, []);

  const getSignals = useCallback(() => toVisualSignals(aggregate.current), []);

  return {
    status,
    progress,
    lastObservation,
    signals,
    errorMessage,
    loadModel,
    startObserving,
    stopObserving,
    resetSignals,
    getSignals,
  };
}
