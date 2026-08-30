import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, vi } from "vitest";
import { defaultAsrModelPresetId } from "../domain/asr-models";
import { defaultPracticeSettings } from "../domain/practice-settings";
import { defaultScenario } from "../domain/scenario";
import { PracticeSettingsDialog, type PracticeSettingsDraft } from "./PracticeSettingsDialog";

const value: PracticeSettingsDraft = {
  scenario: defaultScenario,
  practice: defaultPracticeSettings,
  modelPreset: defaultAsrModelPresetId,
};

function renderDialog(overrides: Partial<Parameters<typeof PracticeSettingsDialog>[0]> = {}) {
  const onSave = vi.fn();
  const onClear = vi.fn();
  const onClose = vi.fn();
  const onSelectDevice = vi.fn();
  render(<PracticeSettingsDialog open value={value} presenterCatalog={{ male: { enabled: true, publishableKey: "public", presenterUrl: "https://example.test/presenter.js", target: { avatarId: "avatar", sceneId: "scene", voiceId: "voice" } }, female: { enabled: false, reason: "missing-target" } }} onSave={onSave} onClear={onClear} onClose={onClose} onSelectDevice={onSelectDevice} {...overrides} />);
  return { onSave, onClear, onClose, onSelectDevice };
}

test("provides the seven exact accessible icon tabs without device or media side effects on mount", () => {
  renderDialog();

  expect(screen.getByRole("tablist")).toBeVisible();
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
    "音訊", "視訊", "語音模型", "主管角色", "主管個性", "會議", "隱私",
  ]);
  expect(screen.getByRole("tab", { name: "音訊" }).querySelector("svg")).not.toBeNull();
  expect(screen.getByRole("tab", { name: "視訊" }).querySelector("svg")).not.toBeNull();
  expect(screen.getByRole("tab", { name: "音訊" })).toHaveFocus();
});

test("opens the requested target panel and scrolls the selected mobile tab into view", () => {
  const scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });

  renderDialog({ initialTab: "privacy" });

  expect(screen.getByRole("tab", { name: "隱私" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("設定與草稿只儲存在這台裝置。")).toBeVisible();
  expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "nearest", inline: "center" });
});

test("uses entering, entered, and leaving motion states before handing close back after 180ms", () => {
  vi.useFakeTimers();
  const { onClose } = renderDialog();
  const dialog = screen.getByRole("dialog");

  expect(dialog).toHaveAttribute("data-motion", "entering");
  act(() => vi.advanceTimersByTime(0));
  expect(dialog).toHaveAttribute("data-motion", "entered");
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(dialog).toHaveAttribute("data-motion", "leaving");
  act(() => vi.advanceTimersByTime(179));
  expect(onClose).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(onClose).toHaveBeenCalledOnce();
});

test("blocks every save and clear mutation while its 180ms close handoff is leaving", () => {
  vi.useFakeTimers();
  const { onClear, onClose, onSave } = renderDialog({ initialTab: "privacy" });

  fireEvent.click(screen.getByRole("button", { name: "清除本機設定與草稿" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

  expect(screen.getByRole("dialog")).toHaveAttribute("data-motion", "leaving");
  expect(screen.getByRole("tabpanel")).toHaveAttribute("inert");
  fireEvent.click(screen.getByRole("button", { name: "確認清除", hidden: true }));
  fireEvent.click(screen.getByRole("button", { name: "儲存" }));
  expect(onClear).not.toHaveBeenCalled();
  expect(onSave).not.toHaveBeenCalled();

  act(() => vi.advanceTimersByTime(179));
  expect(onClose).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(onClose).toHaveBeenCalledOnce();
});

test("delays save and confirmed clear mutations until the leaving animation completes", () => {
  vi.useFakeTimers();
  const save = renderDialog();
  fireEvent.click(screen.getByRole("button", { name: "儲存" }));
  expect(save.onSave).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toHaveAttribute("data-motion", "leaving");
  act(() => vi.advanceTimersByTime(180));
  expect(save.onSave).toHaveBeenCalledOnce();

  const clear = renderDialog({ initialTab: "privacy" });
  fireEvent.click(screen.getAllByRole("button", { name: "清除本機設定與草稿" })[0]);
  fireEvent.click(screen.getByRole("button", { name: "確認清除" }));
  expect(clear.onClear).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(180));
  expect(clear.onClear).toHaveBeenCalledOnce();
});

test("uses roving tabs with linked panels and keyboard navigation", () => {
  renderDialog();

  const audio = screen.getByRole("tab", { name: "音訊" });
  expect(audio).toHaveAttribute("aria-controls", "practice-settings-audio");
  expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", audio.id);
  expect(audio).toHaveAttribute("tabindex", "0");
  fireEvent.keyDown(audio, { key: "ArrowDown" });
  expect(screen.getByRole("tab", { name: "視訊" })).toHaveFocus();
  expect(screen.getByRole("tab", { name: "視訊" })).toHaveAttribute("tabindex", "0");
  fireEvent.keyDown(screen.getByRole("tab", { name: "視訊" }), { key: "ArrowLeft" });
  expect(audio).toHaveFocus();
});

test("defines a desktop vertical-tab dialog and a mobile horizontal fallback", () => {
  const styles = readFileSync("src/styles.css", "utf8");

  expect(styles).toMatch(/\.practice-settings-dialog\s*\{[^}]*grid-template-columns:\s*208px\s+minmax\(0,\s*1fr\);[^}]*width:\s*min\(54rem,\s*calc\(100vw\s*-\s*32px\)\);[^}]*max-height:\s*min\(720px,\s*calc\(100dvh\s*-\s*32px\)\);/s);
  expect(styles).toMatch(/\.practice-settings-header,[\s\S]*?\.practice-settings-actions\s*\{[^}]*min-height:\s*64px;/);
  expect(styles).toMatch(/\.practice-settings-tabs\s*\{[^}]*flex-direction:\s*column;/s);
  expect(styles).toMatch(/\.practice-settings-tabs \[role="tab"\]\s*\{[^}]*min-height:\s*44px;/);
  expect(styles).toMatch(/@media \(max-width: 48rem\)\s*\{[\s\S]*?\.practice-settings-dialog\s*\{[^}]*display:\s*block;[\s\S]*?\.practice-settings-tabs\s*\{[^}]*flex-direction:\s*row;[^}]*overflow-x:\s*auto;/);
});

