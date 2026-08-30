import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { VoiceSettings } from "./VoiceSettings";

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
