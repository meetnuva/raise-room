import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test, vi, type Mock } from "vitest";
import { VoiceSettings, VoiceSettingsPanel } from "./VoiceSettings";
import type { VoiceStatus } from "../hooks/use-local-voice";

function VoiceHarness({ calls }: { calls: { load: Mock<() => void>; start: Mock<() => void>; stop: Mock<() => void>; release: Mock<() => void> } }) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const voice = {
    status, progress: null, partialText: "", errorMessage: null, language: "zh", setLanguage: vi.fn(), device: "webgpu",
    loadModel: () => { calls.load(); setStatus("ready"); },
    startRecording: () => { calls.start(); setStatus("recording"); },
    stopAndTranscribe: async () => { calls.stop(); setStatus("ready"); return { rawText: "除了交付时间，我也让客户投诉下降百分之三十，并带来两个续约客户。", text: "除了交付時間，我也讓客訴下降百分之三十，並帶來兩個續約客戶。", durationSeconds: 2, language: "zh", modelPreset: "quality" as const }; },
    cancel: vi.fn(), releaseModel: calls.release,
  } as unknown as Parameters<typeof VoiceSettings>[0]["voice"];
  return <VoiceSettings savedPreset="quality" onSave={vi.fn()} onBack={vi.fn()} hasWebGpu voice={voice} />;
}

test("renders all allowlisted model choices as one selectable list with a detail panel without loading a model or microphone on mount", () => {
  const onSave = vi.fn();
  render(<VoiceSettings savedPreset="quality" onSave={onSave} onBack={vi.fn()} hasWebGpu />);
  expect(screen.getAllByText("高品質")[0]).toBeVisible();
  expect(screen.getByText("平衡")).toBeVisible();
  expect(screen.getByText("快速")).toBeVisible();
  expect(screen.getByText("1.5 GB")).toBeVisible();
  expect(screen.getAllByText("全程本機")).toHaveLength(4);
  expect(document.querySelector(".asr-model-list")).not.toBeNull();
  expect(document.querySelectorAll(".asr-model-options .asr-model-option")).toHaveLength(3);
  expect(screen.getByTestId("voice-model-detail")).toHaveTextContent("高品質");
  expect(document.querySelector(".asr-model-cards")).toBeNull();
  expect(onSave).not.toHaveBeenCalled();
});

test("keeps a quality selection disabled with an explicit WebGPU explanation", () => {
  render(<VoiceSettings savedPreset="quality" onSave={vi.fn()} onBack={vi.fn()} hasWebGpu={false} />);
  expect(screen.getByText("此裝置不支援 WebGPU，高品質模型無法使用。")).toBeVisible();
  expect(screen.getByRole("status", { name: /WASM.*可能很慢/ })).toBeVisible();
  expect(screen.getByRole("radio", { name: /高品質/ })).toBeDisabled();
});

test("does not show the WASM speed warning when WebGPU is available", () => {
  render(<VoiceSettings savedPreset="quality" onSave={vi.fn()} onBack={vi.fn()} hasWebGpu />);
  expect(screen.queryByText(/WASM.*可能很慢/)).toBeNull();
});

test("persists only the chosen preset after explicit confirmation", () => {
  const onSave = vi.fn();
  render(<VoiceSettings savedPreset="quality" onSave={onSave} onBack={vi.fn()} hasWebGpu />);
  fireEvent.click(screen.getByRole("radio", { name: /平衡/ }));
  fireEvent.click(screen.getByRole("button", { name: "使用這個模型" }));
  expect(onSave).toHaveBeenCalledExactlyOnceWith("balanced");
});

test("exposes a controlled voice panel without persisting the selected preset", () => {
  const onSelectedPresetChange = vi.fn();
  const voice = { status: "idle", progress: null, partialText: "", errorMessage: null, language: "zh", setLanguage: vi.fn(), device: null, loadModel: vi.fn(), startRecording: vi.fn(), stopAndTranscribe: vi.fn(), cancel: vi.fn(), releaseModel: vi.fn() } as unknown as Parameters<typeof VoiceSettings>[0]["voice"];
  render(<VoiceSettingsPanel selectedPreset="quality" onSelectedPresetChange={onSelectedPresetChange} hasWebGpu voice={voice} />);
  fireEvent.click(screen.getByRole("radio", { name: /平衡/ }));
  expect(onSelectedPresetChange).toHaveBeenCalledExactlyOnceWith("balanced");
});

