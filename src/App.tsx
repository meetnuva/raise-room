import { useEffect, useRef, useState } from "react";
import { CoachingReport } from "./components/CoachingReport";
import { MeetingRoom } from "./components/MeetingRoom";
import { MeetHome } from "./components/MeetHome";
import { PracticeSession } from "./components/PracticeSession";
import { PracticeSettingsDialog, type PracticeSettingsDraft, type SettingsTarget } from "./components/PracticeSettingsDialog";
import { PrejoinLobby } from "./components/PrejoinLobby";
import { defaultAsrModelPresetId, type AsrModelPresetId } from "./domain/asr-models";
import type { TranscriptTurn } from "./domain/meeting";
import { createScheduledPracticeMeeting, type ScheduledPracticeMeeting } from "./domain/practice-schedule";
import { defaultPracticeSettings, type PracticeSettings } from "./domain/practice-settings";
import { defaultScenario, type Scenario } from "./domain/scenario";
import type { VisualSignals } from "./domain/visual";
import { readPresenterCatalog, selectPresenterConfig } from "./lib/perxona-config";
import { createHybridManagerResponder } from "./lib/perxona-manager";
import { practiceSettingsStorageKey, readPracticeSettings, writePracticeSettings } from "./lib/practice-settings-storage";
import { clearScenarioDraft, readScenarioDraft, writeScenarioDraft } from "./lib/scenario-storage";
import { readVoiceSettings, voiceSettingsStorageKey, writeVoiceSettings } from "./lib/voice-settings";
import type { DeviceSettingsDevice } from "./components/DeviceSettingsPanel";

type AppState =
  | { view: "home" }
  | { view: "settings"; target?: SettingsTarget }
  | { view: "practice"; phase: "lobby" | "meeting" }
  | { view: "report"; scenario: Scenario; transcript: TranscriptTurn[]; visualSignals?: VisualSignals };

function createMeeting(now: Date, scenario: Scenario, practice: PracticeSettings): ScheduledPracticeMeeting {
  return createScheduledPracticeMeeting({
    now,
    durationMinutes: practice.durationMinutes,
    managerName: scenario.manager.name,
    company: scenario.company,
    role: scenario.role,
  });
}

function reviseMeeting(
  meeting: ScheduledPracticeMeeting,
  scenario: Scenario,
  practice: PracticeSettings,
): ScheduledPracticeMeeting {
  const start = new Date(meeting.startsAt);
  return {
    id: `practice-${start.toISOString()}-${practice.durationMinutes}`,
    title: `與${scenario.manager.name}的年度調薪 1:1`,
    managerName: scenario.manager.name,
    company: scenario.company,
    role: scenario.role,
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + practice.durationMinutes * 60_000).toISOString(),
    durationMinutes: practice.durationMinutes,
  };
}

function readInitialScenario() {
  return typeof window === "undefined" ? defaultScenario : readScenarioDraft(window.localStorage);
}

function readInitialPractice() {
  return typeof window === "undefined" ? defaultPracticeSettings : readPracticeSettings(window.localStorage);
}

function readInitialVoicePreset(): AsrModelPresetId {
  return typeof window === "undefined" ? defaultAsrModelPresetId : readVoiceSettings(window.localStorage).modelPreset;
}

