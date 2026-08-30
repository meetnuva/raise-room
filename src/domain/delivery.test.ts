import { createDeliverySignals } from "./delivery";

test("derives transparent signals from user voice turns only", () => {
  expect(createDeliverySignals([
    { speaker: "user", text: "嗯，就是然後", elapsedSeconds: 0, delivery: { source: "voice", durationSeconds: 30 } },
    { speaker: "user", text: "這是文字", elapsedSeconds: 1, delivery: { source: "text" } },
    { speaker: "manager", text: "呃", elapsedSeconds: 2 },
  ])).toEqual({
    voiceTurnCount: 1,
    totalVoiceDurationSeconds: 30,
    charactersPerMinute: 12,
    fillerWordCount: 3,
    fillerWords: [
      { word: "嗯", count: 1 }, { word: "呃", count: 0 }, { word: "就是", count: 1 },
      { word: "然後", count: 1 }, { word: "那個", count: 0 },
    ],
  });
});

test("does not invent a rate without valid voice duration", () => {
  expect(createDeliverySignals([
    { speaker: "user", text: "嗯", elapsedSeconds: 0, delivery: { source: "voice", durationSeconds: 0 } },
  ]).charactersPerMinute).toBeNull();
});
