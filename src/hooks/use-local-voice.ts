import { useCallback, useEffect, useRef, useState } from "react";
import {
  createLocalAsrClient,
  type AsrWorkerEvent,
  type LocalAsrClient,
  type VoiceLanguage,
} from "../lib/local-asr";
import { defaultAsrModelPresetId, type AsrModelPresetId } from "../domain/asr-models";
import { toTaiwanTraditional } from "../lib/traditional-chinese";

export type VoiceStatus =
  | "idle"
  | "loading-model"
  | "ready"
  | "requesting-microphone"
  | "recording"
  | "transcribing"
  | "unsupported"
  | "denied"
  | "error";

export interface VoiceTranscriptResult {
  rawText: string;
  text: string;
  durationSeconds: number;
  language: VoiceLanguage;
  modelPreset: AsrModelPresetId;
}

type LocalVoiceInput = {
  modelPreset?: AsrModelPresetId;
  sharedAudioStream?: MediaStream | null;
  asrClient?: LocalAsrClient;
  asrClientFactory?: () => LocalAsrClient;
  mediaDevices?: Pick<MediaDevices, "getUserMedia">;
  mediaRecorderFactory?: (stream: MediaStream) => MediaRecorder;
  audioContextFactory?: () => AudioContext;
  now?: () => number;
};

function defaultNow() {
  return performance.now.bind(performance);
}

