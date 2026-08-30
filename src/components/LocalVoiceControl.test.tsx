import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { LocalVoiceControl } from "./LocalVoiceControl";
import type { VoiceTranscriptResult } from "../hooks/use-local-voice";

const voice = (status: "idle" | "ready" | "recording" = "idle") => ({ status, progress: null, partialText: "", errorMessage: null, language: "zh" as const, setLanguage: vi.fn(), loadModel: vi.fn(), startRecording: vi.fn(), stopAndTranscribe: vi.fn(), cancel: vi.fn() });

test("requires an explicit model opt-in and exposes language choice", () => {
  const injected = voice(); render(<LocalVoiceControl voice={injected} onTranscript={vi.fn<(result: VoiceTranscriptResult) => void>()} />);
  fireEvent.change(screen.getByLabelText("語音語言"), { target: { value: "ja" } }); fireEvent.click(screen.getByRole("button", { name: "載入本機語音模型" }));
  expect(injected.setLanguage).toHaveBeenCalledWith("ja"); expect(injected.loadModel).toHaveBeenCalledOnce();
  expect(screen.getByText("音訊不會上傳，模型檔首次由 Hugging Face 下載")).toBeVisible();
});

test("marks active microphone clearly", () => {
  render(<LocalVoiceControl voice={voice("recording")} onTranscript={vi.fn()} />);
  expect(screen.getByText("麥克風使用中")).toBeVisible(); expect(screen.getByRole("button", { name: "停止並轉成文字" })).toBeVisible();
});

test("does not create the owned voice hook when an injected voice is supplied", () => {
  const WorkerSpy = vi.fn(); vi.stubGlobal("Worker", WorkerSpy);
  render(<LocalVoiceControl voice={voice()} onTranscript={vi.fn()} />);
  expect(WorkerSpy).not.toHaveBeenCalled(); vi.unstubAllGlobals();
});
