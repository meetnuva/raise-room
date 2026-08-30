import { useEffect, useRef, useState } from "react";
import {
  advanceMeeting,
  appendUserTurn,
  createMeeting,
  respondToUser,
  type ManagerResponder,
  type TranscriptTurn,
  type TurnDelivery,
} from "../domain/meeting";
import type { AsrModelPresetId } from "../domain/asr-models";
import { formatPracticeTimeRange, type ScheduledPracticeMeeting } from "../domain/practice-schedule";
import type { Scenario } from "../domain/scenario";
import type { VisualSignals } from "../domain/visual";
import { useLocalCamera } from "../hooks/use-local-camera";
import { useLocalVision } from "../hooks/use-local-vision";
import { useLocalVoice } from "../hooks/use-local-voice";
import { useMeetingClock } from "../hooks/use-meeting-clock";
import type { PresenterRuntimeConfig } from "../lib/perxona-config";
import type { PracticeMediaController } from "../runtime/use-practice-media";
import { LocalCameraTile } from "./LocalCameraTile";
import { DeviceSettingsPanel, type DeviceSettingsDevice } from "./DeviceSettingsPanel";
import { LocalVisualControl } from "./LocalVisualControl";
import { LocalVoiceControl } from "./LocalVoiceControl";
import { MeetingControlBar } from "./MeetingControlBar";
import { MeetingSidePanel } from "./MeetingSidePanel";
import type { MeetingPanelTab } from "./MeetingSidePanel";
import { PerxonaManagerStage } from "./PerxonaManagerStage";
import { ParticipantMenu } from "./ParticipantMenu";
import { ToastRegion, type MeetingToast } from "./ToastRegion";

type VoiceController = ReturnType<typeof useLocalVoice>;
type Clock = {
  durationSeconds?: number;
  now?: () => number;
  intervalMs?: number;
};
type MeetingCamera = {
  stream: MediaStream | null;
  cameraActive: boolean;
  requesting: boolean;
  toggle(): void;
};
type StageFocus = "manager" | "self";

export type MeetingRoomProps = {
  meeting: ScheduledPracticeMeeting;
  scenario: Scenario;
  camera?: PracticeMediaController;
  voice?: VoiceController;
  responder: ManagerResponder;
  onFinish?: (transcript: TranscriptTurn[], visualSignals?: VisualSignals) => void;
  presenterConfig?: PresenterRuntimeConfig;
  clock?: Clock;
  modelPreset?: AsrModelPresetId;
  selectedDeviceIds?: Partial<Record<MediaDeviceKind, string>>;
  onSelectDevice?: (device: DeviceSettingsDevice) => void;
};

type MeetingRoomViewProps = Omit<MeetingRoomProps, "camera" | "voice" | "modelPreset"> & {
  camera: MeetingCamera;
  voice: VoiceController;
};

