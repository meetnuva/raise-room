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

test("includes a short default manager instruction without duplicating personality settings", () => {
  expect(defaultScenario.manager.customInstructions).toBe(
    "保持主管角色，只回主管會說的話，不提供教練建議。",
  );
});
