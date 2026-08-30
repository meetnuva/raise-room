import {
  buildManagerBrief,
  defaultScenario,
  eventsDueAt,
  getEventOffsetSeconds,
} from "./scenario";

test.each([
  [300, [30, 90, 150, 210, 270]],
  [600, [60, 180, 300, 420, 540]],
  [1200, [120, 360, 600, 840, 1080]],
])("derives event offsets for %i seconds", (durationSeconds, expected) => {
  expect(
    defaultScenario.events.map((event) =>
      getEventOffsetSeconds(event, durationSeconds),
    ),
  ).toEqual(expected);
});

test("returns the budget-freeze event at its proportional offset", () => {
  expect(eventsDueAt(defaultScenario, 180, 600)).toEqual([
    expect.objectContaining({ id: "budget-freeze", triggerRatio: 0.3 }),
  ]);
});

test("builds a manager brief from scenario facts without exposing a hidden stance", () => {
  const brief = buildManagerBrief(defaultScenario);

  expect(brief).toContain("預算防守：高");
  expect(brief).not.toContain("隱藏立場");
});

test("includes a short default manager instruction without duplicating personality settings", () => {
  expect(defaultScenario.manager.customInstructions).toBe(
    "保持主管角色，只回主管會說的話，不提供教練建議。",
  );
});
