import { expect, test, vi } from "vitest";
import {
  readVoiceSettings,
  voiceSettingsStorageKey,
  writeVoiceSettings,
} from "./voice-settings";

test("returns the quality default for missing, malformed, and unknown persisted settings", () => {
  expect(readVoiceSettings({ getItem: () => null })).toEqual({ modelPreset: "quality" });
  expect(readVoiceSettings({ getItem: () => "not json" })).toEqual({ modelPreset: "quality" });
  expect(readVoiceSettings({ getItem: () => JSON.stringify({ modelPreset: "remote" }) })).toEqual({ modelPreset: "quality" });
});

test("reads every allowlisted saved preset", () => {
  for (const modelPreset of ["quality", "balanced", "fast"] as const) {
    expect(readVoiceSettings({ getItem: () => JSON.stringify({ modelPreset }) })).toEqual({ modelPreset });
  }
});

test("serializes only the selected preset", () => {
  const setItem = vi.fn();
  writeVoiceSettings({ setItem }, { modelPreset: "balanced" });
  expect(setItem).toHaveBeenCalledExactlyOnceWith(
    voiceSettingsStorageKey,
    JSON.stringify({ modelPreset: "balanced" }),
  );
});
