import { useState } from "react";
import { ScenarioWorkshop } from "./components/ScenarioWorkshop";
import type { Scenario } from "./domain/scenario";

export function App() {
  const [startedScenario, setStartedScenario] = useState<Scenario | null>(null);

  return (
    <main>
      <h1>Raise Room</h1>
      <p>你的練習資料預設只留在這台裝置。</p>
      <p>視覺 coaching 尚未啟用</p>
      <ScenarioWorkshop onStart={setStartedScenario} />
      {startedScenario && (
        <p role="status">
          已帶入 {startedScenario.manager.name} 的薪資檢討情境。
        </p>
      )}
    </main>
  );
}
