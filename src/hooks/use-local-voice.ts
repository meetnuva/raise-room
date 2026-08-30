import { useCallback, useEffect, useRef, useState } from "react";
import { createLocalAsrClient, type AsrWorkerEvent, type LocalAsrClient, type VoiceLanguage } from "../lib/local-asr";

export type VoiceStatus = "idle" | "loading-model" | "ready" | "requesting-microphone" | "recording" | "transcribing" | "unsupported" | "denied" | "error";
export interface VoiceTranscriptResult { text: string; durationSeconds: number; language: VoiceLanguage; }

export function useLocalVoice(input?: { asrClient?: LocalAsrClient; mediaDevices?: Pick<MediaDevices, "getUserMedia">; mediaRecorderFactory?: (stream: MediaStream) => MediaRecorder; audioContextFactory?: () => AudioContext; now?: () => number; }) {
  const clientRef = useRef<LocalAsrClient | null>(input?.asrClient ?? null); const mounted = useRef(true); const stream = useRef<MediaStream | null>(null); const recorder = useRef<MediaRecorder | null>(null); const context = useRef<AudioContext | null>(null); const startedAt = useRef<number | null>(null); const chunks = useRef<Blob[]>([]);
  const [status, setStatus] = useState<VoiceStatus>(() => input?.asrClient ? "idle" : typeof Worker === "undefined" ? "unsupported" : "idle"); const [progress, setProgress] = useState<number | null>(null); const [partialText, setPartialText] = useState(""); const [errorMessage, setErrorMessage] = useState<string | null>(null); const [language, setLanguage] = useState<VoiceLanguage>("zh");
  const stopTracks = useCallback(() => { stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; }, []);
  const release = useCallback(() => { stopTracks(); recorder.current = null; chunks.current = []; context.current?.close().catch(() => undefined); context.current = null; startedAt.current = null; }, [stopTracks]);
  const client = useCallback(() => { if (!clientRef.current && typeof Worker !== "undefined") clientRef.current = createLocalAsrClient(); return clientRef.current; }, []);
  useEffect(() => {
    const asr = client(); if (!asr) return; const unsubscribe = asr.subscribe((event: AsrWorkerEvent) => {
      if (!mounted.current) return; if (event.type === "loading") { setStatus("loading-model"); setProgress(event.progress); }
      if (event.type === "ready") { setStatus("ready"); setProgress(null); setErrorMessage(null); }
      if (event.type === "partial") setPartialText(event.text); if (event.type === "error") { setStatus("error"); setErrorMessage(event.message); }
    });
    return () => { mounted.current = false; unsubscribe(); release(); asr.destroy(); };
  }, [client, release]);
  const loadModel = useCallback(() => { const asr = client(); if (!asr) { setStatus("unsupported"); setErrorMessage("此瀏覽器不支援本機語音轉錄。"); return; } setStatus("loading-model"); setProgress(null); setErrorMessage(null); asr.load(); }, [client]);
  const startRecording = useCallback(async () => {
    if (status !== "ready") return; const mediaDevices = input?.mediaDevices ?? navigator.mediaDevices;
    if (!mediaDevices) { setStatus("unsupported"); setErrorMessage("此瀏覽器不支援本機錄音。 "); return; }
    setStatus("requesting-microphone"); setErrorMessage(null);
    try { const next = await mediaDevices.getUserMedia({ audio: true, video: false }); if (!mounted.current) { next.getTracks().forEach((track) => track.stop()); return; } stream.current = next; if (!input?.mediaRecorderFactory && typeof MediaRecorder === "undefined") { stopTracks(); setStatus("unsupported"); setErrorMessage("此瀏覽器不支援本機錄音。 "); return; } const nextRecorder = input?.mediaRecorderFactory?.(next) ?? new MediaRecorder(next); recorder.current = nextRecorder; chunks.current = []; nextRecorder.addEventListener("dataavailable", (event) => { if (event.data.size > 0) chunks.current.push(event.data); }); nextRecorder.start(); startedAt.current = (input?.now ?? performance.now.bind(performance))(); setStatus("recording"); } catch (error) { const denied = error instanceof DOMException && error.name === "NotAllowedError"; setStatus(denied ? "denied" : "error"); setErrorMessage(denied ? "你尚未允許麥克風權限。" : "無法啟動本機麥克風。"); }
  }, [input?.mediaDevices, input?.mediaRecorderFactory, input?.now, status]);
  const stopAndTranscribe = useCallback(async (): Promise<VoiceTranscriptResult | null> => {
    if (status !== "recording" || !recorder.current) return null; const current = recorder.current; const now = input?.now ?? performance.now.bind(performance); const durationSeconds = Math.max(0, (now() - (startedAt.current ?? now())) / 1000); setStatus("transcribing");
    await new Promise<void>((resolve) => { current.addEventListener("stop", () => resolve(), { once: true }); current.stop(); }); stopTracks();
    try { const blob = new Blob(chunks.current, { type: current.mimeType || "audio/webm" }); const audioContext = input?.audioContextFactory?.() ?? new AudioContext({ sampleRate: 16000 }); context.current = audioContext; const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer()); const channel = decoded.getChannelData(0); const samples = channel.slice(Math.max(0, channel.length - (16000 * 30))); const text = (await client()?.transcribe(samples, language) ?? "").trim(); release(); if (!text) { if (mounted.current) setStatus("ready"); return null; } if (mounted.current) setStatus("ready"); return { text, durationSeconds, language }; } catch { release(); if (mounted.current) { setStatus("error"); setErrorMessage("本機轉錄失敗，請再試一次。"); } return null; }
  }, [client, input?.audioContextFactory, input?.now, language, release, status, stopTracks]);
  const cancel = useCallback(() => { if (recorder.current?.state === "recording") recorder.current.stop(); release(); if (mounted.current) { setStatus("ready"); setPartialText(""); } }, [release]);
  return { status, progress, partialText, errorMessage, language, setLanguage, loadModel, startRecording, stopAndTranscribe, cancel };
}
