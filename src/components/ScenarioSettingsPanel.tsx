import type { RefObject } from "react";
import { getEventOffsetSeconds, type Scenario } from "../domain/scenario";
import type { PracticeDurationMinutes } from "../domain/practice-settings";

const personalityFields = [
  ["budgetDefensiveness", "預算防守"],
  ["evidenceDemand", "證據要求"],
  ["patience", "耐心"],
  ["directness", "直接程度"],
  ["warmth", "親和程度"],
  ["authority", "權威感"],
] as const;

export function ScenarioSettingsPanel({
  value,
  durationMinutes,
  onChange,
  section = "all",
  inputRefs,
}: {
  value: Scenario;
  durationMinutes: PracticeDurationMinutes;
  onChange(next: Scenario): void;
  section?: "all" | "scenario" | "managerPersonality" | "events";
  inputRefs?: Partial<Record<"role" | "reason" | "currentMonthlySalary" | "requestedMonthlySalary", RefObject<HTMLInputElement | HTMLTextAreaElement | null>>>;
}) {
  const updateNumber = (input: string, update: (numberValue: number) => Scenario) => {
    onChange(update(input === "" ? Number.NaN : Number(input)));
  };

  return (
    <div className="scenario-settings-panel">
      {(section === "all" || section === "scenario") && <fieldset>
        <legend>你的情境</legend>
        <div className="field-grid">
          <label>公司<input value={value.company} onChange={(event) => onChange({ ...value, company: event.target.value })} /></label>
          <label>職位<input ref={inputRefs?.role as RefObject<HTMLInputElement>} required value={value.role} onChange={(event) => onChange({ ...value, role: event.target.value })} /></label>
          <label>年資（月）<input min="0" type="number" value={Number.isFinite(value.tenureMonths) ? value.tenureMonths : ""} onChange={(event) => updateNumber(event.target.value, (tenureMonths) => ({ ...value, tenureMonths }))} /></label>
          <label>現薪（月）<input ref={inputRefs?.currentMonthlySalary as RefObject<HTMLInputElement>} required min="0" type="number" value={Number.isFinite(value.compensation.currentMonthlySalary) ? value.compensation.currentMonthlySalary : ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateNumber(event.target.value, (currentMonthlySalary) => ({ ...value, compensation: { ...value.compensation, currentMonthlySalary } }))} /></label>
          <label>期待月薪<input ref={inputRefs?.requestedMonthlySalary as RefObject<HTMLInputElement>} required min="0" type="number" value={Number.isFinite(value.compensation.requestedMonthlySalary) ? value.compensation.requestedMonthlySalary : ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateNumber(event.target.value, (requestedMonthlySalary) => ({ ...value, compensation: { ...value.compensation, requestedMonthlySalary } }))} /></label>
          <label>最低可接受結果（月）<input min="0" type="number" value={Number.isFinite(value.compensation.minimumMonthlySalary) ? value.compensation.minimumMonthlySalary : ""} onChange={(event) => updateNumber(event.target.value, (minimumMonthlySalary) => ({ ...value, compensation: { ...value.compensation, minimumMonthlySalary } }))} /></label>
        </div>
        <label>近期成果<textarea value={value.achievements} onChange={(event) => onChange({ ...value, achievements: event.target.value })} /></label>
        <label>會議原因<textarea ref={inputRefs?.reason as RefObject<HTMLTextAreaElement>} required value={value.reason} onChange={(event) => onChange({ ...value, reason: event.target.value })} /></label>
      </fieldset>}

      {(section === "all" || section === "managerPersonality") && <fieldset>
        <legend>主管設定</legend>
        <div className="field-grid">
          {section === "all" && <label>主管姓名<input required value={value.manager.name} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange({ ...value, manager: { ...value.manager, name: event.target.value } })} /></label>}
          {personalityFields.map(([key, label]) => (
            <label key={key}>{label}<select value={value.manager[key]} onChange={(event) => onChange({ ...value, manager: { ...value.manager, [key]: event.target.value } })}><option value="低">低</option><option value="中">中</option><option value="高">高</option></select></label>
          ))}
        </div>
        <label>主管隱藏立場<textarea value={value.manager.hiddenStance} onChange={(event) => onChange({ ...value, manager: { ...value.manager, hiddenStance: event.target.value } })} /></label>
        <label>主管補充角色指令（像 system prompt）<textarea value={value.manager.customInstructions} onChange={(event) => onChange({ ...value, manager: { ...value.manager, customInstructions: event.target.value } })} /></label>
        <p className="field-help">補充這位主管的說話方式；只會用在這場練習，不會取代上方人格設定。</p>
      </fieldset>}

      {(section === "all" || section === "events") && <fieldset>
        <legend>預設事件</legend>
        <p className="field-help">事件時間會依會議長度自動計算。</p>
        {value.events.map((event, index) => (
          <div className="event-fields" key={event.id}>
            <p>事件 {index + 1}：第 {getEventOffsetSeconds(event, durationMinutes * 60) / 60} 分鐘觸發</p>
            <label>事件 {index + 1} 名稱<input value={event.label} onChange={(input) => onChange({ ...value, events: value.events.map((current) => current.id === event.id ? { ...current, label: input.target.value } : current) })} /></label>
            <label>事件 {index + 1} 指令<input value={event.instruction} onChange={(input) => onChange({ ...value, events: value.events.map((current) => current.id === event.id ? { ...current, instruction: input.target.value } : current) })} /></label>
          </div>
        ))}
      </fieldset>}
    </div>
  );
}