export function App({ now = () => new Date() }: { now?: () => Date } = {}) {
  const [documentNow] = useState(now);
  const [appState, setAppState] = useState<AppState>({ view: "home" });
  const [scenario, setScenario] = useState<Scenario>(readInitialScenario);
  const [practice, setPractice] = useState<PracticeSettings>(readInitialPractice);
  const [voicePreset, setVoicePreset] = useState<AsrModelPresetId>(readInitialVoicePreset);
  const [meeting, setMeeting] = useState(() => createMeeting(documentNow, scenario, practice));
  const [homeNow, setHomeNow] = useState(documentNow);
  const [presenterCatalog] = useState(() => readPresenterCatalog(import.meta.env));
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Partial<Record<MediaDeviceKind, string>>>({});
  const [managerResponder] = useState(() => createHybridManagerResponder());
  const restoreSettingsFocus = useRef(false);
  const nowRef = useRef(now);
  nowRef.current = now;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    if (appState.view === "practice" && appState.phase === "meeting") {
      document.getElementById("meeting-room-title")?.focus();
    }

    if (appState.view === "home" && restoreSettingsFocus.current) {
      restoreSettingsFocus.current = false;
      document.querySelector<HTMLButtonElement>("button[aria-label='設定']")?.focus();
    }
  }, [appState]);

  useEffect(() => {
    if (appState.view !== "home") return;

    const refreshSchedule = () => {
      const currentNow = nowRef.current();
      setHomeNow(currentNow);
      setMeeting((current) => (
        currentNow.getTime() >= new Date(current.endsAt).getTime()
          ? createMeeting(currentNow, scenario, practice)
          : current
      ));
    };

    refreshSchedule();
    const interval = window.setInterval(refreshSchedule, 60_000);

    return () => window.clearInterval(interval);
  }, [appState.view, practice, scenario]);

  const settingsValue: PracticeSettingsDraft = { scenario, practice, modelPreset: voicePreset };
  const presenterConfig = selectPresenterConfig(presenterCatalog, practice.managerPresentation);
  const closeSettings = () => {
    restoreSettingsFocus.current = true;
    setAppState({ view: "home" });
  };
  const saveSettings = (next: PracticeSettingsDraft) => {
    if (typeof window !== "undefined") {
      writeScenarioDraft(window.localStorage, next.scenario);
      writePracticeSettings(window.localStorage, next.practice);
      writeVoiceSettings(window.localStorage, { modelPreset: next.modelPreset });
    }
    setScenario(next.scenario);
    setPractice(next.practice);
    setVoicePreset(next.modelPreset);
    setMeeting((current) => reviseMeeting(current, next.scenario, next.practice));
    restoreSettingsFocus.current = true;
    setAppState({ view: "home" });
  };
  const clearSettings = () => {
    if (typeof window !== "undefined") {
      clearScenarioDraft(window.localStorage);
      window.localStorage.removeItem(practiceSettingsStorageKey);
      window.localStorage.removeItem(voiceSettingsStorageKey);
    }
    setScenario(defaultScenario);
    setPractice(defaultPracticeSettings);
    setVoicePreset(defaultAsrModelPresetId);
    setMeeting(createMeeting(documentNow, defaultScenario, defaultPracticeSettings));
    restoreSettingsFocus.current = true;
    setAppState({ view: "home" });
  };
  const selectDevice = (device: DeviceSettingsDevice) => {
    setSelectedDeviceIds((current) => ({ ...current, [device.kind]: device.deviceId }));
  };

  return (
    <main className={appState.view === "practice" && appState.phase === "meeting" ? "meeting-mode" : undefined}>
      {(appState.view === "home" || appState.view === "settings") && (
        <MeetHome
          meeting={meeting}
          now={homeNow}
          onOpenSettings={(target) => setAppState({ view: "settings", target })}
          onEnterLobby={() => setAppState({ view: "practice", phase: "lobby" })}
        />
      )}
      {appState.view === "settings" && (
        <PracticeSettingsDialog
          open
          value={settingsValue}
          presenterCatalog={presenterCatalog}
          selectedDeviceIds={selectedDeviceIds}
          onSelectDevice={selectDevice}
          initialTab={appState.target}
          onSave={saveSettings}
          onClear={clearSettings}
          onClose={closeSettings}
        />
      )}
      {appState.view === "practice" && (
        <PracticeSession modelPreset={voicePreset} selectedDeviceIds={selectedDeviceIds}>
          {({ media, voice }) => appState.phase === "lobby" ? (
            <PrejoinLobby
              meeting={meeting}
              scenario={scenario}
              media={media}
              voice={voice}
              presenterConfig={presenterConfig}
              onJoin={() => setAppState({ view: "practice", phase: "meeting" })}
              onCancel={() => setAppState({ view: "home" })}
              onOpenSettings={(target) => setAppState({ view: "settings", target })}
            />
          ) : (
            <MeetingRoom
              meeting={meeting}
              scenario={scenario}
              camera={media}
              voice={voice}
              responder={managerResponder}
              presenterConfig={presenterConfig}
              modelPreset={voicePreset}
              clock={{ durationSeconds: meeting.durationMinutes * 60 }}
              onFinish={(transcript, visualSignals) => {
                setAppState({ view: "report", scenario, transcript, visualSignals });
              }}
            />
          )}
        </PracticeSession>
      )}
      {appState.view === "report" && (
        <CoachingReport
          scenario={appState.scenario}
          transcript={appState.transcript}
          visualSignals={appState.visualSignals}
          onRetry={() => setAppState({ view: "practice", phase: "lobby" })}
          onReset={() => setAppState({ view: "home" })}
        />
      )}
    </main>
  );
}
