import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { VoiceTranscriptPreview } from "./VoiceTranscriptPreview";

const result = {
  rawText: "客户投诉下降百分之三十",
  text: "客戶投訴下降百分之三十",
  durationSeconds: 4,
  language: "zh" as const,
  modelPreset: "quality" as const,
};

test("requires an editable non-blank confirmation and keeps raw text collapsed", () => {
  const onConfirm = vi.fn();
  render(<VoiceTranscriptPreview result={result} onConfirm={onConfirm} onRetry={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.getByRole("textbox", { name: "送給主管前可修改的文字" })).toHaveValue(result.text);
  expect(screen.getByText("查看原始辨識結果")).toBeVisible();
  const textarea = screen.getByRole("textbox", { name: "送給主管前可修改的文字" });
  fireEvent.change(textarea, { target: { value: "   " } });
  expect(screen.getByRole("button", { name: "送給主管" })).toBeDisabled();
  fireEvent.change(textarea, { target: { value: "  客訴下降百分之三十  " } });
  fireEvent.click(screen.getByRole("button", { name: "送給主管" }));
  expect(onConfirm).toHaveBeenCalledExactlyOnceWith("客訴下降百分之三十");
});
