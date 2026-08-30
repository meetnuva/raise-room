import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { defaultScenario } from "../domain/scenario";
import { CoachingReport } from "./CoachingReport";

const completedTranscript = [
  {
    speaker: "user" as const,
    elapsedSeconds: 15,
    text: "我希望調整 5%，並讓交付流程縮短 3 天。",
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

test("shows the negotiation map and reveals timestamped transcript evidence", () => {
  render(
    <CoachingReport
      scenario={defaultScenario}
      transcript={completedTranscript}
      onRetry={vi.fn()}
      onReset={vi.fn()}
    />,
  );

  expect(screen.getByRole("heading", { name: "會後教練報告" })).toBeVisible();
  expect(screen.getByText("提出具體請求：已完成")).toBeVisible();
  fireEvent.click(screen.getAllByRole("button", { name: "查看 00:15" })[0]);
  expect(screen.getByText("逐字稿證據：我希望調整 5%，並讓交付流程縮短 3 天。")).toBeVisible();
});

test("shows missing evidence and retry prompts without disguising them as links", () => {
  render(
    <CoachingReport
      scenario={defaultScenario}
      transcript={[]}
      onRetry={vi.fn()}
      onReset={vi.fn()}
    />,
  );

  expect(screen.getAllByText("本局未出現")).toHaveLength(4);
  expect(screen.getByText("重練提示：直接說出你期待的調整數字，並接著說明依據。")).toBeVisible();
  expect(screen.queryByRole("button", { name: "本局未出現" })).not.toBeInTheDocument();
});

test("provides retry and reset actions", () => {
  const onRetry = vi.fn();
  const onReset = vi.fn();
  render(
    <CoachingReport
      scenario={defaultScenario}
      transcript={[]}
      onRetry={onRetry}
      onReset={onReset}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "再練一次" }));
  fireEvent.click(screen.getByRole("button", { name: "重新設定情境" }));

  expect(onRetry).toHaveBeenCalledOnce();
  expect(onReset).toHaveBeenCalledOnce();
});

test("shows delivery observations without psychological claims", () => {
  render(<CoachingReport scenario={defaultScenario} transcript={[{ speaker: "user", elapsedSeconds: 1, text: "嗯我期待調整", delivery: { source: "voice", durationSeconds: 10 } }]} onRetry={vi.fn()} onReset={vi.fn()} />);
  expect(screen.getByRole("heading", { name: "可觀察表達訊號" })).toBeVisible();
  expect(screen.getByText("這些是可回看的行為資料，不是自信、誠實或情緒分數；不同語言不可直接比較。")).toBeVisible();
});
