import { buildManagerBrief, defaultScenario, eventsDueAt } from "./scenario";

test("returns the budget-freeze event exactly at minute three", () => {
  expect(eventsDueAt(defaultScenario, 180)).toEqual([
    expect.objectContaining({ id: "budget-freeze", minute: 3 }),
  ]);
});

test("builds a manager brief from scenario facts without exposing a hidden stance", () => {
  const brief = buildManagerBrief(defaultScenario);

  expect(brief).toContain("預算防守：高");
  expect(brief).not.toContain("隱藏立場");
});
