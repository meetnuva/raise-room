import { useCallback, useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { useLocalCamera } from "../hooks/use-local-camera";
import { Icon } from "./ui/Icons";
type Camera = ReturnType<typeof useLocalCamera>;
type LocalCameraTileProps = {
  camera?: Camera;
  detail?: string;
  showControl?: boolean;
  showStatus?: boolean;
  onVideoElement?: (element: HTMLVideoElement | null) => void;
  previewStream?: MediaStream | null;
  overlay?: ReactNode;
  pinned?: boolean;
  tileActions?: ReactNode;
  onTileActivate?: () => void;
};

function LocalCameraTileView({
  camera,
  detail,
  showControl = true,
  showStatus = true,
  onVideoElement,
  previewStream,
  overlay,
  pinned = false,
  tileActions,
  onTileActivate,
}: LocalCameraTileProps & { camera: Camera }) {
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
  const activateTile = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as Element).closest("button, a, input, select, textarea")) return;
    onTileActivate?.();
  };

  return (
    <section className="local-camera-tile" aria-label="你的本機鏡頭" onClick={activateTile}>
      {onTileActivate && <button aria-label="開啟你的參與者選單" className="participant-tile-hit-target" type="button" onClick={onTileActivate} />}
      <div className="participant-tile-overlay">
        <p className="stage-label">你 · 本機預覽{pinned && <><Icon name="pin" size={16} /><span>已釘選</span></>}</p>
        {tileActions}
      </div>
      {detail && <p>{detail}</p>}
      {active ? (
        <>
          <video ref={setVideoRef} autoPlay muted playsInline aria-label="本機鏡頭預覽" />
          {showControl && <button type="button" onClick={camera.stop}>關閉我的鏡頭</button>}
        </>
      ) : (
        <>
          <div className="camera-placeholder" aria-hidden="true">你</div>
          {showStatus && <p>{message}</p>}
          {showStatus && camera.errorMessage && <p role="status">⚠ {camera.errorMessage}</p>}
          {showControl && (
            <button type="button" onClick={() => void camera.start()} disabled={camera.status === "requesting"}>
              {camera.status === "requesting" ? "正在請求鏡頭權限" : "開啟我的鏡頭"}
            </button>
          )}
        </>
      )}
      {overlay}
    </section>
  );
}

function OwnedLocalCameraTile(props: Omit<LocalCameraTileProps, "camera">) {
  const camera = useLocalCamera();
  return <LocalCameraTileView {...props} camera={camera} />;
}

function InjectedLocalCameraTile({ camera, ...props }: LocalCameraTileProps & { camera: Camera }) {
  return <LocalCameraTileView {...props} camera={camera} />;
}

function PreviewOnlyCameraTile(props: Omit<LocalCameraTileProps, "camera">) {
  const camera: Camera = {
    status: "idle",
    stream: null,
    errorMessage: null,
    start: async () => undefined,
    stop: () => undefined,
  };
  return <LocalCameraTileView {...props} camera={camera} />;
}

export function LocalCameraTile(props: LocalCameraTileProps) {
  if (props.camera) return <InjectedLocalCameraTile {...props} camera={props.camera} />;
  if (props.previewStream !== undefined) return <PreviewOnlyCameraTile {...props} />;
  return <OwnedLocalCameraTile {...props} />;
}
