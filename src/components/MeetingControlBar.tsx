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
  onVoiceAction(): void;
  onCameraToggle(): void;
  onOpenPanel(tab: MeetingPanelTab): void;
  onFinish(): void;
};

function voiceControl(status: VoiceStatus) {
  if (status === "recording") {
    return { icon: "microphone" as const, label: "停止並轉成文字", selected: true, disabled: false };
  }

  if (status === "requesting-microphone" || status === "transcribing" || status === "loading-model") {
    return { icon: "microphoneOff" as const, label: "開始說話", selected: false, disabled: true };
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
  const moreItems = [
    { id: "voice", label: "語音與逐字稿", icon: "captions" as const, onSelect: () => onOpenPanel("transcript") },
    { id: "observations", label: "本機觀察", icon: "info" as const, onSelect: () => onOpenPanel("observations") },
    { id: "devices", label: "裝置狀態", icon: "devices" as const, onSelect: () => onOpenPanel("devices") },
    { id: "information", label: "會議資訊", icon: "info" as const, onSelect: () => onOpenPanel("transcript") },
  ];

  return (
    <div className="meeting-control-bar" role="toolbar" aria-label="會議控制">
      <IconButton
        disabled={voice.disabled}
        icon={voice.icon}
        label={voice.label}
        onClick={onVoiceAction}
        selected={voice.selected}
        tone="inverse"
        tooltipDelayMs={500}
      />
      <IconButton
        disabled={cameraRequesting}
        icon={cameraActive ? "camera" : "cameraOff"}
        label={cameraActive ? "關閉我的鏡頭" : "開啟我的鏡頭"}
        onClick={onCameraToggle}
        selected={cameraActive}
        tone="inverse"
        tooltipDelayMs={500}
      />
      <IconButton
        icon="captions"
        label="開啟逐字稿"
        onClick={() => onOpenPanel("transcript")}
        selected={panelOpen && activePanelTab === "transcript"}
        tone="inverse"
        tooltipDelayMs={500}
      />
      <IconButton
        icon="events"
        label="開啟壓力事件"
        onClick={() => onOpenPanel("events")}
        selected={panelOpen && activePanelTab === "events"}
        tone="inverse"
        tooltipDelayMs={500}
      />
      <ActionMenu items={moreItems} label="更多會議選項" tone="inverse" />
      <IconButton icon="leave" label="離開並查看報告" onClick={onFinish} tone="danger" tooltipDelayMs={500} />
    </div>
  );
}
