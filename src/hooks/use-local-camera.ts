import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "requesting" | "active" | "denied" | "unavailable" | "error";
const constraints: MediaStreamConstraints = { audio: false, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } };
export function useLocalCamera(input?: { mediaDevices?: Pick<MediaDevices, "getUserMedia"> }) {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stop = useCallback(() => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setStream(null); setStatus("idle"); setErrorMessage(null); }, []);
  const start = useCallback(async () => {
    const mediaDevices = input?.mediaDevices ?? navigator.mediaDevices;
    if (!mediaDevices) { setStatus("unavailable"); setErrorMessage("此瀏覽器無法使用攝影機。"); return; }
    setStatus("requesting"); setErrorMessage(null);
    try { const next = await mediaDevices.getUserMedia(constraints); streamRef.current = next; setStream(next); setStatus("active"); }
    catch (error) { setStatus(error instanceof DOMException && error.name === "NotAllowedError" ? "denied" : "error"); setErrorMessage(error instanceof DOMException && error.name === "NotAllowedError" ? "你尚未允許攝影機權限。" : "無法啟動本機攝影機。"); }
  }, [input?.mediaDevices]);
  useEffect(() => stop, [stop]);
  return { status, stream, errorMessage, start, stop };
}
