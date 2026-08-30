import { defaultScenario } from "./scenario";
import {
  advanceMeeting,
  appendUserTurn,
  createMeeting,
  respondToUser,
  simulatedResponder,
} from "./meeting";

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

test("labels simulated manager replies with their visible source", async () => {
  await expect(
    simulatedResponder.reply({
      scenario: defaultScenario,
      transcript: [],
      dueEvents: [],
    }),
  ).resolves.toMatchObject({
    text: expect.any(String),
    source: "simulated",
  });
});

test("keeps the responder source on appended manager turns", async () => {
  const userState = appendUserTurn(
    createMeeting(defaultScenario),
    "我想依成果討論調薪",
  );

  const next = await respondToUser(userState, defaultScenario, {
    async reply() {
      return { text: "請先說明具體成果。", source: "perxona" };
    },
  });

  expect(next.transcript[next.transcript.length - 1]).toMatchObject({
    speaker: "manager",
    text: "請先說明具體成果。",
    managerSource: "perxona",
  });
  expect(next.transcript[0]).not.toHaveProperty("managerSource");
});
