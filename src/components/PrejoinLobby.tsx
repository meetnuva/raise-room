import { useRef, useState } from "react";
import type { ScheduledPracticeMeeting } from "../domain/practice-schedule";
import { formatPracticeTimeRange } from "../domain/practice-schedule";
import type { Scenario } from "../domain/scenario";
import type { useLocalVoice } from "../hooks/use-local-voice";
import type { PresenterRuntimeConfig } from "../lib/perxona-config";
import { loadPresenterEngine } from "../lib/perxona-presenter";
import type { PracticeMediaController } from "../runtime/use-practice-media";
import { LocalCameraTile } from "./LocalCameraTile";
import { NuvaBrand } from "./NuvaBrand";
import { ActionMenu } from "./ui/ActionMenu";
import { Icon } from "./ui/Icons";
import { IconButton } from "./ui/IconButton";

type VoiceController = ReturnType<typeof useLocalVoice>;
type PresenterCheckState = "idle" | "checking" | "verified" | "failed";
type Readiness = "ready" | "optional" | "needs-action" | "loading";
type SettingsTarget = "audio" | "video" | "voice";

type ReadinessItem = {
  id: "camera" | "microphone" | "voice" | "presenter";
  label: string;
  state: Readiness;
  detail: string;
  action?: { label: string; onClick: () => void };
};

function readinessLabel(state: Readiness) {
  return {
    ready: "已就緒",
    optional: "選用",
    "needs-action": "需要處理",
    loading: "載入中",
  }[state];
}

function readinessIcon(state: Readiness) {
  if (state === "ready") return "check" as const;
  if (state === "loading") return "loading" as const;
  return "warning" as const;
}

