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
  const recorder = useRef<MediaRecorder | null>(null);
  const context = useRef<AudioContext | null>(null);
  const startedAt = useRef<number | null>(null);
  const chunks = useRef<Blob[]>([]);

  const [status, setStatus] = useState<VoiceStatus>(() => {
    if (input?.asrClient) return "idle";
    return typeof Worker === "undefined" ? "unsupported" : "idle";
  });
  const [progress, setProgress] = useState<number | null>(null);
  const [partialText, setPartialText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [language, setLanguage] = useState<VoiceLanguage>("zh");
  const [device, setDevice] = useState<"webgpu" | "wasm" | null>(null);
  const activePreset = useRef(modelPreset);

  const stopTracks = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
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
    }

    return clientRef.current;
  }, [input?.asrClientFactory]);

  useEffect(() => {
    mounted.current = true;
    const asr = client();
    if (!asr) return;

    const unsubscribe = asr.subscribe((event: AsrWorkerEvent) => {
      if (!mounted.current) return;

      if (event.type === "loading") {
        setStatus("loading-model");
        setProgress(event.progress);
      }

      if (event.type === "ready") {
        setStatus("ready");
        setProgress(null);
        setErrorMessage(null);
        setDevice(event.device);
      }

      if (event.type === "partial") {
        setPartialText(event.text);
      }

      if (event.type === "error") {
        setStatus("error");
        setErrorMessage(event.message);
      }
    });

    return () => {
      mounted.current = false;
      unsubscribe();
      release();

      if (!injectedClient.current && clientRef.current === asr) {
        asr.destroy();
        clientRef.current = null;
      }
    };
  }, [client, release]);

  useEffect(() => {
    if (activePreset.current === modelPreset) return;

    if (recorder.current?.state === "recording") recorder.current.stop();
    release();
    if (!injectedClient.current && clientRef.current) {
      clientRef.current.destroy();
      clientRef.current = null;
    }
    activePreset.current = modelPreset;
    setStatus("idle");
    setProgress(null);
    setPartialText("");
    setErrorMessage(null);
    setDevice(null);
  }, [modelPreset, release]);

  const loadModel = useCallback(() => {
    const asr = client();
    if (!asr) {
      setStatus("unsupported");
      setErrorMessage("此瀏覽器不支援本機語音轉錄。");
      return;
    }

    setStatus("loading-model");
    setProgress(null);
    setErrorMessage(null);
    asr.load(modelPreset);
  }, [client, modelPreset]);

  const startRecording = useCallback(async () => {
    if (status !== "ready") return;

    const mediaDevices = input?.mediaDevices ?? navigator.mediaDevices;
    if (!mediaDevices) {
      setStatus("unsupported");
      setErrorMessage("此瀏覽器不支援本機錄音。 ");
      return;
    }

    setStatus("requesting-microphone");
    setErrorMessage(null);

    try {
      const next = await mediaDevices.getUserMedia({ audio: true, video: false });
      if (!mounted.current) {
        next.getTracks().forEach((track) => track.stop());
        return;
      }

      stream.current = next;

      if (!input?.mediaRecorderFactory && typeof MediaRecorder === "undefined") {
        stopTracks();
        setStatus("unsupported");
        setErrorMessage("此瀏覽器不支援本機錄音。 ");
        return;
      }

      const nextRecorder = input?.mediaRecorderFactory?.(next) ?? new MediaRecorder(next);
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
  }, [input?.mediaDevices, input?.mediaRecorderFactory, input?.now, status, stopTracks]);

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
      clientRef.current.destroy();
      clientRef.current = null;
    }
    if (mounted.current) {
      setStatus("idle");
      setProgress(null);
      setPartialText("");
      setErrorMessage(null);
      setDevice(null);
    }
  }, [release]);

  return {
    status,
    progress,
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
