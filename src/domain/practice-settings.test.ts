import {
  defaultPracticeSettings,
  isManagerPresentation,
  isPracticeDurationMinutes,
  parsePracticeSettings,
} from "./practice-settings";

test("defaults to a twenty minute male-presenting practice", () => {
  expect(defaultPracticeSettings).toEqual({ durationMinutes: 20, managerPresentation: "male" });
});

test("accepts only approved values", () => {
  expect([5, 10, 20].map(isPracticeDurationMinutes)).toEqual([true, true, true]);
  expect(isPracticeDurationMinutes(15)).toBe(false);
  expect(isManagerPresentation("male")).toBe(true);
  expect(isManagerPresentation("female")).toBe(true);
  expect(isManagerPresentation("other")).toBe(false);
});

test("repairs malformed settings and drops extra fields", () => {
  expect(parsePracticeSettings({ durationMinutes: 5, managerPresentation: "female", secret: "x" }))
    .toEqual({ durationMinutes: 5, managerPresentation: "female" });
  expect(parsePracticeSettings({ durationMinutes: 15, managerPresentation: "unknown" }))
    .toEqual(defaultPracticeSettings);
});