test("uses native modal dialog behavior once when showModal is available", () => {
  const original = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
  const showModal = vi.fn();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: showModal });

  try {
    renderDialog();
    expect(showModal).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("tab", { name: "視訊", hidden: true }));
    expect(showModal).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog", { hidden: true })).toHaveAttribute("aria-label", "練習設定");
  } finally {
    if (original) Object.defineProperty(HTMLDialogElement.prototype, "showModal", original);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  }
});

test("filters audio and video device panels and retains session-only selections", async () => {
  const enumerateDevices = vi.fn().mockResolvedValue([
    { deviceId: "mic-id", groupId: "group", kind: "audioinput", label: "麥克風" },
    { deviceId: "camera-id", groupId: "group", kind: "videoinput", label: "攝影機" },
  ]);
  const original = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { enumerateDevices } });
  try {
    const { onSelectDevice } = renderDialog({ selectedDeviceIds: { audioinput: "mic-id" } });
    expect(enumerateDevices).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "讀取可用裝置" }));
    await screen.findByRole("heading", { name: "麥克風" });
    expect(screen.queryByRole("heading", { name: "攝影機" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "喇叭" })).toBeNull();
    expect(screen.getByText("3D 主管聲音使用系統預設輸出裝置")).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "視訊" }));
    fireEvent.click(screen.getByRole("button", { name: "讀取可用裝置" }));
    await screen.findByRole("heading", { name: "攝影機" });
    expect(screen.queryByRole("heading", { name: "麥克風" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "使用 攝影機" }));
    expect(onSelectDevice).toHaveBeenCalledWith(expect.objectContaining({ deviceId: "camera-id" }));
  } finally {
    if (original) Object.defineProperty(navigator, "mediaDevices", original);
    else Reflect.deleteProperty(navigator, "mediaDevices");
  }
});

test("does not treat a gpu-shaped object without requestAdapter as WebGPU support", () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "gpu");
  Object.defineProperty(navigator, "gpu", { configurable: true, value: {} });
  try {
    renderDialog();
    fireEvent.click(screen.getByRole("tab", { name: "語音模型" }));
    expect(screen.getByRole("radio", { name: /高品質/ })).toBeDisabled();
  } finally {
    if (original) Object.defineProperty(navigator, "gpu", original);
    else Reflect.deleteProperty(navigator, "gpu");
  }
});

test("keeps edits local until global save and cancel emits no save", () => {
  vi.useFakeTimers();
  const { onSave, onClose } = renderDialog();

  fireEvent.click(screen.getByRole("tab", { name: "會議" }));
  fireEvent.click(screen.getByRole("radio", { name: "10 分鐘" }));
  fireEvent.click(screen.getByRole("button", { name: "取消" }));

  expect(onSave).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(180));
  expect(onClose).toHaveBeenCalledOnce();
});

test("saves one edited draft, disables unavailable female presenters, and closes on Escape", () => {
  vi.useFakeTimers();
  const { onSave, onClose } = renderDialog();

  fireEvent.click(screen.getByRole("tab", { name: "主管角色" }));
  expect(screen.getByRole("radio", { name: /女性主管.*此角色尚未設定/ })).toBeDisabled();
  fireEvent.click(screen.getByRole("tab", { name: "會議" }));
  fireEvent.click(screen.getByRole("radio", { name: "10 分鐘" }));
  fireEvent.click(screen.getByRole("button", { name: "儲存" }));
  act(() => vi.advanceTimersByTime(180));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ practice: expect.objectContaining({ durationMinutes: 10 }) }));

  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  act(() => vi.advanceTimersByTime(180));
  expect(onClose).toHaveBeenCalledOnce();
});

test("discloses local-only privacy and requires a second confirmation before clearing", () => {
  vi.useFakeTimers();
  const { onClear } = renderDialog();

  fireEvent.click(screen.getByRole("tab", { name: "隱私" }));
  expect(screen.getByText("設定與草稿只儲存在這台裝置。")) .toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "清除本機設定與草稿" }));
  expect(onClear).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "取消清除" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "取消清除" }));
  expect(onClear).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "清除本機設定與草稿" }));
  fireEvent.click(screen.getByRole("button", { name: "確認清除" }));
  act(() => vi.advanceTimersByTime(180));
  expect(onClear).toHaveBeenCalledOnce();
});

test("keeps the dialog open and focuses the first invalid required field", () => {
  const { onSave } = renderDialog({ value: { ...value, scenario: { ...value.scenario, role: "" } } });

  fireEvent.click(screen.getByRole("button", { name: "儲存" }));

  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getByLabelText("職位")).toHaveFocus();
});

test.each([
  ["現薪（月）", "currentMonthlySalary"],
  ["期待月薪", "requestedMonthlySalary"],
] as const)("rejects a negative %s and focuses that field", (label, field) => {
  const { onSave } = renderDialog({ value: { ...value, scenario: { ...value.scenario, compensation: { ...value.scenario.compensation, [field]: -1 } } } });

  fireEvent.click(screen.getByRole("button", { name: "儲存" }));

  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getByLabelText(label)).toHaveFocus();
});

afterEach(() => vi.useRealTimers());
