import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test, vi, type Mock } from "vitest";
import { VoiceSettings } from "./VoiceSettings";
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

test("renders all allowlisted model cards without loading a model or microphone on mount", () => {
  const onSave = vi.fn();
  render(<VoiceSettings savedPreset="quality" onSave={onSave} onBack={vi.fn()} hasWebGpu />);
  expect(screen.getByText("高品質")).toBeVisible();
  expect(screen.getByText("平衡")).toBeVisible();
  expect(screen.getByText("快速")).toBeVisible();
  expect(screen.getByText("1.5 GB")).toBeVisible();
  expect(screen.getAllByText("全程本機")).toHaveLength(4);
  expect(onSave).not.toHaveBeenCalled();
});

test("keeps a quality selection disabled with an explicit WebGPU explanation", () => {
  render(<VoiceSettings savedPreset="quality" onSave={vi.fn()} onBack={vi.fn()} hasWebGpu={false} />);
  expect(screen.getByText("此裝置不支援 WebGPU，高品質模型無法使用。")).toBeVisible();
  expect(screen.getByRole("radio", { name: /高品質/ })).toBeDisabled();
});

test("persists only the chosen preset after explicit confirmation", () => {
  const onSave = vi.fn();
  render(<VoiceSettings savedPreset="quality" onSave={onSave} onBack={vi.fn()} hasWebGpu />);
  fireEvent.click(screen.getByRole("radio", { name: /平衡/ }));
  fireEvent.click(screen.getByRole("button", { name: "使用這個模型" }));
  expect(onSave).toHaveBeenCalledExactlyOnceWith("balanced");
});

test("loads and requests microphone only after clicks, auto-stops once at 20 seconds, and keeps a local result", async () => {
  vi.useFakeTimers();
  const calls = { load: vi.fn(), start: vi.fn(), stop: vi.fn(), release: vi.fn() };
  render(<VoiceHarness calls={calls} />);
  expect(calls.load).not.toHaveBeenCalled(); expect(calls.start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "載入並測試" }));
  expect(calls.load).toHaveBeenCalledOnce(); expect(calls.start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "開始測試" }));
  expect(calls.start).toHaveBeenCalledOnce(); expect(screen.getByText("測試剩餘 20 秒")).toBeVisible();
  await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
  expect(calls.stop).toHaveBeenCalledOnce();
  expect(screen.getByText("文字吻合度：100%")).toBeVisible();
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

afterEach(() => vi.useRealTimers());