export function useLocalVoice(input?: LocalVoiceInput) {
  const modelPreset = input?.modelPreset ?? defaultAsrModelPresetId;
  const clientRef = useRef<LocalAsrClient | null>(input?.asrClient ?? null);
  const injectedClient = useRef(Boolean(input?.asrClient));
  const clientFactory = useRef(input?.asrClientFactory ?? createLocalAsrClient);
  const mounted = useRef(true);
  const stream = useRef<MediaStream | null>(null);
  const streamIsOwned = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const context = useRef<AudioContext | null>(null);
  const startedAt = useRef<number | null>(null);
  const chunks = useRef<Blob[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const subscribedClientRef = useRef<LocalAsrClient | null>(null);

  const [status, setStatus] = useState<VoiceStatus>(() => {
    if (input?.asrClient) return "idle";
    return typeof Worker === "undefined" ? "unsupported" : "idle";
  });
  const [progress, setProgress] = useState<number | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [partialText, setPartialText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [language, setLanguage] = useState<VoiceLanguage>("zh");
  const [device, setDevice] = useState<"webgpu" | "wasm" | null>(null);
  const activePreset = useRef(modelPreset);

  const handleAsrEvent = useCallback((event: AsrWorkerEvent) => {
    if (!mounted.current) return;

    if (event.type === "loading") {
      setStatus("loading-model");
      setProgress(event.progress);
      setLoadingMessage(event.message);
    }

    if (event.type === "ready") {
      setStatus("ready");
      setProgress(null);
      setLoadingMessage(null);
      setErrorMessage(null);
      setDevice(event.device);
    }

    if (event.type === "partial") setPartialText(event.text);

    if (event.type === "error") {
      setStatus("error");
      setErrorMessage(event.message);
      setLoadingMessage(null);
    }
  }, []);

  const detachClient = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    subscribedClientRef.current = null;
  }, []);

  const subscribeClient = useCallback((asr: LocalAsrClient) => {
    if (subscribedClientRef.current === asr) return;
    detachClient();
    subscribedClientRef.current = asr;
    unsubscribeRef.current = asr.subscribe(handleAsrEvent);
  }, [detachClient, handleAsrEvent]);

  const stopTracks = useCallback(() => {
    if (streamIsOwned.current) {
      stream.current?.getTracks().forEach((track) => track.stop());
    }
    stream.current = null;
    streamIsOwned.current = false;
  }, []);

  const release = useCallback(() => {
    stopTracks();
    recorder.current = null;
    chunks.current = [];
    context.current?.close().catch(() => undefined);
    context.current = null;
    startedAt.current = null;
  }, [stopTracks]);

  const client = useCallback(() => {
    const canCreateClient =
      !injectedClient.current &&
      (input?.asrClientFactory || typeof Worker !== "undefined");

    if (!clientRef.current && canCreateClient) {
      clientRef.current = clientFactory.current();
      subscribeClient(clientRef.current);
    }

    return clientRef.current;
  }, [input?.asrClientFactory, subscribeClient]);

  useEffect(() => {
    mounted.current = true;
    const asr = client();
    if (!asr) return;
    subscribeClient(asr);

    return () => {
      mounted.current = false;
      detachClient();
      release();

      if (!injectedClient.current && clientRef.current === asr) {
        asr.destroy();
        clientRef.current = null;
      }
    };
  }, [client, detachClient, release, subscribeClient]);

  useEffect(() => {
    if (activePreset.current === modelPreset) return;

    if (recorder.current?.state === "recording") recorder.current.stop();
    release();
    if (!injectedClient.current && clientRef.current) {
      detachClient();
      clientRef.current.destroy();
      clientRef.current = null;
    }
    activePreset.current = modelPreset;
    setStatus("idle");
    setProgress(null);
    setLoadingMessage(null);
    setPartialText("");
    setErrorMessage(null);
    setDevice(null);
  }, [detachClient, modelPreset, release]);

  const loadModel = useCallback(() => {
    const asr = client();
    if (!asr) {
      setStatus("unsupported");
      setErrorMessage("此瀏覽器不支援本機語音轉錄。");
      return;
    }

    setStatus("loading-model");
    setProgress(null);
    setLoadingMessage(null);
    setErrorMessage(null);
    asr.load(modelPreset);
  }, [client, modelPreset]);

  const startRecording = useCallback(async () => {
    if (status !== "ready") return;

    setStatus("requesting-microphone");
    setErrorMessage(null);

    try {
      const sharedStream = input?.sharedAudioStream;
      if (sharedStream) {
        const hasLiveEnabledAudio = sharedStream
          .getAudioTracks()
          .some((track) => track.enabled && track.readyState === "live");
        if (!hasLiveEnabledAudio) {
          setStatus("error");
          setErrorMessage("麥克風目前未啟用，請先開啟麥克風。");
          return;
        }
        stream.current = sharedStream;
        streamIsOwned.current = false;
      } else {
        const mediaDevices = input?.mediaDevices ?? navigator.mediaDevices;
        if (!mediaDevices) {
          setStatus("unsupported");
          setErrorMessage("此瀏覽器不支援本機錄音。 ");
          return;
        }
        const next = await mediaDevices.getUserMedia({ audio: true, video: false });
        if (!mounted.current) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = next;
        streamIsOwned.current = true;
      }

      if (!input?.mediaRecorderFactory && typeof MediaRecorder === "undefined") {
        stopTracks();
        setStatus("unsupported");
        setErrorMessage("此瀏覽器不支援本機錄音。 ");
        return;
      }

      const recordingStream = stream.current;
      if (!recordingStream) return;
      const nextRecorder = input?.mediaRecorderFactory?.(recordingStream) ?? new MediaRecorder(recordingStream);
      recorder.current = nextRecorder;
      chunks.current = [];
      nextRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunks.current.push(event.data);
        }
      });
      nextRecorder.start();
      startedAt.current = (input?.now ?? defaultNow())();
      setStatus("recording");
    } catch (error) {
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      setStatus(denied ? "denied" : "error");
      setErrorMessage(denied ? "你尚未允許麥克風權限。" : "無法啟動本機麥克風。");
    }
  }, [input?.mediaDevices, input?.mediaRecorderFactory, input?.now, input?.sharedAudioStream, status, stopTracks]);

  const stopAndTranscribe = useCallback(async (): Promise<VoiceTranscriptResult | null> => {
    if (status !== "recording" || !recorder.current) return null;

    const current = recorder.current;
    const now = input?.now ?? defaultNow();
    const durationSeconds = Math.max(0, (now() - (startedAt.current ?? now())) / 1000);
    setStatus("transcribing");

    await new Promise<void>((resolve) => {
      current.addEventListener("stop", () => resolve(), { once: true });
      current.stop();
    });
    stopTracks();

    try {
      const blob = new Blob(chunks.current, { type: current.mimeType || "audio/webm" });
      const audioContext = input?.audioContextFactory?.() ?? new AudioContext({ sampleRate: 16000 });
      context.current = audioContext;

      const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer());
      const channel = decoded.getChannelData(0);
      const samples = channel.slice(Math.max(0, channel.length - (16000 * 30)));
      const rawText = (await client()?.transcribe(samples, language, modelPreset) ?? "").trim();
      const text = language === "zh" ? toTaiwanTraditional(rawText).trim() : rawText;

      release();

      if (!text) {
        if (mounted.current) setStatus("ready");
        return null;
      }

      if (mounted.current) setStatus("ready");
      return { rawText, text, durationSeconds, language, modelPreset };
    } catch (error) {
      release();

      if (mounted.current) {
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "本機轉錄失敗，請再試一次。");
      }

      return null;
    }
  }, [client, input?.audioContextFactory, input?.now, language, modelPreset, release, status, stopTracks]);

  const cancel = useCallback(() => {
    if (recorder.current?.state === "recording") {
      recorder.current.stop();
    }

    release();

    if (mounted.current) {
      setStatus("ready");
      setPartialText("");
    }
  }, [release]);

  const releaseModel = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    release();
    if (!injectedClient.current && clientRef.current) {
      detachClient();
      clientRef.current.destroy();
      clientRef.current = null;
    }
    if (mounted.current) {
      setStatus("idle");
      setProgress(null);
      setLoadingMessage(null);
      setPartialText("");
      setErrorMessage(null);
      setDevice(null);
    }
  }, [detachClient, release]);

  return {
    status,
    progress,
    loadingMessage,
    partialText,
    errorMessage,
    language,
    setLanguage,
    loadModel,
    startRecording,
    stopAndTranscribe,
    cancel,
    device,
    releaseModel,
  };
}
