import { expect, test } from "vitest";
import { compareTranscript, normalizeTranscriptText } from "./transcript-accuracy";

test("normalizes Chinese to Taiwan Traditional before matching", () => {
  expect(compareTranscript("客户投诉", "客戶投訴", "zh")).toMatchObject({
    normalizedReference: "客戶投訴",
    normalizedActual: "客戶投訴",
    distance: 0,
    matchRatio: 1,
  });
});

test("normalizes whitespace, punctuation and English case but preserves Japanese", () => {
  expect(normalizeTranscriptText(" Hello,  WORLD！ ", "en")).toBe("helloworld");
  expect(normalizeTranscriptText("　こんにちは、世界！ ", "ja")).toBe("こんにちは世界");
});

test("returns code-point Levenshtein distance, a bounded ratio and visible edit parts", () => {
  const comparison = compareTranscript("a𠮷c", "a𠀋cd", "en");
  expect(comparison).toMatchObject({
    distance: 2,
    parts: [
      { type: "equal", expected: "a", actual: "a" },
      { type: "replace", expected: "𠮷", actual: "𠀋" },
      { type: "equal", expected: "c", actual: "c" },
      { type: "insert", expected: "", actual: "d" },
    ],
  });
  expect(comparison.matchRatio).toBeCloseTo(1 / 3);
});

test("handles deletion and empty reference without inventing a score", () => {
  expect(compareTranscript("續約客戶", "續約", "zh")).toMatchObject({
    distance: 2,
    parts: [
      { type: "equal", expected: "續", actual: "續" },
      { type: "equal", expected: "約", actual: "約" },
      { type: "delete", expected: "客", actual: "" },
      { type: "delete", expected: "戶", actual: "" },
    ],
  });
  expect(compareTranscript("", "任何文字", "zh").matchRatio).toBeNull();
});
