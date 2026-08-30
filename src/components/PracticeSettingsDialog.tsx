import { useEffect, useRef, useState, type JSX } from "react";
import type { AsrModelPresetId } from "../domain/asr-models";
import {
  isPresenterPresentationAvailable,
  type PresenterCatalog,
} from "../lib/perxona-config";
import { hasWebGpuSupport } from "../lib/asr-runtime-config";
import type { PracticeSettings } from "../domain/practice-settings";
import type { Scenario } from "../domain/scenario";
import { DeviceSettingsPanel, type DeviceSettingsDevice } from "./DeviceSettingsPanel";
import { ScenarioSettingsPanel } from "./ScenarioSettingsPanel";
import { VoiceSettingsPanel } from "./VoiceSettings";

const tabs = ["音訊", "視訊", "語音模型", "主管角色", "主管個性", "會議", "隱私"] as const;
type SettingsTab = (typeof tabs)[number];

export interface PracticeSettingsDraft {
  scenario: Scenario;
  practice: PracticeSettings;
  modelPreset: AsrModelPresetId;
}

export function PracticeSettingsDialog({
  open,
  value,
  presenterCatalog,
  onSave,
  onClear,
  onClose,
  selectedDeviceIds,
  onSelectDevice,
}: {
  open: boolean;
  value: PracticeSettingsDraft;
  presenterCatalog: PresenterCatalog;
  onSave(value: PracticeSettingsDraft): void;
  onClear(): void;
  onClose(): void;
  selectedDeviceIds?: Partial<Record<MediaDeviceKind, string>>;
  onSelectDevice(device: DeviceSettingsDevice): void;
}): JSX.Element | null {
  const [draft, setDraft] = useState(value);
  const [selectedTab, setSelectedTab] = useState<SettingsTab>(tabs[0]);
  const [clearConfirmation, setClearConfirmation] = useState(false);
  const [focusTarget, setFocusTarget] = useState<"role" | "manager" | "reason" | "currentMonthlySalary" | "requestedMonthlySalary" | null>(null);
  const wasOpen = useRef(open);
  const initialTab = useRef<HTMLButtonElement>(null);
  const roleInput = useRef<HTMLInputElement>(null);
  const managerInput = useRef<HTMLInputElement>(null);
  const reasonInput = useRef<HTMLTextAreaElement>(null);
  const currentSalaryInput = useRef<HTMLInputElement>(null);
  const requestedSalaryInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const modalOpened = useRef(false);
  const supportsNativeModal = typeof HTMLDialogElement !== "undefined" && typeof HTMLDialogElement.prototype.showModal === "function";

  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraft(value);
      setSelectedTab(tabs[0]);
      setClearConfirmation(false);
    }
    wasOpen.current = open;
  }, [open, value]);

  useEffect(() => {
    if (!open) {
      modalOpened.current = false;
      return;
    }
    if (!supportsNativeModal || modalOpened.current || !dialog.current || dialog.current.open) return;
    dialog.current.showModal();
    modalOpened.current = true;
  }, [open, supportsNativeModal]);

  useEffect(() => {
    if (open) initialTab.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!focusTarget) return;
    ({
      role: roleInput,
      manager: managerInput,
      reason: reasonInput,
      currentMonthlySalary: currentSalaryInput,
      requestedMonthlySalary: requestedSalaryInput,
    })[focusTarget].current?.focus();
    setFocusTarget(null);
  }, [focusTarget, selectedTab]);

  if (!open) return null;

  const updateScenario = (scenario: Scenario) => setDraft((current) => ({ ...current, scenario }));
  const updatePractice = (practice: PracticeSettings) => setDraft((current) => ({ ...current, practice }));
  const close = () => {
    setClearConfirmation(false);
    onClose();
  };
  const validateAndSave = () => {
    if (!draft.scenario.role.trim()) {
      setSelectedTab("主管角色");
      setFocusTarget("role");
      return;
    }
    if (!draft.scenario.manager.name.trim()) {
      setSelectedTab("主管角色");
      setFocusTarget("manager");
      return;
    }
    if (!draft.scenario.reason.trim()) {
      setSelectedTab("主管角色");
      setFocusTarget("reason");
      return;
    }
    if (!Number.isFinite(draft.scenario.compensation.currentMonthlySalary) || draft.scenario.compensation.currentMonthlySalary < 0) {
      setSelectedTab("主管角色");
      setFocusTarget("currentMonthlySalary");
      return;
    }
    if (!Number.isFinite(draft.scenario.compensation.requestedMonthlySalary) || draft.scenario.compensation.requestedMonthlySalary < 0) {
      setSelectedTab("主管角色");
      setFocusTarget("requestedMonthlySalary");
      return;
    }
    onSave(draft);
  };

  return (
    <dialog ref={dialog} className="practice-settings-dialog" open={supportsNativeModal ? undefined : true} aria-label="練習設定" onCancel={(event) => { event.preventDefault(); close(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }}>
      <header className="practice-settings-header">
        <h2 id="practice-settings-title">練習設定</h2>
        <button aria-label="關閉設定" type="button" onClick={close}>×</button>
      </header>
      <div aria-label="練習設定分頁" className="practice-settings-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            aria-controls={`practice-settings-${tab}`}
            aria-selected={selectedTab === tab}
            id={`practice-settings-tab-${tab}`}
            key={tab}
            ref={tab === tabs[0] ? initialTab : undefined}
            role="tab"
            tabIndex={selectedTab === tab ? 0 : -1}
            type="button"
            onClick={() => setSelectedTab(tab)}
          >{tab}</button>
        ))}
      </div>
      <section aria-labelledby={`practice-settings-tab-${selectedTab}`} className="practice-settings-content" id={`practice-settings-${selectedTab}`} role="tabpanel">
        {selectedTab === "音訊" && <DeviceSettingsPanel kinds={["audioinput", "audiooutput"]} selectedDeviceIds={selectedDeviceIds} onSelectDevice={onSelectDevice} />}
        {selectedTab === "視訊" && <DeviceSettingsPanel kinds={["videoinput"]} selectedDeviceIds={selectedDeviceIds} onSelectDevice={onSelectDevice} />}
        {selectedTab === "語音模型" && <VoiceSettingsPanel hasWebGpu={typeof navigator !== "undefined" && hasWebGpuSupport(navigator.gpu)} selectedPreset={draft.modelPreset} onSelectedPresetChange={(modelPreset) => setDraft((current) => ({ ...current, modelPreset }))} />}
        {selectedTab === "主管角色" && <>
          <fieldset><legend>主管角色</legend>
            {(["male", "female"] as const).map((presentation) => {
              const available = isPresenterPresentationAvailable(presenterCatalog, presentation);
              const label = presentation === "male" ? "男性主管" : "女性主管";
              return <label key={presentation}><input checked={draft.practice.managerPresentation === presentation} disabled={!available} name="manager-presentation" type="radio" value={presentation} onChange={() => updatePractice({ ...draft.practice, managerPresentation: presentation })} />{label}{!available && " 此角色尚未設定"}</label>;
            })}
          </fieldset>
          <div className="practice-settings-fields">
            <label>主管姓名<input ref={managerInput} required value={draft.scenario.manager.name} onChange={(event) => updateScenario({ ...draft.scenario, manager: { ...draft.scenario.manager, name: event.target.value } })} /></label>
          </div>
          <ScenarioSettingsPanel section="scenario" inputRefs={{ role: roleInput, reason: reasonInput, currentMonthlySalary: currentSalaryInput, requestedMonthlySalary: requestedSalaryInput }} value={draft.scenario} durationMinutes={draft.practice.durationMinutes} onChange={updateScenario} />
        </>}
        {selectedTab === "主管個性" && <ScenarioSettingsPanel section="managerPersonality" value={draft.scenario} durationMinutes={draft.practice.durationMinutes} onChange={updateScenario} />}
        {selectedTab === "會議" && <>
          <fieldset><legend>會議長度</legend>{([5, 10, 20] as const).map((durationMinutes) => <label key={durationMinutes}><input checked={draft.practice.durationMinutes === durationMinutes} name="duration" type="radio" onChange={() => updatePractice({ ...draft.practice, durationMinutes })} />{durationMinutes} 分鐘</label>)}</fieldset>
          <ScenarioSettingsPanel section="events" value={draft.scenario} durationMinutes={draft.practice.durationMinutes} onChange={updateScenario} />
        </>}
        {selectedTab === "隱私" && <section className="practice-settings-privacy"><p>設定與草稿只儲存在這台裝置。</p><p>不會在未經你操作下讀取裝置、請求權限或載入語音模型。</p>{clearConfirmation ? <div><p>確定要清除本機設定與草稿嗎？</p><button type="button" onClick={() => { onClear(); setClearConfirmation(false); }}>確認清除</button><button type="button" onClick={() => setClearConfirmation(false)}>取消清除</button></div> : <button type="button" onClick={() => setClearConfirmation(true)}>清除本機設定與草稿</button>}</section>}
      </section>
      <footer className="practice-settings-actions"><button type="button" onClick={close}>取消</button><button type="button" onClick={validateAndSave}>儲存</button></footer>
    </dialog>
  );
}
