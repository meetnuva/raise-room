import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { PresenterRuntimeConfig } from "../lib/perxona-config";
import { usePerxonaPresenter } from "../hooks/use-perxona-presenter";
import type { PresenterClient } from "../lib/perxona-presenter";
import { ParticipantMenu } from "./ParticipantMenu";
import { Icon } from "./ui/Icons";
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
  onViewRole?: (opener: HTMLButtonElement | null) => void;
  onOpenInfo?: (opener: HTMLButtonElement | null) => void;
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
  const [menuRequest, setMenuRequest] = useState(0);

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
  const activateTile = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as Element).closest("button, a, input, select, textarea")) return;
    setMenuRequest((current) => current + 1);
  };

  return (
    <section className="manager-stage" aria-labelledby="manager-stage-title" onClick={activateTile}>
      <button aria-label="開啟主管參與者選單" className="participant-tile-hit-target" type="button" onClick={() => setMenuRequest((current) => current + 1)} />
      <div className="participant-tile-overlay">
        <div><p className="stage-label">主管畫面{pinned && <><Icon name="pin" size={16} /><span>已釘選</span></>}</p><h3 id="manager-stage-title">{managerName}</h3></div>
        <ParticipantMenu kind="manager" pinned={pinned} expanded={false} onTogglePin={onTogglePin ?? (() => {})} onViewRole={onViewRole} onOpenInfo={onOpenInfo} openRequest={menuRequest} />
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
