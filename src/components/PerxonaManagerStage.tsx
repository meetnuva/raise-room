import { useEffect, useRef } from "react";
import type { PresenterRuntimeConfig } from "../lib/perxona-config";
import { usePerxonaPresenter } from "../hooks/use-perxona-presenter";
import type { PresenterClient } from "../lib/perxona-presenter";
export function PerxonaManagerStage({ managerName, config, latestManagerText, clientFactory }: { managerName: string; config: PresenterRuntimeConfig; latestManagerText: string | null; clientFactory?: (url: string) => PresenterClient }) {
  const containerRef = useRef<HTMLDivElement>(null); const { status, errorMessage, launch, speak, interrupt } = usePerxonaPresenter({ containerRef, config, clientFactory }); const spoken = useRef<string | null>(null);
  useEffect(() => { if (status === "ready" && latestManagerText && spoken.current !== latestManagerText) { spoken.current = latestManagerText; void speak(latestManagerText); } }, [latestManagerText, speak, status]);
  const state = status === "disabled" ? "尚未設定 Perxona" : status === "loading" ? "正在載入 3D 主管" : status === "initializing" ? "正在初始化 3D 主管" : status === "ready" ? "3D 主管已就緒" : status === "key-rejected" ? "Perxona 金鑰遭拒絕" : status === "error" ? "3D 主管無法使用" : "3D 主管待啟動";
  return <section className="manager-stage" aria-labelledby="manager-stage-title"><p className="stage-label">主管畫面</p><h3 id="manager-stage-title">{managerName}</h3><div ref={containerRef} className="presenter-canvas" aria-label="Perxona 3D 主管舞台" /><p role="status">● {state}</p>{errorMessage && <p role="alert">⚠ {errorMessage}</p>}{status === "mounted" && <button type="button" onClick={() => void launch()}>啟動 3D 主管</button>}{status === "ready" && <button type="button" onClick={interrupt}>停止發話</button>}</section>;
}
