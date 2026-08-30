import { defaultScenario } from "./scenario";
import { advanceMeeting, appendUserTurn, createMeeting } from "./meeting";

test("emits each timed event only once", () => {
  const state = createMeeting(defaultScenario);
  const atMinuteThree = advanceMeeting(state, 180);
  const repeatedTick = advanceMeeting(atMinuteThree, 180);

  expect(atMinuteThree.emittedEventIds).toContain("budget-freeze");
  expect(repeatedTick.emittedEventIds).toEqual(atMinuteThree.emittedEventIds);
});

test("adds optional delivery metadata without changing existing turns", () => {
  const state = appendUserTurn(createMeeting(defaultScenario), "我想談調薪", {
    source: "voice",
    durationSeconds: 12,
  });

  expect(state.transcript[0]).toMatchObject({
    speaker: "user",
    delivery: { source: "voice", durationSeconds: 12 },
  });
});
