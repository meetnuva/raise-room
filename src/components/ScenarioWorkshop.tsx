import { useState } from "react";
import { defaultScenario, type Scenario } from "../domain/scenario";
import {
  clearScenarioDraft,
  readScenarioDraft,
  writeScenarioDraft,
} from "../lib/scenario-storage";
import { ScenarioSettingsPanel } from "./ScenarioSettingsPanel";

function hasRequiredFields(scenario: Scenario): boolean {
  const { compensation, manager } = scenario;

  return (
    scenario.role.trim().length > 0 &&
    Number.isFinite(compensation.currentMonthlySalary) &&
    Number.isFinite(compensation.requestedMonthlySalary) &&
    manager.name.trim().length > 0 &&
    scenario.reason.trim().length > 0
  );
}

export function ScenarioWorkshop({
  onStart,
}: {
  onStart: (scenario: Scenario) => void;
}) {
  const [scenario, setScenario] = useState<Scenario>(() =>
    readScenarioDraft(localStorage),
  );
  const [showRequiredHint, setShowRequiredHint] = useState(false);

  const updateScenario = (nextScenario: Scenario) => {
    setScenario(nextScenario);
    writeScenarioDraft(localStorage, nextScenario);
  };

  const startMeeting = () => {
    if (!hasRequiredFields(scenario)) {
      setShowRequiredHint(true);
      return;
    }

    setShowRequiredHint(false);
    onStart(scenario);
  };

  const clearDraft = () => {
    clearScenarioDraft(localStorage);
    setScenario(defaultScenario);
    setShowRequiredHint(false);
  };

  return (
    <section aria-labelledby="scenario-workshop-title" className="scenario-workshop">
      <div className="section-heading">
        <p className="eyebrow">僅限本機設定</p>
        <h2 id="scenario-workshop-title">設定這場薪資檢討</h2>
        <p>資料只會儲存在此瀏覽器，開始後交給模擬會議使用。</p>
      </div>

      <ScenarioSettingsPanel value={scenario} durationMinutes={10} onChange={updateScenario} />

      {showRequiredHint && (
        <p className="validation-message" role="alert">
          請完成職位、現薪、期待薪資、主管姓名與會議原因。
        </p>
      )}
      <div className="workshop-actions">
        <button type="button" onClick={clearDraft}>
          清除本機草稿
        </button>
        <button type="button" onClick={startMeeting}>
          進入會議大廳
        </button>
      </div>
    </section>
  );
}
