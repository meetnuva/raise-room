import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { LocalVoiceControl } from "./LocalVoiceControl";
import type { VoiceTranscriptResult } from "../hooks/use-local-voice";

const voice = (status: "idle" | "ready" | "recording" = "idle") => ({ status, progress: null, partialText: "", errorMessage: null, language: "zh" as const, setLanguage: vi.fn(), loadModel: vi.fn(), startRecording: vi.fn(), stopAndTranscribe: vi.fn(), cancel: vi.fn(), device: null, releaseModel: vi.fn() });

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

test("shows a preview after transcription and waits for confirmation before delivering text", async () => {
  const onTranscript = vi.fn();
  const injected = voice("recording");
  injected.stopAndTranscribe.mockResolvedValue({ rawText: "客户", text: "客戶", durationSeconds: 3, language: "zh", modelPreset: "quality" });
  render(<LocalVoiceControl voice={injected} onTranscript={onTranscript} />);
  fireEvent.click(screen.getByRole("button", { name: "停止並轉成文字" }));
  expect(await screen.findByRole("textbox", { name: "送給主管前可修改的文字" })).toHaveValue("客戶");
  expect(onTranscript).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox", { name: "送給主管前可修改的文字" }), { target: { value: "客訴" } });
  fireEvent.click(screen.getByRole("button", { name: "送給主管" }));
  expect(onTranscript).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ rawText: "客户" }), "客訴");
});

test("does not create the owned voice hook when an injected voice is supplied", () => {
  const WorkerSpy = vi.fn(); vi.stubGlobal("Worker", WorkerSpy);
  render(<LocalVoiceControl voice={voice()} onTranscript={vi.fn()} />);
  expect(WorkerSpy).not.toHaveBeenCalled(); vi.unstubAllGlobals();
});
