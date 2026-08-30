import { defaultScenario } from "./scenario";
import {
  advanceMeeting,
  appendUserTurn,
  createMeeting,
  respondToUser,
  simulatedResponder,
} from "./meeting";

test("emits each timed event only once", () => {
  const state = createMeeting(defaultScenario, 600);
  const atMinuteThree = advanceMeeting(state, 180);
  const repeatedTick = advanceMeeting(atMinuteThree, 180);

  expect(atMinuteThree.emittedEventIds).toContain("budget-freeze");
  expect(repeatedTick.emittedEventIds).toEqual(atMinuteThree.emittedEventIds);
});

test("retains the requested meeting duration", () => {
  expect(createMeeting(defaultScenario, 1200).durationSeconds).toBe(1200);
});

test("adds optional delivery metadata without changing existing turns", () => {
  const state = appendUserTurn(createMeeting(defaultScenario, 600), "我想談調薪", {
    source: "voice",
    durationSeconds: 12,
  });

  expect(state.transcript[0]).toMatchObject({
    speaker: "user",
    delivery: { source: "voice", durationSeconds: 12 },
  });
});

test("retains only preset metadata for confirmed voice delivery", () => {
  const state = appendUserTurn(createMeeting(defaultScenario, 600), "已修正文字", {
    source: "voice",
    durationSeconds: 12,
    modelPreset: "quality",
    language: "zh",
  });
  expect(state.transcript[0]).toMatchObject({ text: "已修正文字", delivery: { source: "voice", durationSeconds: 12, modelPreset: "quality", language: "zh" } });
  expect(JSON.stringify(state.transcript[0])).not.toContain("rawText");
});

test("labels simulated manager replies with their visible source", async () => {
  await expect(
    simulatedResponder.reply({
      scenario: defaultScenario,
      transcript: [],
      dueEvents: [],
    }),
  ).resolves.toMatchObject({
    text: "我們開始吧，請說明你希望討論的薪資調整。",
    source: "simulated",
  });
});

test("keeps simulated manager text free of a duplicate manager-name prefix", async () => {
  await expect(
    simulatedResponder.reply({
      scenario: defaultScenario,
      transcript: [],
      dueEvents: [defaultScenario.events[0]],
    }),
  ).resolves.toMatchObject({
    text: "請對方先以具體成果說明這次請求",
    source: "simulated",
  });
});

test("keeps the responder source on appended manager turns", async () => {
  const userState = appendUserTurn(
    createMeeting(defaultScenario, 600),
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
