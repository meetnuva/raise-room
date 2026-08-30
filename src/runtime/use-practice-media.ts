import { useCallback, useEffect, useRef, useState } from "react";

export type PracticeMediaStatus = "idle" | "requesting" | "active" | "denied" | "unavailable" | "error";

export interface PracticeMediaController {
  status: PracticeMediaStatus;
  stream: MediaStream | null;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  errorMessage: string | null;
  request(): Promise<void>;
  toggleCamera(): void;
  toggleMicrophone(): void;
  dispose(): void;
}

type PracticeMediaInput = {
  mediaDevices?: Pick<MediaDevices, "getUserMedia">;
};

const constraints: MediaStreamConstraints = {
  audio: true,
  video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
};

function isDenied(error: unknown) {
  return error instanceof DOMException && error.name === "NotAllowedError";
}

export function usePracticeMedia(input?: PracticeMediaInput): PracticeMediaController {
  const mounted = useRef(true);
  const streamRef = useRef<MediaStream | null>(null);
  const requestPromise = useRef<Promise<void> | null>(null);
  const requestVersion = useRef(0);
  const statusRef = useRef<PracticeMediaStatus>("idle");
  const [status, setStatus] = useState<PracticeMediaStatus>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setMediaStatus = useCallback((next: PracticeMediaStatus) => {
    statusRef.current = next;
    if (mounted.current) setStatus(next);
  }, []);

  const clearState = useCallback(() => {
    if (!mounted.current) return;
    setStream(null);
    setCameraEnabled(false);
    setMicrophoneEnabled(false);
  }, []);

  const dispose = useCallback(() => {
    requestVersion.current += 1;
    const current = streamRef.current;
    streamRef.current = null;
    current?.getTracks().forEach((track) => track.stop());
    clearState();
    setMediaStatus("idle");
    if (mounted.current) setErrorMessage(null);
  }, [clearState, setMediaStatus]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      dispose();
    };
  }, [dispose]);

  const request = useCallback((): Promise<void> => {
    if (streamRef.current || statusRef.current === "active") return Promise.resolve();
    if (requestPromise.current) return requestPromise.current;

    const mediaDevices = input?.mediaDevices ?? navigator.mediaDevices;
    if (!mediaDevices) {
      setMediaStatus("unavailable");
      if (mounted.current) setErrorMessage("此瀏覽器無法使用相機與麥克風。");
      return Promise.resolve();
    }

    const version = ++requestVersion.current;
    setMediaStatus("requesting");
    if (mounted.current) setErrorMessage(null);
    const pending = mediaDevices.getUserMedia(constraints)
      .then((next) => {
        if (!mounted.current || requestVersion.current !== version) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = next;
        if (mounted.current) {
          setStream(next);
          setCameraEnabled(next.getVideoTracks().some((track) => track.enabled));
          setMicrophoneEnabled(next.getAudioTracks().some((track) => track.enabled));
        }
        setMediaStatus("active");
      })
      .catch((error: unknown) => {
        if (!mounted.current || requestVersion.current !== version) return;
        setMediaStatus(isDenied(error) ? "denied" : "error");
        setErrorMessage(isDenied(error) ? "你尚未允許相機與麥克風權限。" : "無法啟動相機與麥克風。");
      })
      .finally(() => {
        if (requestPromise.current === pending) requestPromise.current = null;
      });
    requestPromise.current = pending;
    return pending;
  }, [input?.mediaDevices, setMediaStatus]);

  const toggleCamera = useCallback(() => {
    const tracks = streamRef.current?.getVideoTracks() ?? [];
    if (tracks.length === 0) return;
    const enabled = !tracks.some((track) => track.enabled);
    tracks.forEach((track) => { track.enabled = enabled; });
    if (mounted.current) setCameraEnabled(enabled);
  }, []);

  const toggleMicrophone = useCallback(() => {
    const tracks = streamRef.current?.getAudioTracks() ?? [];
    if (tracks.length === 0) return;
    const enabled = !tracks.some((track) => track.enabled);
    tracks.forEach((track) => { track.enabled = enabled; });
    if (mounted.current) setMicrophoneEnabled(enabled);
  }, []);

  return { status, stream, cameraEnabled, microphoneEnabled, errorMessage, request, toggleCamera, toggleMicrophone, dispose };
}
