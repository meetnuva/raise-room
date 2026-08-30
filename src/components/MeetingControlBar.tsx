import { useRef } from "react";
import type { VoiceStatus } from "../hooks/use-local-voice";
import { ActionMenu } from "./ui/ActionMenu";
import { IconButton } from "./ui/IconButton";
import type { MeetingPanelTab } from "./MeetingSidePanel";

type Props = {
  voiceStatus: VoiceStatus;
  cameraActive: boolean;
  cameraRequesting: boolean;
  panelOpen: boolean;
  activePanelTab: MeetingPanelTab;
  onVoiceAction(opener: HTMLButtonElement): void;
  onCameraToggle(): void;
  onOpenPanel(tab: MeetingPanelTab, opener: HTMLButtonElement | null): void;
  onFinish(): void;
};

function voiceControl(status: VoiceStatus) {
  if (status === "recording") {
    return { icon: "microphone" as const, label: "停止並轉成文字", selected: true, disabled: false };
  }

  if (status === "requesting-microphone" || status === "transcribing" || status === "loading-model" || status === "denied" || status === "unsupported" || status === "error") {
    const reason = status === "denied" ? "麥克風權限已拒絕，請改用文字輸入。" : status === "unsupported" ? "此瀏覽器不支援本機語音，請改用文字輸入。" : "語音目前無法使用，請改用文字輸入。";
    return { icon: "microphoneOff" as const, label: "開始說話", selected: false, disabled: true, reason };
  }

  return { icon: "microphone" as const, label: "開始說話", selected: false, disabled: false };
}

export function MeetingControlBar({
  voiceStatus,
  cameraActive,
  cameraRequesting,
  panelOpen,
  activePanelTab,
  onVoiceAction,
  onCameraToggle,
  onOpenPanel,
  onFinish,
}: Props) {
  const voice = voiceControl(voiceStatus);
  const moreButton = useRef<HTMLButtonElement>(null);
  const moreItems = [
    { id: "voice", label: "語音與逐字稿", icon: "captions" as const, onSelect: () => onOpenPanel("transcript", moreButton.current) },
    { id: "observations", label: "本機觀察", icon: "info" as const, onSelect: () => onOpenPanel("observations", moreButton.current) },
    { id: "devices", label: "裝置狀態", icon: "devices" as const, onSelect: () => onOpenPanel("devices", moreButton.current) },
    { id: "information", label: "會議資訊", icon: "info" as const, onSelect: () => onOpenPanel("transcript", moreButton.current) },
  ];

  return (
    <div className="meeting-control-bar" role="toolbar" aria-label="會議控制">
      <IconButton
        disabled={voice.disabled}
        aria-describedby={voice.reason ? "meeting-voice-unavailable-reason" : undefined}
        icon={voice.icon}
        label={voice.label}
        onClick={(event) => onVoiceAction(event.currentTarget)}
        selected={voice.selected}
        tone="inverse"
        tooltipDelayMs={500}
      />
      {voice.reason && <span className="visually-hidden" id="meeting-voice-unavailable-reason">{voice.reason}</span>}
      <IconButton
        disabled={cameraRequesting}
        icon={cameraActive ? "camera" : "cameraOff"}
        label={cameraActive ? "關閉我的鏡頭" : "開啟我的鏡頭"}
        onClick={onCameraToggle}
        selected={cameraActive}
        tone={cameraActive ? "inverse" : "danger"}
        tooltipDelayMs={500}
      />
      <IconButton
        icon="captions"
        label="開啟逐字稿"
        onClick={(event) => onOpenPanel("transcript", event.currentTarget)}
        selected={panelOpen && activePanelTab === "transcript"}
        tone="inverse"
        tooltipDelayMs={500}
      />
      <IconButton
        icon="events"
        label="開啟壓力事件"
        onClick={(event) => onOpenPanel("events", event.currentTarget)}
        selected={panelOpen && activePanelTab === "events"}
        tone="inverse"
        tooltipDelayMs={500}
      />
      <ActionMenu items={moreItems} label="更多會議選項" tone="inverse" triggerRef={moreButton} />
      <IconButton icon="leave" label="離開並查看報告" onClick={onFinish} tone="danger" tooltipDelayMs={500} />
    </div>
  );
}
