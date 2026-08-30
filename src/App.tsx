import { useState } from "react";
import { CoachingReport } from "./components/CoachingReport";
import { MeetingRoom } from "./components/MeetingRoom";
import { ScenarioWorkshop } from "./components/ScenarioWorkshop";
import { simulatedResponder } from "./domain/meeting";
import type { TranscriptTurn } from "./domain/meeting";
import type { Scenario } from "./domain/scenario";

type AppState =
  | { view: "setup" }
  | { view: "meeting"; scenario: Scenario }
  | { view: "report"; scenario: Scenario; transcript: TranscriptTurn[] };

export function App() {
  const [appState, setAppState] = useState<AppState>({ view: "setup" });

  const startMeeting = (scenario: Scenario) => {
    setAppState({ view: "meeting", scenario });
  };

  return (
    <main>
      <h1>Raise Room</h1>
      {appState.view === "meeting" && (
        <MeetingRoom
          scenario={appState.scenario}
          responder={simulatedResponder}
          onFinish={(transcript) => {
            setAppState({
              view: "report",
              scenario: appState.scenario,
              transcript,
            });
          }}
        />
      )}
      {appState.view === "report" && (
        <CoachingReport
          scenario={appState.scenario}
          transcript={appState.transcript}
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
