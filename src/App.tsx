import { useEffect, useState } from "react";
import { CoachingReport } from "./components/CoachingReport";
import { MeetingRoom } from "./components/MeetingRoom";
import { ScenarioWorkshop } from "./components/ScenarioWorkshop";
import type { TranscriptTurn } from "./domain/meeting";
import type { VisualSignals } from "./domain/visual";
import type { Scenario } from "./domain/scenario";
import { readPresenterRuntimeConfig } from "./lib/perxona-config";
import { createHybridManagerResponder } from "./lib/perxona-manager";

type AppState =
  | { view: "setup" }
  | { view: "meeting"; scenario: Scenario }
  | { view: "report"; scenario: Scenario; transcript: TranscriptTurn[]; visualSignals?: VisualSignals };

export function App() {
  const presenterConfig = readPresenterRuntimeConfig(import.meta.env);
  const [appState, setAppState] = useState<AppState>({ view: "setup" });
  const [managerResponder] = useState(() => createHybridManagerResponder());

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    if (appState.view === "meeting") {
      document.getElementById("meeting-room-title")?.focus();
    }
  }, [appState.view]);

  const startMeeting = (scenario: Scenario) => {
    setAppState({ view: "meeting", scenario });
  };

  return (
    <main className={appState.view === "meeting" ? "meeting-mode" : undefined}>
      <h1 className={appState.view === "meeting" ? "meeting-mode-title" : undefined}>
        Raise Room
      </h1>
      {appState.view === "meeting" && (
        <MeetingRoom
          scenario={appState.scenario}
          responder={managerResponder}
          presenterConfig={presenterConfig}
          onFinish={(transcript, visualSignals) => {
            setAppState({
              view: "report",
              scenario: appState.scenario,
              transcript,
              visualSignals,
            });
          }}
        />
      )}
      {appState.view === "report" && (
        <CoachingReport
          scenario={appState.scenario}
          transcript={appState.transcript}
          visualSignals={appState.visualSignals}
          onRetry={() => setAppState({ view: "meeting", scenario: appState.scenario })}
          onReset={() => setAppState({ view: "setup" })}
        />
      )}
      {appState.view === "setup" && (
        <>
          <p>你的練習資料預設只留在這台裝置。</p>
          <p>視覺教練功能尚未啟用</p>
          <ScenarioWorkshop onStart={startMeeting} />
        </>
      )}
    </main>
  );
}