test("locks test inputs and stops exactly once at 20 seconds", async () => {
  vi.useFakeTimers();
  const calls = { load: vi.fn(), start: vi.fn(), stop: vi.fn(), release: vi.fn() };
  render(<VoiceHarness calls={calls} />);
  expect(calls.load).not.toHaveBeenCalled(); expect(calls.start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "載入並測試" }));
  expect(calls.load).toHaveBeenCalledOnce(); expect(calls.start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "開始測試" }));
  expect(calls.start).toHaveBeenCalledOnce(); expect(screen.getByText("測試剩餘 20 秒")).toBeVisible();
  const language = screen.getByRole("combobox", { name: "測試語音語言" });
  const reference = screen.getByRole("textbox", { name: "參考句" });
  expect(language).toBeDisabled(); expect(reference).toBeDisabled();
  fireEvent.change(language, { target: { value: "en" } });
  fireEvent.change(reference, { target: { value: "不可改變倒數" } });
  await act(async () => { await vi.advanceTimersByTimeAsync(19_999); });
  expect(calls.stop).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(calls.stop).toHaveBeenCalledOnce();
});

test("releases prior model on switch, keeps its snapshot, and blocks unavailable model saving", async () => {
  const release = vi.fn();
  const voice = { status: "ready", progress: null, partialText: "", errorMessage: null, language: "zh", setLanguage: vi.fn(), device: "webgpu", loadModel: vi.fn(), startRecording: vi.fn(), stopAndTranscribe: vi.fn(), cancel: vi.fn(), releaseModel: release } as unknown as Parameters<typeof VoiceSettings>[0]["voice"];
  render(<VoiceSettings savedPreset="quality" onSave={vi.fn()} onBack={vi.fn()} hasWebGpu={false} voice={voice} />);
  expect(screen.getByRole("button", { name: "使用這個模型" })).toBeDisabled();
  fireEvent.click(screen.getByRole("radio", { name: /平衡/ }));
  expect(release).toHaveBeenCalledOnce();
});

test("caps reference input to avoid an unbounded comparison matrix", () => {
  const voice = { status: "idle", progress: null, partialText: "", errorMessage: null, language: "zh", setLanguage: vi.fn(), device: null, loadModel: vi.fn(), startRecording: vi.fn(), stopAndTranscribe: vi.fn(), cancel: vi.fn(), releaseModel: vi.fn() } as unknown as Parameters<typeof VoiceSettings>[0]["voice"];
  render(<VoiceSettings savedPreset="quality" onSave={vi.fn()} onBack={vi.fn()} hasWebGpu voice={voice} />);
  expect(screen.getByRole("textbox", { name: "參考句" })).toHaveAttribute("maxlength", "500");
});

test("shows worker loading details and allows cancelling without microphone access", () => {
  const releaseModel = vi.fn();
  const voice = { status: "loading-model", progress: 0.42, loadingMessage: "快速模型（fast）· WebGPU", partialText: "", errorMessage: null, language: "zh", setLanguage: vi.fn(), device: null, loadModel: vi.fn(), startRecording: vi.fn(), stopAndTranscribe: vi.fn(), cancel: vi.fn(), releaseModel } as unknown as Parameters<typeof VoiceSettings>[0]["voice"];
  render(<VoiceSettings savedPreset="fast" onSave={vi.fn()} onBack={vi.fn()} hasWebGpu voice={voice} />);
  expect(screen.getByText("快速模型（fast）· WebGPU")).toBeVisible();
  expect(screen.getByText("42%")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "取消載入" }));
  expect(releaseModel).toHaveBeenCalledOnce();
});

afterEach(() => vi.useRealTimers());