export function PrejoinLobby({
  meeting,
  scenario,
  media,
  voice,
  presenterConfig,
  onJoin,
  onCancel,
  onOpenSettings,
  presenterPreloader = loadPresenterEngine,
}: {
  meeting: ScheduledPracticeMeeting;
  scenario: Scenario;
  media: PracticeMediaController;
  voice: VoiceController;
  presenterConfig: PresenterRuntimeConfig;
  onJoin: () => void;
  onCancel: () => void;
  onOpenSettings: (target: SettingsTarget, opener?: HTMLElement | null) => void;
  presenterPreloader?: (url: string) => Promise<void>;
}) {
  const [presenterCheck, setPresenterCheck] = useState<PresenterCheckState>("idle");
  const deviceSettingsTrigger = useRef<HTMLButtonElement>(null);
  const presenterAvailable = presenterConfig.enabled;
  const canRequestMedia = media.status !== "requesting" && media.status !== "active";
  const toggleOrRequestMedia = (target: "camera" | "microphone") => {
    if (media.status === "active") {
      if (target === "camera") media.toggleCamera();
      else media.toggleMicrophone();
      return;
    }
    if (media.status !== "requesting") void media.request();
  };
  const checkPresenter = async () => {
    if (!presenterConfig.enabled) return;
    setPresenterCheck("checking");
    try {
      await presenterPreloader(presenterConfig.presenterUrl);
      setPresenterCheck("verified");
    } catch {
      setPresenterCheck("failed");
    }
  };
  const mediaReadiness = (target: "camera" | "microphone"): ReadinessItem => {
    const label = target === "camera" ? "鏡頭" : "麥克風";
    const enabled = target === "camera" ? media.cameraEnabled : media.microphoneEnabled;
    const actionLabel = target === "camera" ? "啟用鏡頭" : "啟用麥克風";
    if (media.status === "requesting") {
      return { id: target, label, state: "loading", detail: "正在請求鏡頭與麥克風權限" };
    }
    if (media.status === "active") {
      return enabled
        ? { id: target, label, state: "ready", detail: `${label}已開啟` }
        : { id: target, label, state: "needs-action", detail: `${label}已關閉`, action: { label: actionLabel, onClick: () => toggleOrRequestMedia(target) } };
    }
    const detail = media.status === "denied"
      ? media.errorMessage ?? "你尚未允許相機與麥克風權限。"
      : media.status === "unavailable"
        ? media.errorMessage ?? "此裝置無法使用鏡頭與麥克風。"
        : media.status === "error"
          ? media.errorMessage ?? "無法啟動鏡頭與麥克風。"
          : "尚未允許鏡頭與麥克風";
    return { id: target, label, state: "needs-action", detail, action: { label: actionLabel, onClick: () => toggleOrRequestMedia(target) } };
  };
  const voiceReadiness = (): ReadinessItem => {
    if (voice.status === "ready") return { id: "voice", label: "語音模型", state: "ready", detail: "本機語音模型已就緒" };
    if (voice.status === "loading-model") return { id: "voice", label: "語音模型", state: "loading", detail: voice.loadingMessage ?? "正在載入本機語音模型", action: { label: "取消載入", onClick: voice.releaseModel } };
    if (voice.status === "unsupported") return { id: "voice", label: "語音模型", state: "optional", detail: "此瀏覽器不支援本機語音轉錄" };
    if (voice.status === "denied") return { id: "voice", label: "語音模型", state: "needs-action", detail: "你尚未允許麥克風權限", action: { label: "開啟麥克風設定", onClick: () => onOpenSettings("audio") } };
    if (voice.status === "error") return { id: "voice", label: "語音模型", state: "optional", detail: voice.errorMessage ?? "本機語音模型無法使用" };
    return { id: "voice", label: "語音模型", state: "needs-action", detail: "尚未載入本機語音模型", action: { label: "載入本機語音模型", onClick: voice.loadModel } };
  };
  const presenterReadiness = (): ReadinessItem => {
    if (!presenterAvailable) return { id: "presenter", label: "3D 主管", state: "optional", detail: "尚未設定 3D 主管" };
    if (presenterCheck === "checking") return { id: "presenter", label: "3D 主管", state: "loading", detail: "正在檢查 3D 主管連線" };
    if (presenterCheck === "verified") return { id: "presenter", label: "3D 主管", state: "ready", detail: "連線已驗證", action: { label: "檢查 3D 主管", onClick: () => void checkPresenter() } };
    if (presenterCheck === "failed") return { id: "presenter", label: "3D 主管", state: "optional", detail: "3D 主管連線暫時無法驗證", action: { label: "檢查 3D 主管", onClick: () => void checkPresenter() } };
    return { id: "presenter", label: "3D 主管", state: "needs-action", detail: "尚未檢查 3D 主管連線", action: { label: "檢查 3D 主管", onClick: () => void checkPresenter() } };
  };
  const readiness = [mediaReadiness("camera"), mediaReadiness("microphone"), voiceReadiness(), presenterReadiness()];
  const hasUnfinishedReadiness = readiness.some((item) => item.state !== "ready");

  return (
    <section className="prejoin-lobby" aria-labelledby="prejoin-title">
      <header className="prejoin-header"><NuvaBrand /></header>
      <div className="prejoin-grid">
        <section className="prejoin-preview" aria-label="你的本機預覽">
          <div className="prejoin-preview-heading">
            <p>會前準備</p>
            <h2>確認你的裝置</h2>
          </div>
          <LocalCameraTile
            previewStream={media.stream}
            showControl={false}
            showStatus={false}
            overlay={
              <div className="prejoin-preview-controls" aria-label="預覽裝置控制">
                <IconButton
                  className="prejoin-preview-control"
                  disabled={media.status === "requesting"}
                  icon={media.status === "active" && media.microphoneEnabled ? "microphone" : "microphoneOff"}
                  label={media.status === "active" && media.microphoneEnabled ? "關閉麥克風" : "開啟麥克風"}
                  onClick={() => toggleOrRequestMedia("microphone")}
                  selected={media.status === "active" && media.microphoneEnabled}
                  tone={media.status === "active" && media.microphoneEnabled ? "inverse" : "danger"}
                />
                <IconButton
                  className="prejoin-preview-control"
                  disabled={media.status === "requesting"}
                  icon={media.status === "active" && media.cameraEnabled ? "camera" : "cameraOff"}
                  label={media.status === "active" && media.cameraEnabled ? "關閉鏡頭" : "開啟鏡頭"}
                  onClick={() => toggleOrRequestMedia("camera")}
                  selected={media.status === "active" && media.cameraEnabled}
                  tone={media.status === "active" && media.cameraEnabled ? "inverse" : "danger"}
                />
                <ActionMenu
                  items={[
                    { id: "audio", label: "麥克風設定", icon: "microphone", onSelect: () => onOpenSettings("audio", deviceSettingsTrigger.current) },
                    { id: "video", label: "鏡頭設定", icon: "camera", onSelect: () => onOpenSettings("video", deviceSettingsTrigger.current) },
                  ]}
                  label="更多裝置選項"
                  tone="inverse"
                  triggerRef={deviceSettingsTrigger}
                />
              </div>
            }
          />
          {canRequestMedia && (
            <button type="button" className="prejoin-permission" onClick={() => void media.request()}>
              允許鏡頭與麥克風
            </button>
          )}
        </section>

        <aside className="prejoin-join-panel">
          <p className="prejoin-kicker">即將開始的練習</p>
          <h1 id="prejoin-title">{meeting.title}</h1>
          <p className="prejoin-time">{formatPracticeTimeRange(meeting, "zh-TW")}</p>
          <p>你將與 {scenario.manager.name} 進行 {meeting.durationMinutes} 分鐘的調薪談判練習。</p>
          <p>主管會在談判開始後加入</p>
          <button type="button" className="prejoin-join" onClick={onJoin}>立即進入會議室</button>
          <p className="early-entry-note">可以提早開始談判</p>
          {hasUnfinishedReadiness && <p className="prejoin-readiness-note">你仍可進入，未完成項目可在會議中開啟</p>}
          <ul className="prejoin-readiness" aria-label="準備狀態">
            {readiness.map((item) => (
              <li aria-label={`${item.label} ${readinessLabel(item.state)}`} key={item.id}>
                <Icon name={readinessIcon(item.state)} size={16} />
                <div>
                  <div className="prejoin-readiness-heading"><strong>{item.label}</strong><span data-state={item.state}>{readinessLabel(item.state)}</span></div>
                  <p>{item.detail}</p>
                </div>
                {item.action && <button type="button" onClick={item.action.onClick}>{item.action.label}</button>}
              </li>
            ))}
          </ul>
          <button type="button" className="prejoin-cancel" onClick={onCancel}>取消</button>
        </aside>
      </div>
    </section>
  );
}
