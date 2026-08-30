import { createCoachingReport, formatTimestamp } from "./report";
import { defaultScenario } from "./scenario";

const requestedScenario = {
  ...defaultScenario,
  compensation: {
    ...defaultScenario.compensation,
    requestedMonthlySalary: 85000,
  },
};

test("links all four completed negotiation behaviors to their transcript evidence", () => {
  const transcript = [
    {
      speaker: "user" as const,
      elapsedSeconds: 15,
      text: "我希望調整為 85,000 元，並讓交付流程縮短 3 天。",
    },
    {
      speaker: "manager" as const,
      elapsedSeconds: 30,
      text: "目前預算凍結，暫時沒有空間。",
    },
    {
      speaker: "user" as const,
      elapsedSeconds: 45,
      text: "那我們下一步何時確認回覆？",
    },
  ];

  const report = createCoachingReport(requestedScenario, transcript);

  expect(report.strengths.map((recommendation) => recommendation.id)).toEqual([
    "request",
    "achievement",
    "recovery",
    "next-step",
  ]);
  expect(report.strengths.map((recommendation) => recommendation.evidence)).toEqual([
    { kind: "transcript", atSeconds: 15, text: transcript[0].text },
    { kind: "transcript", atSeconds: 15, text: transcript[0].text },
    { kind: "transcript", atSeconds: 45, text: transcript[2].text },
    { kind: "transcript", atSeconds: 45, text: transcript[2].text },
  ]);
  expect(report.negotiationMap.every((item) => item.complete)).toBe(true);
});

test("uses the zero-salary request wording rule", () => {
  const report = createCoachingReport(defaultScenario, [
    { speaker: "user", elapsedSeconds: 10, text: "我期待調整 5% 的幅度。" },
  ]);

  expect(report.strengths.map((recommendation) => recommendation.id)).toContain("request");
});

test("marks absent behaviors as missing evidence without inventing a quotation", () => {
  const report = createCoachingReport(requestedScenario, []);
  const requestTarget = report.practiceTargets.find(
    (recommendation) => recommendation.id === "request",
  );

  expect(requestTarget?.evidence).toEqual({
    kind: "missing",
    atSeconds: 0,
    text: "逐字稿中尚未出現提出具體請求的內容。",
  });
  expect(report.strengths).toEqual([]);
  expect(report.negotiationMap.every((item) => !item.complete)).toBe(true);
});

test("treats shortened delivery time as an achievement rather than a next step", () => {
  const report = createCoachingReport(defaultScenario, [
    { speaker: "user", elapsedSeconds: 10, text: "我把交付時間縮短 3 天。" },
  ]);

  expect(report.strengths.map((recommendation) => recommendation.id)).toContain("achievement");
  expect(report.strengths.map((recommendation) => recommendation.id)).not.toContain("next-step");
  expect(report.negotiationMap.find((item) => item.id === "next-step")?.complete).toBe(false);
});

test("formats transcript timestamps as MM:SS", () => {
  expect(formatTimestamp(0)).toBe("00:00");
  expect(formatTimestamp(65)).toBe("01:05");
  expect(formatTimestamp(605)).toBe("10:05");
});
