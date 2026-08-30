import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { simulatedResponder } from "../domain/meeting";
import { defaultScenario } from "../domain/scenario";
import type { VisualSignals } from "../domain/visual";
import { MeetingRoom } from "./MeetingRoom";

const visionState = vi.hoisted(() => ({
  value: {
    status: "ready",
    progress: null,
    lastObservation: null,
    signals: { sampleCount: 0, faceVisibleRatio: null, centeredRatio: null, stableDistanceRatio: null, cameraDirectionEstimateRatio: null } as VisualSignals,
    errorMessage: null,
    loadModel: vi.fn(), startObserving: vi.fn(), stopObserving: vi.fn(), resetSignals: vi.fn(),
    getSignals: vi.fn(() => visionState.value.signals),
  },
}));

vi.mock("../hooks/use-local-vision", () => ({ useLocalVision: () => visionState.value }));

afterEach(() => {
  visionState.value.signals = { sampleCount: 0, faceVisibleRatio: null, centeredRatio: null, stableDistanceRatio: null, cameraDirectionEstimateRatio: null };
  visionState.value.stopObserving.mockClear();
});

test("shows the budget-freeze card when the test clock reaches three minutes", () => {
  render(<MeetingRoom scenario={defaultScenario} responder={simulatedResponder} />);

  fireEvent.click(screen.getByRole("button", { name: "跳到第 3 分鐘" }));

  expect(screen.getByText("本季預算已凍結")).toBeVisible();
});

test("keeps a timed event after the development fallback receives a reply", async () => {
  let resolveReply = (_reply: { text: string; source: "simulated" }) => {};
  const delayedResponder = {
    reply: () => new Promise<{ text: string; source: "simulated" }>((resolve) => {
      resolveReply = resolve;
    }),
  };
  render(<MeetingRoom scenario={defaultScenario} responder={delayedResponder} />);

  fireEvent.change(screen.getByLabelText("開發用文字輸入"), {
    target: { value: "我想依成果討論調薪" },
  });
  fireEvent.click(screen.getByRole("button", { name: "送出" }));
  fireEvent.click(screen.getByRole("button", { name: "跳到第 3 分鐘" }));
  await act(async () => resolveReply({ text: "請說明具體成果。", source: "simulated" }));

  expect(screen.getByText("第 3 分鐘 · 已發生")).toBeVisible();
});

test("hands the append-only transcript to onFinish", async () => {
  const onFinish = vi.fn();
  render(
    <MeetingRoom
      scenario={defaultScenario}
      responder={simulatedResponder}
      onFinish={onFinish}
    />,
  );

  fireEvent.change(screen.getByLabelText("開發用文字輸入"), {
    target: { value: "我想依成果討論調薪" },
  });
  fireEvent.click(screen.getByRole("button", { name: "送出" }));
  await screen.findByText("王主管：請以具體成果說明這次薪資調整請求。");
  fireEvent.click(screen.getByRole("button", { name: "結束並看報告" }));

  expect(onFinish).toHaveBeenCalledWith([
    { speaker: "user", text: "我想依成果討論調薪", elapsedSeconds: 0, delivery: { source: "text" } },
    {
      speaker: "manager",
      text: "王主管：請以具體成果說明這次薪資調整請求。",
      elapsedSeconds: 0,
      managerSource: "simulated",
    },
  ]);
  expect(onFinish.mock.calls[0]).toHaveLength(1);
});

test("hands only aggregate visual signals to onFinish after stopping observation", () => {
  visionState.value.signals = {
    sampleCount: 3, faceVisibleRatio: 1, centeredRatio: 2 / 3, stableDistanceRatio: 1,
    cameraDirectionEstimateRatio: 0.5,
  };
  const onFinish = vi.fn();
  render(<MeetingRoom scenario={defaultScenario} responder={simulatedResponder} onFinish={onFinish} />);

  fireEvent.click(screen.getByRole("button", { name: "結束並看報告" }));

  expect(visionState.value.stopObserving).toHaveBeenCalledOnce();
  expect(onFinish).toHaveBeenCalledWith([], visionState.value.signals);
});

test("renders one bottom-control camera toggle when Perxona is not configured", () => {
  render(<MeetingRoom scenario={defaultScenario} responder={simulatedResponder} />);

  expect(screen.getAllByRole("button", { name: "開啟我的鏡頭" })).toHaveLength(1);
});

test("marks text fallback turns and disables a second submission while replying", async () => {
  let resolveReply = (_reply: { text: string; source: "simulated" }) => {};
  render(<MeetingRoom scenario={defaultScenario} responder={{ reply: () => new Promise((resolve) => { resolveReply = resolve; }) }} />);
  fireEvent.change(screen.getByLabelText("開發用文字輸入"), { target: { value: "文字回合" } }); fireEvent.click(screen.getByRole("button", { name: "送出" }));
  expect(screen.getByRole("button", { name: "送出" })).toBeDisabled(); await act(async () => resolveReply({ text: "收到", source: "simulated" }));
  fireEvent.click(screen.getByRole("button", { name: "結束並看報告" }));
});

test("auto-completion hands the latest append-only transcript to onFinish exactly once", async () => {
  vi.useFakeTimers(); let now = 0; let resolveReply = (_reply: { text: string; source: "simulated" }) => {}; const onFinish = vi.fn();
  render(<MeetingRoom scenario={defaultScenario} responder={{ reply: () => new Promise<{ text: string; source: "simulated" }>((resolve) => { resolveReply = resolve; }) }} onFinish={onFinish} clock={{ durationSeconds: 2, now: () => now, intervalMs: 250 }} />);
  fireEvent.change(screen.getByLabelText("開發用文字輸入"), { target: { value: "最新回合" } }); fireEvent.click(screen.getByRole("button", { name: "送出" })); await act(async () => resolveReply({ text: "主管回覆", source: "simulated" }));
  now = 2_000; act(() => vi.advanceTimersByTime(250));
  expect(onFinish).toHaveBeenCalledTimes(1); expect(onFinish).toHaveBeenCalledWith([
    { speaker: "user", text: "最新回合", elapsedSeconds: 0, delivery: { source: "text" } }, { speaker: "manager", text: "主管回覆", elapsedSeconds: 0, managerSource: "simulated" },
  ]); vi.useRealTimers();
});

test("unlocks text input and shows a visible error when the manager responder rejects", async () => {
  render(<MeetingRoom scenario={defaultScenario} responder={{ reply: () => Promise.reject(new Error("offline")) }} />);
  fireEvent.change(screen.getByLabelText("開發用文字輸入"), { target: { value: "重試" } }); fireEvent.click(screen.getByRole("button", { name: "送出" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("主管回覆暫時無法取得，請重新送出。"); expect(screen.getByRole("button", { name: "送出" })).not.toBeDisabled();
});
