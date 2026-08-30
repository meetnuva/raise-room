import {
  defaultAsrModelPresetId,
  isAsrModelPresetId,
  type AsrModelPresetId,
} from "../domain/asr-models";

export const voiceSettingsStorageKey = "raise-room-voice-settings-v1";

export interface VoiceSettings {
  modelPreset: AsrModelPresetId;
}

const defaultVoiceSettings: VoiceSettings = { modelPreset: defaultAsrModelPresetId };

export function readVoiceSettings(storage: Pick<Storage, "getItem">): VoiceSettings {
  try {
    const stored = storage.getItem(voiceSettingsStorageKey);
    if (!stored) return defaultVoiceSettings;

    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      isAsrModelPresetId((parsed as { modelPreset?: unknown }).modelPreset)
    ) {
      return { modelPreset: (parsed as { modelPreset: AsrModelPresetId }).modelPreset };
    }
  } catch {
    // Corrupt or legacy local state must never select a model outside the catalog.
  }

  return defaultVoiceSettings;
}

export function writeVoiceSettings(
  storage: Pick<Storage, "setItem">,
  settings: VoiceSettings,
): void {
  storage.setItem(voiceSettingsStorageKey, JSON.stringify({ modelPreset: settings.modelPreset }));
}
