import { useState } from "react";
import { MeetingRoom } from "./components/MeetingRoom";
import { ScenarioWorkshop } from "./components/ScenarioWorkshop";
import { simulatedResponder } from "./domain/meeting";
import type { Scenario } from "./domain/scenario";

export function App() {
  const [startedScenario, setStartedScenario] = useState<Scenario | null>(null);
  const [meetingFinished, setMeetingFinished] = useState(false);

  const startMeeting = (scenario: Scenario) => {
    setMeetingFinished(false);
    setStartedScenario(scenario);
  };

  if (startedScenario) {
    return (
      <main>
        <MeetingRoom
          scenario={startedScenario}
          responder={simulatedResponder}
          onFinish={() => {
            setStartedScenario(null);
            setMeetingFinished(true);
          }}
        />
      </main>
    );
  }

  return (
    <main>
      <h1>Raise Room</h1>
      <p>你的練習資料預設只留在這台裝置。</p>
      <p>視覺 coaching 尚未啟用</p>
      <ScenarioWorkshop onStart={startMeeting} />
      {meetingFinished && (
        <p role="status">
          會議已結束，可回到設定調整情境後再練習。
        </p>
      )}
    </main>
  );
}