function formatCountdown(elapsedSeconds: number, durationSeconds: number) {
  const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function localCameraAdapter(camera: ReturnType<typeof useLocalCamera>): MeetingCamera {
  return {
    stream: camera.stream,
    cameraActive: camera.status === "active",
    requesting: camera.status === "requesting",
    toggle: () => {
      if (camera.status === "active") {
        camera.stop();
      } else {
        void camera.start();
      }
    },
  };
}

function injectedCameraAdapter(camera: PracticeMediaController): MeetingCamera {
  return {
    stream: camera.stream,
    cameraActive: camera.cameraEnabled,
    requesting: camera.status === "requesting",
    toggle: () => {
      if (camera.status === "active" && camera.stream) {
        camera.toggleCamera();
      } else {
        void camera.request();
      }
    },
  };
}

function MeetingRoomView({
  meeting: scheduledMeeting,
  scenario,
  camera,
  voice,
  responder,
  onFinish,
  presenterConfig = { enabled: false, reason: "missing-key" },
  clock,
  selectedDeviceIds,
  onSelectDevice,
}: MeetingRoomViewProps) {
  const durationSeconds = clock?.durationSeconds ?? scheduledMeeting.durationMinutes * 60;
  const [meeting, setMeeting] = useState(() => createMeeting(scenario, durationSeconds));
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [toasts, setToasts] = useState<MeetingToast[]>([]);
  const [stageFocus, setStageFocus] = useState<StageFocus>("manager");
  const [pinnedParticipant, setPinnedParticipant] = useState<"manager" | "self" | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMotion, setPanelMotion] = useState<"entering" | "entered">("entered");
  const [activePanelTab, setActivePanelTab] = useState<MeetingPanelTab>("transcript");
  const [voiceActionRequest, setVoiceActionRequest] = useState(0);
  const [cameraVideoElement, setCameraVideoElement] = useState<HTMLVideoElement | null>(null);
  const meetingRef = useRef(meeting);
  const panelOpener = useRef<HTMLButtonElement | null>(null);
  const vision = useLocalVision({ videoElement: cameraVideoElement });
  const latestTurn = meeting.transcript[meeting.transcript.length - 1];
  const managerEngineStatus =
    latestTurn?.speaker === "manager"
      ? latestTurn.managerSource === "perxona"
        ? "主管引擎：Perxona 動態主管"
        : "主管引擎：本機腳本 fallback"
      : "主管引擎：等待首次回覆";

  const addToast = (toast: MeetingToast) => {
    setToasts((current) => [...current.filter((item) => item.id !== toast.id), toast]);
  };

  useEffect(() => {
    addToast({ id: "manager-engine", tone: "notice", message: managerEngineStatus, durationMs: 4000 });
  }, [managerEngineStatus]);

  const finishMeeting = (transcript: TranscriptTurn[]) => {
    vision.stopObserving();
    const signals = vision.getSignals();

    if (signals.sampleCount > 0) {
      onFinish?.(transcript, signals);
    } else {
      onFinish?.(transcript);
    }
  };

  const advanceTo = (elapsedSeconds: number) => {
    setMeeting((current) => {
      const next = advanceMeeting(current, elapsedSeconds);
      meetingRef.current = next;
      return next;
    });
  };

  useMeetingClock({
    durationSeconds,
    onTick: advanceTo,
    onComplete: () => finishMeeting(meetingRef.current.transcript),
    now: clock?.now,
    intervalMs: clock?.intervalMs,
  });

  const submitUserMessage = async (text: string, delivery: TurnDelivery) => {
    if (!text.trim() || sending) return;

    const userTurn = appendUserTurn(meetingRef.current, text.trim(), delivery);
    meetingRef.current = userTurn;
    setMeeting(userTurn);
    setSending(true);

    try {
      const repliedMeeting = await respondToUser(userTurn, scenario, responder);
      const managerTurn = repliedMeeting.transcript[repliedMeeting.transcript.length - 1];
      setToasts((current) => current.filter((toast) => toast.id !== "send-error"));
      if (managerTurn.speaker === "manager" && managerTurn.managerNotice) {
        addToast({ id: "manager-notice", tone: "notice", message: managerTurn.managerNotice, durationMs: 4000 });
      }
      setMeeting((current) => {
        const next = { ...current, transcript: [...current.transcript, managerTurn] };
        meetingRef.current = next;
        return next;
      });
    } catch {
      addToast({ id: "send-error", tone: "error", message: "主管回覆暫時無法取得，請重新送出。" });
    } finally {
      setSending(false);
    }
  };

  const developmentFallback = import.meta.env.MODE === "test" ? (
    <form
      className="development-fallback"
      onSubmit={(event) => {
        event.preventDefault();
        const text = draft.trim();

        if (!text) return;
        setDraft("");
        void submitUserMessage(text, { source: "text" });
      }}
    >
      <label htmlFor="development-message">開發用文字輸入</label>
      <div>
        <input
          id="development-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="暫代語音輸入，僅供開發測試"
          disabled={sending}
        />
        <button disabled={sending} type="submit">送出</button>
      </div>
    </form>
  ) : undefined;
  const firstEventOffset = scenario.events.length
    ? Math.min(...scenario.events.map((event) => event.triggerRatio * durationSeconds))
    : 0;
  useEffect(() => {
    if (panelOpen && panelMotion === "entering") setPanelMotion("entered");
  }, [panelMotion, panelOpen]);

  const openPanel = (tab: MeetingPanelTab, opener: HTMLButtonElement | null) => {
    if (opener) panelOpener.current = opener;
    setActivePanelTab(tab);
    setPanelMotion("entering");
    setPanelOpen(true);
  };
  const closePanel = () => {
    setPanelOpen(false);
    panelOpener.current?.focus();
  };
  const voiceContent = (
    <>
      <section className="meeting-information-summary" aria-label="會議資訊內容">
        <h3>會議資訊</h3>
        <p>{formatPracticeTimeRange(scheduledMeeting, "zh-TW")}</p>
      </section>
      <LocalVoiceControl
        actionRequest={voiceActionRequest}
        voice={voice}
        onTranscript={(result, editedText) => {
          void submitUserMessage(editedText, {
            source: "voice",
            durationSeconds: result.durationSeconds,
            modelPreset: result.modelPreset,
            language: result.language,
          });
        }}
        disabled={sending}
      />
    </>
  );
  const deviceContent = (
    <div className="meeting-device-status">
      <p>鏡頭：{camera.cameraActive ? "已開啟" : "未開啟"}</p>
      <p>語音：{voice.status === "ready" || voice.status === "recording" ? "本機模型已就緒" : "尚未就緒"}</p>
      <p>選擇會套用到下一次明確請求裝置權限。</p>
      <DeviceSettingsPanel kinds={["audioinput", "audiooutput", "videoinput"]} selectedDeviceIds={selectedDeviceIds} onSelectDevice={onSelectDevice ?? (() => {})} />
    </div>
  );

  return (
    <section aria-labelledby="meeting-room-title" className="meeting-room">
      <header className="meeting-header">
        <div>
          <h2 id="meeting-room-title" tabIndex={-1}>{scheduledMeeting.title}</h2>
        </div>
        <div className="meeting-header-actions">
          <p
            className="meeting-countdown"
            aria-label={`剩餘時間 ${formatCountdown(meeting.elapsedSeconds, durationSeconds)}`}
          >
            剩餘 {formatCountdown(meeting.elapsedSeconds, durationSeconds)}
          </p>
        </div>
      </header>
      <ToastRegion toasts={toasts.map((toast) => ({ ...toast, onDismiss: (id: string) => setToasts((current) => current.filter((item) => item.id !== id)) }))} />

      <div className={panelOpen ? "meeting-layout panel-open" : "meeting-layout"}>
        <div className={`meeting-stages stage-focus-${stageFocus}`} aria-label="會議雙人畫面">
          <PerxonaManagerStage
            managerName={scenario.manager.name}
            config={presenterConfig}
            latestManagerText={latestTurn?.speaker === "manager" ? latestTurn.text : null}
            pinned={pinnedParticipant === "manager"}
            onTogglePin={() => setPinnedParticipant((current) => current === "manager" ? null : "manager")}
            onViewRole={() => addToast({ id: "manager-role", tone: "notice", message: `主管角色：${scenario.role} · 直接度${scenario.manager.directness}`, durationMs: 4000 })}
            onOpenInfo={(opener) => openPanel("transcript", opener)}
            onPresenterError={(message) => addToast({ id: "presenter-error", tone: "error", message })}
          />
          <aside className="meeting-sidebar">
            <LocalCameraTile
              previewStream={camera.stream}
              detail={`${scenario.company} · ${scenario.tenureMonths} 個月年資`}
              showControl={false}
              onVideoElement={setCameraVideoElement}
              pinned={pinnedParticipant === "self"}
              tileActions={<ParticipantMenu kind="self" pinned={pinnedParticipant === "self"} expanded={stageFocus === "self"} onToggleExpand={() => setStageFocus((current) => current === "self" ? "manager" : "self")} onTogglePin={() => setPinnedParticipant((current) => current === "self" ? null : "self")} onOpenDevices={(opener) => openPanel("devices", opener)} />}
            />
          </aside>
        </div>
        {panelOpen && (
          <MeetingSidePanel
            activeTab={activePanelTab}
            motion={panelMotion}
            onActiveTabChange={setActivePanelTab}
            transcript={meeting.transcript}
            events={scenario.events}
            emittedEventIds={meeting.emittedEventIds}
            durationSeconds={durationSeconds}
            managerName={scenario.manager.name}
            observationContent={<LocalVisualControl vision={vision} cameraActive={camera.cameraActive} />}
            voiceContent={voiceContent}
            deviceContent={deviceContent}
            transcriptFallback={developmentFallback}
            onClose={closePanel}
          />
        )}
      </div>

      {panelOpen && <button aria-label="關閉會議資訊面板遮罩" className="meeting-panel-scrim" data-motion={panelMotion} onClick={closePanel} type="button" />}
      <div className="meeting-controls">
        <MeetingControlBar
          cameraActive={camera.cameraActive}
          cameraRequesting={camera.requesting}
          onCameraToggle={camera.toggle}
          onFinish={() => finishMeeting(meeting.transcript)}
          onOpenPanel={(tab, opener) => {
            openPanel(tab, opener);
          }}
          onVoiceAction={(opener) => {
            openPanel("transcript", opener);
            setVoiceActionRequest((current) => current + 1);
          }}
          activePanelTab={activePanelTab}
          panelOpen={panelOpen}
          voiceStatus={voice.status}
        />
        {import.meta.env.MODE === "test" && <button
          className="development-only"
          data-development-only="true"
          type="button"
          onClick={() => advanceTo(firstEventOffset)}
        >
          跳到第一個壓力事件
        </button>}
      </div>
    </section>
  );
}

