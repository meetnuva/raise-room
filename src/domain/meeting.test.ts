import { defaultScenario } from "./scenario";
import { advanceMeeting, createMeeting } from "./meeting";

test("emits each timed event only once", () => {
  const state = createMeeting(defaultScenario);
  const atMinuteThree = advanceMeeting(state, 180);
  const repeatedTick = advanceMeeting(atMinuteThree, 180);

  expect(atMinuteThree.emittedEventIds).toContain("budget-freeze");
  expect(repeatedTick.emittedEventIds).toEqual(atMinuteThree.emittedEventIds);
});
