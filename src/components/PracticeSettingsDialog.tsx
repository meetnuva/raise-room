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
import { Icon, type IconName } from "./ui/Icons";

export type SettingsTarget = "audio" | "video" | "voice" | "manager" | "personality" | "meeting" | "privacy";

const tabs: ReadonlyArray<{ id: SettingsTarget; label: string; icon: IconName }> = [
  { id: "audio", label: "音訊", icon: "microphone" }, { id: "video", label: "視訊", icon: "camera" },
  { id: "voice", label: "語音模型", icon: "captions" }, { id: "manager", label: "主管角色", icon: "account" },
  { id: "personality", label: "主管個性", icon: "info" }, { id: "meeting", label: "會議", icon: "meeting" },
  { id: "privacy", label: "隱私", icon: "settings" },
] as const;

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
  initialTab,
}: {
  open: boolean;
  value: PracticeSettingsDraft;
  presenterCatalog: PresenterCatalog;
  onSave(value: PracticeSettingsDraft): void;
  onClear(): void;
  onClose(): void;
  selectedDeviceIds?: Partial<Record<MediaDeviceKind, string>>;
  onSelectDevice(device: DeviceSettingsDevice): void;
  initialTab?: SettingsTarget;
}): JSX.Element | null {
  const [draft, setDraft] = useState(value);
  const [selectedTab, setSelectedTab] = useState<SettingsTarget>(initialTab ?? "audio");
  const [clearConfirmation, setClearConfirmation] = useState(false);
  const [motion, setMotion] = useState<"entering" | "entered" | "leaving">(open ? "entering" : "leaving");
  const [focusTarget, setFocusTarget] = useState<"role" | "manager" | "reason" | "currentMonthlySalary" | "requestedMonthlySalary" | null>(null);
  const wasOpen = useRef(open);
  const tabRefs = useRef<Partial<Record<SettingsTarget, HTMLButtonElement | null>>>({});
  const clearCancel = useRef<HTMLButtonElement>(null);
  const roleInput = useRef<HTMLInputElement>(null);
  const managerInput = useRef<HTMLInputElement>(null);
  const reasonInput = useRef<HTMLTextAreaElement>(null);
  const currentSalaryInput = useRef<HTMLInputElement>(null);
  const requestedSalaryInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const modalOpened = useRef(false);
  const closeTimer = useRef<number | null>(null);
  const enterTimer = useRef<number | null>(null);
  const supportsNativeModal = typeof HTMLDialogElement !== "undefined" && typeof HTMLDialogElement.prototype.showModal === "function";

  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraft(value);
      setSelectedTab(initialTab ?? "audio");
      setClearConfirmation(false);
    }
    wasOpen.current = open;
  }, [initialTab, open, value]);

  useEffect(() => {
    if (enterTimer.current !== null) window.clearTimeout(enterTimer.current);
    if (!open) return undefined;
    setMotion("entering");
    enterTimer.current = window.setTimeout(() => setMotion("entered"), 0);
    return () => {
      if (enterTimer.current !== null) window.clearTimeout(enterTimer.current);
      enterTimer.current = null;
    };
  }, [open]);

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

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
    if (!open) return;
    const tab = tabRefs.current[selectedTab];
    tab?.focus();
    if (typeof tab?.scrollIntoView === "function") {
      tab.scrollIntoView({ block: "nearest", inline: "center" });
    }
  }, [open, selectedTab]);

  useEffect(() => {
    if (clearConfirmation) clearCancel.current?.focus();
  }, [clearConfirmation]);

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

  const isClosing = motion === "leaving";
  const updateScenario = (scenario: Scenario) => {
    if (isClosing) return;
    setDraft((current) => ({ ...current, scenario }));
  };
  const updatePractice = (practice: PracticeSettings) => {
    if (isClosing) return;
    setDraft((current) => ({ ...current, practice }));
  };
  const selectTab = (tab: SettingsTarget) => {
    if (!isClosing) setSelectedTab(tab);
  };
  const close = () => {
    if (closeTimer.current !== null) return;
    setMotion("leaving");
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      onClose();
    }, 180);
  };
  const validateAndSave = () => {
    if (isClosing) return;
    if (!draft.scenario.role.trim()) {
      setSelectedTab("manager");
      setFocusTarget("role");
      return;
    }
    if (!draft.scenario.manager.name.trim()) {
      setSelectedTab("manager");
      setFocusTarget("manager");
      return;
    }
    if (!draft.scenario.reason.trim()) {
      setSelectedTab("manager");
      setFocusTarget("reason");
      return;
    }
    if (!Number.isFinite(draft.scenario.compensation.currentMonthlySalary) || draft.scenario.compensation.currentMonthlySalary < 0) {
      setSelectedTab("manager");
      setFocusTarget("currentMonthlySalary");
      return;
    }
    if (!Number.isFinite(draft.scenario.compensation.requestedMonthlySalary) || draft.scenario.compensation.requestedMonthlySalary < 0) {
      setSelectedTab("manager");
      setFocusTarget("requestedMonthlySalary");
      return;
    }
    onSave(draft);
  };
  const requestClear = () => {
    if (!isClosing) setClearConfirmation(true);
  };
  const confirmClear = () => {
    if (isClosing) return;
    onClear();
    setClearConfirmation(false);
  };
  const selectTabFromKeyboard = (tab: SettingsTarget, key: string) => {
    if (isClosing) return;
    const direction = key === "ArrowDown" || key === "ArrowRight" ? 1 : key === "ArrowUp" || key === "ArrowLeft" ? -1 : 0;
    if (!direction) return;
    const tabIndex = tabs.findIndex(({ id }) => id === tab);
    const nextTab = tabs[(tabIndex + direction + tabs.length) % tabs.length].id;
    selectTab(nextTab);
  };

  return (
    <dialog ref={dialog} className="practice-settings-dialog" data-motion={motion} open={supportsNativeModal ? undefined : true} aria-label="練習設定" onCancel={(event) => { event.preventDefault(); close(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }}>
      <header className="practice-settings-header">
        <h2 id="practice-settings-title">練習設定</h2>
        <button aria-label="關閉設定" disabled={isClosing} type="button" onClick={close}>×</button>
      </header>
      <div aria-label="練習設定分頁" className="practice-settings-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            aria-controls={`practice-settings-${tab.id}`}
            aria-selected={selectedTab === tab.id}
            id={`practice-settings-tab-${tab.id}`}
            key={tab.id}
            ref={(element) => { tabRefs.current[tab.id] = element; }}
            role="tab"
            tabIndex={selectedTab === tab.id ? 0 : -1}
            type="button"
            disabled={isClosing}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(event) => {
              selectTabFromKeyboard(tab.id, event.key);
              if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) event.preventDefault();
            }}
          ><Icon name={tab.icon} size={20} /><span>{tab.label}</span></button>
        ))}
      </div>
      <section aria-labelledby={`practice-settings-tab-${selectedTab}`} className="practice-settings-content" id={`practice-settings-${selectedTab}`} inert={isClosing} role="tabpanel">
        {selectedTab === "audio" && <><DeviceSettingsPanel kinds={["audioinput"]} selectedDeviceIds={selectedDeviceIds} onSelectDevice={(device) => { if (!isClosing) onSelectDevice(device); }} /><p>3D 主管聲音使用系統預設輸出裝置</p></>}
        {selectedTab === "video" && <DeviceSettingsPanel kinds={["videoinput"]} selectedDeviceIds={selectedDeviceIds} onSelectDevice={(device) => { if (!isClosing) onSelectDevice(device); }} />}
        {selectedTab === "voice" && <VoiceSettingsPanel hasWebGpu={typeof navigator !== "undefined" && hasWebGpuSupport(navigator.gpu)} selectedPreset={draft.modelPreset} onSelectedPresetChange={(modelPreset) => { if (!isClosing) setDraft((current) => ({ ...current, modelPreset })); }} />}
        {selectedTab === "manager" && <>
          <fieldset disabled={isClosing}><legend>主管角色</legend>
            {(["male", "female"] as const).map((presentation) => {
              const available = isPresenterPresentationAvailable(presenterCatalog, presentation);
              const label = presentation === "male" ? "男性主管" : "女性主管";
              return <label key={presentation}><input checked={draft.practice.managerPresentation === presentation} disabled={!available || isClosing} name="manager-presentation" type="radio" value={presentation} onChange={() => updatePractice({ ...draft.practice, managerPresentation: presentation })} />{label}{!available && " 此角色尚未設定"}</label>;
            })}
          </fieldset>
          <div className="practice-settings-fields">
            <label>主管姓名<input ref={managerInput} disabled={isClosing} required value={draft.scenario.manager.name} onChange={(event) => updateScenario({ ...draft.scenario, manager: { ...draft.scenario.manager, name: event.target.value } })} /></label>
          </div>
          <ScenarioSettingsPanel section="scenario" inputRefs={{ role: roleInput, reason: reasonInput, currentMonthlySalary: currentSalaryInput, requestedMonthlySalary: requestedSalaryInput }} value={draft.scenario} durationMinutes={draft.practice.durationMinutes} onChange={updateScenario} />
        </>}
        {selectedTab === "personality" && <ScenarioSettingsPanel section="managerPersonality" value={draft.scenario} durationMinutes={draft.practice.durationMinutes} onChange={updateScenario} />}
        {selectedTab === "meeting" && <>
          <fieldset disabled={isClosing}><legend>會議長度</legend>{([5, 10, 20] as const).map((durationMinutes) => <label key={durationMinutes}><input checked={draft.practice.durationMinutes === durationMinutes} name="duration" type="radio" onChange={() => updatePractice({ ...draft.practice, durationMinutes })} />{durationMinutes} 分鐘</label>)}</fieldset>
          <ScenarioSettingsPanel section="events" value={draft.scenario} durationMinutes={draft.practice.durationMinutes} onChange={updateScenario} />
        </>}
        {selectedTab === "privacy" && <section className="practice-settings-privacy"><p>設定與草稿只儲存在這台裝置。</p><p>不會在未經你操作下讀取裝置、請求權限或載入語音模型。</p>{clearConfirmation ? <div className="practice-settings-danger-confirmation"><p>確定要清除本機設定與草稿嗎？</p><button ref={clearCancel} disabled={isClosing} type="button" onClick={() => { if (!isClosing) setClearConfirmation(false); }}>取消清除</button><button className="practice-settings-danger-button" disabled={isClosing} type="button" onClick={confirmClear}>確認清除</button></div> : <div className="practice-settings-danger-zone"><button disabled={isClosing} type="button" onClick={requestClear}>清除本機設定與草稿</button></div>}</section>}
      </section>
      <footer className="practice-settings-actions"><button disabled={isClosing} type="button" onClick={close}>取消</button><button disabled={isClosing} type="button" onClick={validateAndSave}>儲存</button></footer>
    </dialog>
  );
}
