export type PracticeDurationMinutes = 5 | 10 | 20;
export type ManagerPresentation = "male" | "female";

export interface PracticeSettings {
  durationMinutes: PracticeDurationMinutes;
  managerPresentation: ManagerPresentation;
}

export const defaultPracticeSettings: PracticeSettings = {
  durationMinutes: 20,
  managerPresentation: "male",
};

export function isPracticeDurationMinutes(value: unknown): value is PracticeDurationMinutes {
  return value === 5 || value === 10 || value === 20;
}

export function isManagerPresentation(value: unknown): value is ManagerPresentation {
  return value === "male" || value === "female";
}

export function parsePracticeSettings(value: unknown): PracticeSettings {
  if (typeof value !== "object" || value === null) return defaultPracticeSettings;
  const input = value as { durationMinutes?: unknown; managerPresentation?: unknown };
  if (!isPracticeDurationMinutes(input.durationMinutes) || !isManagerPresentation(input.managerPresentation)) {
    return defaultPracticeSettings;
  }
  return { durationMinutes: input.durationMinutes, managerPresentation: input.managerPresentation };
}
