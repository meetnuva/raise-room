import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
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

test("provides the seven exact accessible settings tabs without device or media side effects on mount", () => {
  renderDialog();

  expect(screen.getByRole("tablist")).toBeVisible();
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
    "音訊", "視訊", "語音模型", "主管角色", "主管個性", "會議", "隱私",
  ]);
  expect(screen.getByRole("tab", { name: "音訊" })).toHaveFocus();
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
  const { onSave, onClose } = renderDialog();

  fireEvent.click(screen.getByRole("tab", { name: "會議" }));
  fireEvent.click(screen.getByRole("radio", { name: "10 分鐘" }));
  fireEvent.click(screen.getByRole("button", { name: "取消" }));

  expect(onSave).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledOnce();
});

test("saves one edited draft, disables unavailable female presenters, and closes on Escape", () => {
  const { onSave, onClose } = renderDialog();

  fireEvent.click(screen.getByRole("tab", { name: "主管角色" }));
  expect(screen.getByRole("radio", { name: /女性主管.*此角色尚未設定/ })).toBeDisabled();
  fireEvent.click(screen.getByRole("tab", { name: "會議" }));
  fireEvent.click(screen.getByRole("radio", { name: "10 分鐘" }));
  fireEvent.click(screen.getByRole("button", { name: "儲存" }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ practice: expect.objectContaining({ durationMinutes: 10 }) }));

  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(onClose).toHaveBeenCalledOnce();
});

test("discloses local-only privacy and requires a second confirmation before clearing", () => {
  const { onClear } = renderDialog();

  fireEvent.click(screen.getByRole("tab", { name: "隱私" }));
  expect(screen.getByText("設定與草稿只儲存在這台裝置。")) .toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "清除本機設定與草稿" }));
  expect(onClear).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "取消清除" }));
  expect(onClear).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "清除本機設定與草稿" }));
  fireEvent.click(screen.getByRole("button", { name: "確認清除" }));
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