function OwnedMeetingRoom(props: Omit<MeetingRoomProps, "camera" | "voice">) {
  const ownedCamera = useLocalCamera();
  const ownedVoice = useLocalVoice({ modelPreset: props.modelPreset });
  const { modelPreset: _modelPreset, ...viewProps } = props;

  return (
    <MeetingRoomView
      {...viewProps}
      camera={localCameraAdapter(ownedCamera)}
      voice={ownedVoice}
    />
  );
}

function CameraInjectedMeetingRoom({
  camera,
  ...props
}: MeetingRoomProps & { camera: PracticeMediaController }) {
  const ownedVoice = useLocalVoice({ modelPreset: props.modelPreset });
  const { voice: _voice, modelPreset: _modelPreset, ...viewProps } = props;

  return <MeetingRoomView {...viewProps} camera={injectedCameraAdapter(camera)} voice={ownedVoice} />;
}

function VoiceInjectedMeetingRoom({
  voice,
  ...props
}: MeetingRoomProps & { voice: VoiceController }) {
  const ownedCamera = useLocalCamera();
  const { camera: _camera, modelPreset: _modelPreset, ...viewProps } = props;

  return <MeetingRoomView {...viewProps} camera={localCameraAdapter(ownedCamera)} voice={voice} />;
}

function FullyInjectedMeetingRoom({
  camera,
  voice,
  ...props
}: MeetingRoomProps & { camera: PracticeMediaController; voice: VoiceController }) {
  const { modelPreset: _modelPreset, ...viewProps } = props;

  return <MeetingRoomView {...viewProps} camera={injectedCameraAdapter(camera)} voice={voice} />;
}

export function MeetingRoom(props: MeetingRoomProps) {
  if (props.camera && props.voice) {
    return <FullyInjectedMeetingRoom {...props} camera={props.camera} voice={props.voice} />;
  }
  if (props.camera) {
    return <CameraInjectedMeetingRoom {...props} camera={props.camera} />;
  }
  if (props.voice) {
    return <VoiceInjectedMeetingRoom {...props} voice={props.voice} />;
  }

  return <OwnedMeetingRoom {...props} />;
}
