import { useEffect, useRef } from "react";
import type { PresenterRuntimeConfig } from "../lib/perxona-config";
import { usePerxonaPresenter } from "../hooks/use-perxona-presenter";
import type { PresenterClient } from "../lib/perxona-presenter";
import { ParticipantMenu } from "./ParticipantMenu";
export function PerxonaManagerStage({
  managerName,
  config,
  latestManagerText,
  clientFactory,
  pinned = false,
  onTogglePin,
  onViewRole,
  onOpenInfo,
  onPresenterError,
}: {
  managerName: string;
  config: PresenterRuntimeConfig;
  latestManagerText: string | null;
  clientFactory?: (url: string) => PresenterClient;
  pinned?: boolean;
  onTogglePin?: () => void;
  onViewRole?: () => void;
  onOpenInfo?: () => void;
  onPresenterError?: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { status, errorMessage, launch, speak, interrupt } = usePerxonaPresenter({
    containerRef,
    config,
    clientFactory,
  });
  const spoken = useRef<string | null>(null);
  const reportedError = useRef<string | null>(null);

  useEffect(() => {
    if (status === "ready" && latestManagerText && spoken.current !== latestManagerText) {
      spoken.current = latestManagerText;
      void speak(latestManagerText);
    }
  }, [latestManagerText, speak, status]);

  useEffect(() => {
    if (!errorMessage) {
      reportedError.current = null;
      return;
    }
    if (reportedError.current !== errorMessage) {
      reportedError.current = errorMessage;
      onPresenterError?.(errorMessage);
    }
  }, [errorMessage, onPresenterError]);

  const state = {
    disabled: "尚未設定 Perxona",
    loading: "正在載入 3D 主管",
    mounted: "3D 主管待啟動",
    initializing: "正在初始化 3D 主管",
    ready: "3D 主管已就緒",
    "key-rejected": "Perxona 金鑰遭拒絕",
    error: "3D 主管無法使用",
  }[status];

  return (
    <section className="manager-stage" aria-labelledby="manager-stage-title">
      <div className="participant-tile-overlay">
        <div><p className="stage-label">主管畫面{pinned ? " · 已釘選" : ""}</p><h3 id="manager-stage-title">{managerName}</h3></div>
        <ParticipantMenu kind="manager" pinned={pinned} expanded={false} onTogglePin={onTogglePin ?? (() => {})} onViewRole={onViewRole} onOpenInfo={onOpenInfo} />
      </div>
      <div ref={containerRef} className="presenter-canvas" aria-label="Perxona 3D 主管舞台" />
      <p role="status">● {state}</p>
      {errorMessage && !onPresenterError && <p role="alert">⚠ {errorMessage}</p>}
      {status === "mounted" && (
        <button type="button" onClick={() => void launch()}>
          啟動 3D 主管
        </button>
      )}
      {status === "ready" && <button type="button" onClick={interrupt}>停止發話</button>}
    </section>
  );
}
