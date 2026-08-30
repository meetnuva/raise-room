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

test("provides retry-to-lobby and return-home actions", () => {
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
  fireEvent.click(screen.getByRole("button", { name: "返回首頁" }));

  expect(onRetry).toHaveBeenCalledOnce();
  expect(onReset).toHaveBeenCalledOnce();
});

test("shows delivery observations without psychological claims", () => {
  render(<CoachingReport scenario={defaultScenario} transcript={[{ speaker: "user", elapsedSeconds: 1, text: "嗯我期待調整", delivery: { source: "voice", durationSeconds: 10 } }]} onRetry={vi.fn()} onReset={vi.fn()} />);
  expect(screen.getByRole("heading", { name: "可觀察表達訊號" })).toBeVisible();
  expect(screen.getByText("這些是可回看的行為資料，不是自信、誠實或情緒分數；不同語言不可直接比較。")).toBeVisible();
});

test("shows transparent aggregate visual signals without treating them as a score", () => {
  render(<CoachingReport
    scenario={defaultScenario}
    transcript={[]}
    visualSignals={{ sampleCount: 4, faceVisibleRatio: 0.75, centeredRatio: 0.5, stableDistanceRatio: null, cameraDirectionEstimateRatio: 1 }}
    onRetry={vi.fn()}
    onReset={vi.fn()}
  />);
  expect(screen.getByRole("heading", { name: "可觀察視覺訊號" })).toBeVisible();
  expect(screen.getByText("臉部可見率：75%")).toBeVisible();
  expect(screen.getByText("距離穩定率：資料不足")).toBeVisible();
  expect(screen.getByText("鏡頭方向只是 iris 幾何近似，不等於眼神接觸；所有數值都不是情緒、誠實、自信或能力分數。")).toBeVisible();
});

test("states when visual observation was not enabled", () => {
  render(<CoachingReport scenario={defaultScenario} transcript={[]} onRetry={vi.fn()} onReset={vi.fn()} />);
  expect(screen.getByText("本局未啟用視覺觀察")).toBeVisible();
});
