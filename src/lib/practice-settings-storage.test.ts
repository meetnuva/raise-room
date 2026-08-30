import { vi } from "vitest";
import type { PracticeSettings } from "../domain/practice-settings";
import {
  readPracticeSettings,
  practiceSettingsStorageKey,
  writePracticeSettings,
} from "./practice-settings-storage";

test("returns defaults for missing, malformed, and unknown persisted settings", () => {
  expect(readPracticeSettings({ getItem: () => null })).toEqual({ durationMinutes: 20, managerPresentation: "male" });
  expect(readPracticeSettings({ getItem: () => "not json" })).toEqual({ durationMinutes: 20, managerPresentation: "male" });
  expect(readPracticeSettings({ getItem: () => JSON.stringify({ durationMinutes: 15, managerPresentation: "other" }) }))
    .toEqual({ durationMinutes: 20, managerPresentation: "male" });
});

test("reads every allowlisted duration", () => {
  for (const durationMinutes of [5, 10, 20] as const) {
    expect(readPracticeSettings({ getItem: () => JSON.stringify({ durationMinutes, managerPresentation: "female" }) }))
      .toEqual({ durationMinutes, managerPresentation: "female" });
  }
});

test("serializes only approved practice settings", () => {
  const setItem = vi.fn();
  const settings: PracticeSettings & { secret: string } = {
    durationMinutes: 5,
    managerPresentation: "female",
    secret: "x",
  };
  writePracticeSettings(
    { setItem },
    settings,
  );

  expect(setItem).toHaveBeenCalledExactlyOnceWith(
    practiceSettingsStorageKey,
    JSON.stringify({ durationMinutes: 5, managerPresentation: "female" }),
  );
});
