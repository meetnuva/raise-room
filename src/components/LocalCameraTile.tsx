import { useCallback, useEffect, useRef } from "react";
import { useLocalCamera } from "../hooks/use-local-camera";
type Camera = ReturnType<typeof useLocalCamera>;
export function LocalCameraTile({
  camera: injected,
  detail,
  showControl = true,
  onVideoElement,
  previewStream,
}: {
  camera?: Camera;
  detail?: string;
  showControl?: boolean;
  onVideoElement?: (element: HTMLVideoElement | null) => void;
  previewStream?: MediaStream | null;
}) {
  const owned = useLocalCamera();
  const camera = injected ?? owned;
  const videoRef = useRef<HTMLVideoElement>(null);
  const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    onVideoElement?.(element);
  }, [onVideoElement]);

  const stream = previewStream === undefined ? camera.stream : previewStream;
  const active = previewStream === undefined ? camera.status === "active" : Boolean(previewStream);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (!active) onVideoElement?.(null);
  }, [active, onVideoElement]);

  const message =
    camera.status === "denied"
      ? "攝影機權限已拒絕"
      : camera.status === "unavailable"
        ? "此裝置無法使用攝影機"
        : camera.status === "error"
          ? "無法啟動攝影機"
          : "鏡頭尚未開啟";

  return (
    <section className="local-camera-tile" aria-label="你的本機鏡頭">
      <p className="stage-label">你 · 本機預覽</p>
      {detail && <p>{detail}</p>}
      {active ? (
        <>
          <video ref={setVideoRef} autoPlay muted playsInline aria-label="本機鏡頭預覽" />
          {showControl && <button type="button" onClick={camera.stop}>關閉我的鏡頭</button>}
        </>
      ) : (
        <>
          <div className="camera-placeholder" aria-hidden="true">你</div>
          <p>{message}</p>
          {camera.errorMessage && <p role="status">⚠ {camera.errorMessage}</p>}
          {showControl && (
            <button type="button" onClick={() => void camera.start()} disabled={camera.status === "requesting"}>
              {camera.status === "requesting" ? "正在請求鏡頭權限" : "開啟我的鏡頭"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
