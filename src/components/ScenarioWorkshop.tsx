import { useState } from "react";
import {
  defaultScenario,
  pressureEventRatios,
  type PressureEventRatio,
  type Scenario,
} from "../domain/scenario";
import {
  clearScenarioDraft,
  readScenarioDraft,
  writeScenarioDraft,
} from "../lib/scenario-storage";

const personalityFields = [
  ["budgetDefensiveness", "預算防守"],
  ["evidenceDemand", "證據要求"],
  ["patience", "耐心"],
  ["directness", "直接程度"],
  ["warmth", "親和程度"],
  ["authority", "權威感"],
] as const;

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

  const updateNumber = (
    value: string,
    update: (numberValue: number) => Scenario,
  ) => {
    updateScenario(update(value === "" ? Number.NaN : Number(value)));
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

      <fieldset>
        <legend>你的情境</legend>
        <div className="field-grid">
          <label>
            公司
            <input
              value={scenario.company}
              onChange={(event) =>
                updateScenario({ ...scenario, company: event.target.value })
              }
            />
          </label>
          <label>
            職位
            <input
              required
              value={scenario.role}
              onChange={(event) =>
                updateScenario({ ...scenario, role: event.target.value })
              }
            />
          </label>
          <label>
            年資（月）
            <input
              min="0"
              type="number"
              value={Number.isFinite(scenario.tenureMonths) ? scenario.tenureMonths : ""}
              onChange={(event) =>
                updateNumber(event.target.value, (tenureMonths) => ({
                  ...scenario,
                  tenureMonths,
                }))
              }
            />
          </label>
          <label>
            現薪（月）
            <input
              required
              min="0"
              type="number"
              value={
                Number.isFinite(scenario.compensation.currentMonthlySalary)
                  ? scenario.compensation.currentMonthlySalary
                  : ""
              }
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) =>
                updateNumber(event.target.value, (currentMonthlySalary) => ({
                  ...scenario,
                  compensation: {
                    ...scenario.compensation,
                    currentMonthlySalary,
                  },
                }))
              }
            />
          </label>
          <label>
            期待月薪
            <input
              required
              min="0"
              type="number"
              value={
                Number.isFinite(scenario.compensation.requestedMonthlySalary)
                  ? scenario.compensation.requestedMonthlySalary
                  : ""
              }
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) =>
                updateNumber(event.target.value, (requestedMonthlySalary) => ({
                  ...scenario,
                  compensation: {
                    ...scenario.compensation,
                    requestedMonthlySalary,
                  },
                }))
              }
            />
          </label>
          <label>
            最低可接受結果（月）
            <input
              min="0"
              type="number"
              value={
                Number.isFinite(scenario.compensation.minimumMonthlySalary)
                  ? scenario.compensation.minimumMonthlySalary
                  : ""
              }
              onChange={(event) =>
                updateNumber(event.target.value, (minimumMonthlySalary) => ({
                  ...scenario,
                  compensation: {
                    ...scenario.compensation,
                    minimumMonthlySalary,
                  },
                }))
              }
            />
          </label>
        </div>
        <label>
          近期成果
          <textarea
            value={scenario.achievements}
            onChange={(event) =>
              updateScenario({ ...scenario, achievements: event.target.value })
            }
          />
        </label>
        <label>
          會議原因
          <textarea
            required
            value={scenario.reason}
            onChange={(event) =>
              updateScenario({ ...scenario, reason: event.target.value })
            }
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>主管設定</legend>
        <div className="field-grid">
          <label>
            主管姓名
            <input
              required
              value={scenario.manager.name}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) =>
                updateScenario({
                  ...scenario,
                  manager: { ...scenario.manager, name: event.target.value },
                })
              }
            />
          </label>
          {personalityFields.map(([key, label]) => (
            <label key={key}>
              {label}
              <select
                value={scenario.manager[key]}
                onChange={(event) =>
                  updateScenario({
                    ...scenario,
                    manager: { ...scenario.manager, [key]: event.target.value },
                  })
                }
              >
                <option value="低">低</option>
                <option value="中">中</option>
                <option value="高">高</option>
              </select>
            </label>
          ))}
        </div>
        <label>
          主管隱藏立場
          <textarea
            value={scenario.manager.hiddenStance}
            onChange={(event) =>
              updateScenario({
                ...scenario,
                manager: { ...scenario.manager, hiddenStance: event.target.value },
              })
            }
          />
        </label>
        <label>
          主管補充角色指令（像 system prompt）
          <textarea
            value={scenario.manager.customInstructions}
            onChange={(event) =>
              updateScenario({
                ...scenario,
                manager: { ...scenario.manager, customInstructions: event.target.value },
              })
            }
          />
        </label>
        <p className="field-help">補充這位主管的說話方式；只會用在這場練習，不會取代上方人格設定。</p>
      </fieldset>

      <fieldset>
        <legend>預設事件</legend>
        <p className="field-help">每個事件會在會議進行至指定分鐘時觸發。</p>
        {scenario.events.map((event, index) => (
          <div className="event-fields" key={event.id}>
            <label>
              事件 {index + 1} 分鐘
              <input
                min="0"
                type="number"
                value={event.triggerRatio * 10}
                onChange={(input) =>
                  updateScenario({
                    ...scenario,
                    events: scenario.events.map((existingEvent) =>
                      existingEvent.id === event.id &&
                      pressureEventRatios.includes(
                        (Number(input.target.value) / 10) as PressureEventRatio,
                      )
                        ? {
                            ...existingEvent,
                            triggerRatio: (Number(input.target.value) /
                              10) as PressureEventRatio,
                          }
                        : existingEvent,
                    ),
                  })
                }
              />
            </label>
            <label>
              事件 {index + 1} 名稱
              <input
                value={event.label}
                onChange={(input) =>
                  updateScenario({
                    ...scenario,
                    events: scenario.events.map((existingEvent) =>
                      existingEvent.id === event.id
                        ? { ...existingEvent, label: input.target.value }
                        : existingEvent,
                    ),
                  })
                }
              />
            </label>
            <label>
              事件 {index + 1} 指令
              <input
                value={event.instruction}
                onChange={(input) =>
                  updateScenario({
                    ...scenario,
                    events: scenario.events.map((existingEvent) =>
                      existingEvent.id === event.id
                        ? { ...existingEvent, instruction: input.target.value }
                        : existingEvent,
                    ),
                  })
                }
              />
            </label>
          </div>
        ))}
      </fieldset>

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
