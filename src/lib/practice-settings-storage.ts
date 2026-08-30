import {
  defaultPracticeSettings,
  parsePracticeSettings,
  type PracticeSettings,
} from "../domain/practice-settings";

export const practiceSettingsStorageKey = "raise-room-meeting-settings-v1";

export function readPracticeSettings(storage: Pick<Storage, "getItem">): PracticeSettings {
  try {
    const stored = storage.getItem(practiceSettingsStorageKey);
    return stored ? parsePracticeSettings(JSON.parse(stored)) : defaultPracticeSettings;
  } catch {
    return defaultPracticeSettings;
  }
}

export function writePracticeSettings(
  storage: Pick<Storage, "setItem">,
  settings: PracticeSettings,
): void {
  storage.setItem(practiceSettingsStorageKey, JSON.stringify(parsePracticeSettings(settings)));
}
