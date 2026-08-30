import { useState } from "react";
import type { ScheduledPracticeMeeting } from "../domain/practice-schedule";
import { formatPracticeTimeRange } from "../domain/practice-schedule";
import type { Scenario } from "../domain/scenario";
import type { PresenterRuntimeConfig } from "../lib/perxona-config";
import { loadPresenterEngine } from "../lib/perxona-presenter";
import type { PracticeMediaController } from "../runtime/use-practice-media";
import type { useLocalVoice } from "../hooks/use-local-voice";
import { LocalCameraTile } from "./LocalCameraTile";
import { NuvaBrand } from "./NuvaBrand";

type VoiceController = ReturnType<typeof useLocalVoice>;
type PresenterCheckState = "idle" | "checking" | "verified" | "failed";

function mediaStatusLabel(media: PracticeMediaController) {
  if (media.status === "active") {
    return `麥克風：${media.microphoneEnabled ? "已開啟" : "已關閉"}；鏡頭：${media.cameraEnabled ? "已開啟" : "已關閉"}`;
  }
  if (media.status === "requesting") return "正在請求鏡頭與麥克風權限";
  if (media.status === "denied") return media.errorMessage ?? "你尚未允許相機與麥克風權限。";
  if (media.status === "unavailable") return media.errorMessage ?? "此裝置無法使用鏡頭與麥克風。";
  if (media.status === "error") return media.errorMessage ?? "無法啟動鏡頭與麥克風。";
  return "尚未允許鏡頭與麥克風";
}

function voiceStatusLabel(voice: VoiceController) {
  if (voice.status === "ready") return "本機語音模型已就緒";
  if (voice.status === "loading-model") return voice.loadingMessage ?? "正在載入本機語音模型";
  if (voice.status === "unsupported") return "此瀏覽器不支援本機語音轉錄";
  if (voice.status === "denied") return "你尚未允許麥克風權限";
  if (voice.status === "error") return voice.errorMessage ?? "本機語音模型無法使用";
  return "尚未載入本機語音模型";
}

export function PrejoinLobby({
  meeting,
  scenario,
  media,
  voice,
  presenterConfig,
  onJoin,
  onCancel,
  presenterPreloader = loadPresenterEngine,
}: {
  meeting: ScheduledPracticeMeeting;
  scenario: Scenario;
  media: PracticeMediaController;
  voice: VoiceController;
  presenterConfig: PresenterRuntimeConfig;
  onJoin: () => void;
  onCancel: () => void;
  presenterPreloader?: (url: string) => Promise<void>;
}) {
  const [presenterCheck, setPresenterCheck] = useState<PresenterCheckState>("idle");
  const presenterAvailable = presenterConfig.enabled;
  const canRequestMedia = media.status !== "requesting" && media.status !== "active";
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

  return (
    <section className="prejoin-lobby" aria-labelledby="prejoin-title">
      <header className="prejoin-header"><NuvaBrand /></header>
      <div className="prejoin-grid">
        <section className="prejoin-preview" aria-label="你的本機預覽">
          <div className="prejoin-preview-heading">
            <p>會前準備</p>
            <h2>確認你的裝置</h2>
          </div>
          <LocalCameraTile previewStream={media.stream} showControl={false} />
          {canRequestMedia && (
            <button type="button" className="prejoin-permission" onClick={() => void media.request()}>
              允許鏡頭與麥克風
            </button>
          )}
          {media.status === "active" && (
            <div className="prejoin-device-controls" aria-label="裝置控制">
              <button
                type="button"
                className="prejoin-round-control"
                aria-label={media.microphoneEnabled ? "關閉麥克風" : "開啟麥克風"}
                onClick={media.toggleMicrophone}
              >
                麥克風
              </button>
              <button
                type="button"
                className="prejoin-round-control"
                aria-label={media.cameraEnabled ? "關閉鏡頭" : "開啟鏡頭"}
                onClick={media.toggleCamera}
              >
                鏡頭
              </button>
              <button
                type="button"
                className="prejoin-round-control"
                aria-label="返回排程設定"
                onClick={onCancel}
              >
                設定
              </button>
            </div>
          )}
          <dl className="prejoin-status-list">
            <div><dt>裝置</dt><dd>{mediaStatusLabel(media)}</dd></div>
            <div><dt>語音</dt><dd>{voiceStatusLabel(voice)}</dd></div>
            <div>
              <dt>3D 主管</dt>
              <dd>
                {!presenterAvailable && "尚未設定 3D 主管"}
                {presenterAvailable && presenterCheck === "idle" && "尚未檢查 3D 主管連線"}
                {presenterAvailable && presenterCheck === "checking" && "正在檢查 3D 主管連線"}
                {presenterAvailable && presenterCheck === "verified" && "連線已驗證"}
                {presenterAvailable && presenterCheck === "failed" && "3D 主管連線暫時無法驗證"}
              </dd>
            </div>
          </dl>
          {voice.status === "idle" && <button type="button" onClick={voice.loadModel}>載入本機語音模型</button>}
          {voice.status === "loading-model" && <button type="button" onClick={voice.releaseModel}>取消載入</button>}
          <button
            type="button"
            disabled={!presenterAvailable || presenterCheck === "checking"}
            onClick={() => void checkPresenter()}
          >
            檢查 3D 主管
          </button>
        </section>

        <aside className="prejoin-join-panel">
          <p className="prejoin-kicker">即將開始的練習</p>
          <h1 id="prejoin-title">{meeting.title}</h1>
          <p className="prejoin-time">{formatPracticeTimeRange(meeting, "zh-TW")}</p>
          <p>你將與 {scenario.manager.name} 進行 {meeting.durationMinutes} 分鐘的調薪談判練習。</p>
          <p>主管會在談判開始後加入</p>
          <button type="button" className="prejoin-join" onClick={onJoin}>立即進入會議室</button>
          <p className="early-entry-note">可以提早開始談判</p>
          <button type="button" className="prejoin-cancel" onClick={onCancel}>取消</button>
        </aside>
      </div>
    </section>
  );
}
