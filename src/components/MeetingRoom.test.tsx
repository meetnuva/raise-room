import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, vi } from "vitest";
import { simulatedResponder } from "../domain/meeting";
import type { ScheduledPracticeMeeting } from "../domain/practice-schedule";
import { defaultScenario } from "../domain/scenario";
import type { VisualSignals } from "../domain/visual";
import type { useLocalVoice } from "../hooks/use-local-voice";
import type { PracticeMediaController } from "../runtime/use-practice-media";
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

function scheduledMeeting(durationMinutes: 5 | 10 | 20): ScheduledPracticeMeeting {
  return {
    id: `practice-${durationMinutes}`,
    title: `與${defaultScenario.manager.name}的年度調薪 1:1`,
    managerName: defaultScenario.manager.name,
    company: defaultScenario.company,
    role: defaultScenario.role,
    startsAt: "2026-08-30T10:00:00.000Z",
    endsAt: new Date(Date.parse("2026-08-30T10:00:00.000Z") + durationMinutes * 60_000).toISOString(),
    durationMinutes,
  };
}

function injectedVoice(): ReturnType<typeof useLocalVoice> {
  return {
    status: "unsupported",
    progress: null,
    loadingMessage: null,
    partialText: "",
    errorMessage: null,
    language: "zh",
    setLanguage: vi.fn(),
    loadModel: vi.fn(),
    startRecording: vi.fn(),
    stopAndTranscribe: vi.fn(),
    cancel: vi.fn(),
    device: null,
    releaseModel: vi.fn(),
  } as ReturnType<typeof useLocalVoice>;
}

function injectedCamera(overrides: Partial<PracticeMediaController> = {}): PracticeMediaController {
  return {
    status: "idle",
    stream: null,
    cameraEnabled: false,
    microphoneEnabled: false,
    errorMessage: null,
    request: vi.fn().mockResolvedValue(undefined),
    toggleCamera: vi.fn(),
    toggleMicrophone: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
  visionState.value.signals = { sampleCount: 0, faceVisibleRatio: null, centeredRatio: null, stableDistanceRatio: null, cameraDirectionEstimateRatio: null };
  visionState.value.stopObserving.mockClear();
});

test.each([5, 10, 20] as const)("uses the scheduled %i minute title and countdown", (durationMinutes) => {
  render(
    <MeetingRoom
      meeting={scheduledMeeting(durationMinutes)}
      scenario={defaultScenario}
      responder={simulatedResponder}
    />,
  );

  expect(screen.getByRole("heading", { name: `與${defaultScenario.manager.name}的年度調薪 1:1` })).toBeVisible();
  expect(screen.getByLabelText(`剩餘時間 ${String(durationMinutes).padStart(2, "0")}:00`)).toBeVisible();
});

test("styles the manager as a 16:9 main stage with a smaller camera overlay", () => {
  const styles = readFileSync("src/styles.css", "utf8");

  expect(styles).toMatch(/\.manager-stage\s*\{[^}]*width:\s*100%;[^}]*aspect-ratio:\s*16\s*\/\s*9;/s);
  expect(styles).toMatch(/\.meeting-sidebar\s*\{[^}]*position:\s*absolute;[^}]*width:\s*clamp\(10rem,\s*22%,\s*16rem\);/s);
  expect(styles).toContain("transition: opacity var(--motion-standard)");
});

test("bounds the 16:9 manager stage for short desktop viewports without a mobile height override", () => {
  const styles = readFileSync("src/styles.css", "utf8");

  expect(styles).toMatch(/@media \(max-height: 899px\)[\s\S]*?\.manager-stage\s*\{[^}]*width:\s*min\(100%,\s*58rem\);[^}]*aspect-ratio:\s*16\s*\/\s*9;[^}]*min-height:\s*0;[^}]*margin-inline:\s*auto;/);
  expect(styles).toMatch(/@media \(min-height: 900px\)[\s\S]*?\.manager-stage\s*\{[^}]*width:\s*min\(100%,\s*72rem\);/);
  expect(styles).not.toMatch(/@media \(max-width: 42rem\)[\s\S]*?\.manager-stage\s*\{[^}]*min-height:\s*22rem;/);
});

test("emits all proportional events at exact M:SS offsets for a scheduled twenty minute meeting", () => {
  vi.useFakeTimers();
  let now = 0;
  render(
    <MeetingRoom
      meeting={scheduledMeeting(20)}
      scenario={defaultScenario}
      responder={simulatedResponder}
      clock={{ now: () => now, intervalMs: 1 }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "開啟壓力事件" }));

  for (const [offsetSeconds, expected] of [[120, "2:00"], [360, "6:00"], [600, "10:00"], [840, "14:00"], [1080, "18:00"]] as const) {
    now = offsetSeconds * 1000;
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText(`${expected} · 已發生`)).toBeVisible();
  }
  vi.useRealTimers();
});

test("formats five minute half-minute pressure offsets without decimal minutes", () => {
  render(<MeetingRoom meeting={scheduledMeeting(5)} scenario={defaultScenario} responder={simulatedResponder} />);

  fireEvent.click(screen.getByRole("button", { name: "開啟壓力事件" }));

  expect(screen.getByText("0:30 · 待命")).toBeVisible();
  expect(screen.getByText("1:30 · 待命")).toBeVisible();
  expect(screen.queryByText(/第 0\.5 分鐘/)).toBeNull();
});

test("starts with information closed and returns focus to its control-bar opener after close", () => {
  const { container } = render(<MeetingRoom meeting={scheduledMeeting(10)} scenario={defaultScenario} responder={simulatedResponder} />);

  const opener = screen.getByRole("button", { name: "開啟逐字稿" });
  expect(container.querySelector(".meeting-layout")).not.toHaveClass("panel-open");
  fireEvent.click(opener);
  expect(container.querySelector(".meeting-layout")).toHaveClass("panel-open");
  fireEvent.click(screen.getByRole("button", { name: "關閉資訊面板" }));
  expect(opener).toHaveFocus();
  expect(container.querySelector(".meeting-layout")).not.toHaveClass("panel-open");
});

test("opens the responsive drawer from the fixed control bar and restores focus after Escape", () => {
  render(<MeetingRoom meeting={scheduledMeeting(10)} scenario={defaultScenario} responder={simulatedResponder} />);

  const opener = screen.getByRole("button", { name: "開啟逐字稿" });
  fireEvent.click(opener);
  expect(screen.getByRole("complementary", { name: "會議資訊" })).toBeVisible();
  expect(screen.getByRole("button", { name: "關閉資訊面板" })).toBeVisible();
  fireEvent.keyDown(screen.getByRole("complementary", { name: "會議資訊" }), { key: "Escape" });
  expect(opener).toHaveFocus();
});

test("returns focus to the actual more-menu opener after it routes information into the transcript tab", () => {
  render(<MeetingRoom meeting={scheduledMeeting(10)} scenario={defaultScenario} responder={simulatedResponder} />);

  const more = screen.getByRole("button", { name: "更多會議選項" });
  fireEvent.click(more);
  fireEvent.click(screen.getByRole("menuitem", { name: "會議資訊" }));
  fireEvent.click(screen.getByRole("button", { name: "關閉資訊面板" }));
  expect(more).toHaveFocus();
});

test("lets Escape dismiss the more menu without also dismissing its open drawer", () => {
  render(<MeetingRoom meeting={scheduledMeeting(10)} scenario={defaultScenario} responder={simulatedResponder} />);

  fireEvent.click(screen.getByRole("button", { name: "開啟逐字稿" }));
  const more = screen.getByRole("button", { name: "更多會議選項" });
  fireEvent.click(more);
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "語音與逐字稿" }), { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(screen.getByRole("complementary", { name: "會議資訊" })).toBeVisible();
  expect(more).toHaveFocus();
});

test("places voice controls inside the transcript content and keeps one microphone button in the fixed bar", () => {
  const idleVoice = injectedVoice();
  idleVoice.status = "idle";
  render(<MeetingRoom meeting={scheduledMeeting(10)} scenario={defaultScenario} responder={simulatedResponder} voice={idleVoice} />);

  expect(screen.getAllByRole("button", { name: "開始說話" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "開啟逐字稿" }));
  expect(screen.getByText("音訊不會上傳，模型檔首次由 Hugging Face 下載")).toBeVisible();
});

test("requests the injected lobby media when its stream has not been granted, then toggles only an active stream", () => {
  const camera = injectedCamera();
  const { rerender } = render(
    <MeetingRoom
      meeting={scheduledMeeting(10)}
      scenario={defaultScenario}
      camera={camera}
      voice={injectedVoice()}
      responder={simulatedResponder}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "開啟我的鏡頭" }));
  expect(camera.request).toHaveBeenCalledOnce();
  expect(camera.toggleCamera).not.toHaveBeenCalled();
  expect(camera.dispose).not.toHaveBeenCalled();

  const activeCamera = injectedCamera({
    status: "active",
    stream: {} as MediaStream,
    cameraEnabled: true,
  });
  rerender(
    <MeetingRoom
      meeting={scheduledMeeting(10)}
      scenario={defaultScenario}
      camera={activeCamera}
      voice={injectedVoice()}
      responder={simulatedResponder}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "關閉我的鏡頭" }));
  expect(activeCamera.toggleCamera).toHaveBeenCalledOnce();
  expect(activeCamera.request).not.toHaveBeenCalled();
  expect(activeCamera.dispose).not.toHaveBeenCalled();
});

test("keeps the local visual control out of the transcript tab and renders it only in observations", () => {
  const camera = injectedCamera({
    status: "active",
    stream: {} as MediaStream,
    cameraEnabled: true,
  });
  render(
    <MeetingRoom
      meeting={scheduledMeeting(10)}
      scenario={defaultScenario}
      camera={camera}
      voice={injectedVoice()}
      responder={simulatedResponder}
    />,
  );

  expect(screen.queryByRole("button", { name: "開始本機視覺觀察" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "更多會議選項" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "本機觀察" }));
  expect(screen.getAllByRole("button", { name: "開始本機視覺觀察" })).toHaveLength(1);
});

test("shows the first pressure card when the development jump is used", () => {
  render(<MeetingRoom meeting={scheduledMeeting(10)} scenario={defaultScenario} responder={simulatedResponder} />);

  fireEvent.click(screen.getByRole("button", { name: "開啟逐字稿" }));
  fireEvent.click(screen.getByRole("button", { name: "跳到第一個壓力事件" }));
  fireEvent.click(screen.getByRole("tab", { name: "壓力事件" }));

  expect(screen.getByText("要求先說明成果")).toBeVisible();
});

test("switches self stage focus reversibly without remounting the presenter or local video", () => {
  const camera = injectedCamera({ status: "active", stream: {} as MediaStream, cameraEnabled: true });
  const { container } = render(<MeetingRoom meeting={scheduledMeeting(10)} scenario={defaultScenario} camera={camera} voice={injectedVoice()} responder={simulatedResponder} />);
  const presenter = screen.getByLabelText("Perxona 3D 主管舞台");
  const video = screen.getByLabelText("本機鏡頭預覽");

  fireEvent.click(screen.getByRole("button", { name: "你的更多操作" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "放大自己" }));
  expect(container.querySelector(".meeting-stages")).toHaveClass("stage-focus-self");
  expect(screen.getByLabelText("Perxona 3D 主管舞台")).toBe(presenter);
  expect(screen.getByLabelText("本機鏡頭預覽")).toBe(video);

  fireEvent.click(screen.getByRole("button", { name: "你的更多操作" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "還原主管畫面" }));
  expect(container.querySelector(".meeting-stages")).toHaveClass("stage-focus-manager");
  expect(screen.getByLabelText("Perxona 3D 主管舞台")).toBe(presenter);
  expect(screen.getByLabelText("本機鏡頭預覽")).toBe(video);
});

test("surfaces engine source and manager notices as four-second toasts", async () => {
  vi.useFakeTimers();
  render(<MeetingRoom meeting={scheduledMeeting(10)} scenario={defaultScenario} responder={{ reply: async () => ({ text: "我需要你先說明。", source: "simulated", notice: "主管立場更新" }) }} />);

  expect(screen.getByText("主管引擎：等待首次回覆")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "開啟逐字稿" }));
  fireEvent.change(screen.getByLabelText("開發用文字輸入"), { target: { value: "我想討論調薪" } });
  fireEvent.click(screen.getByRole("button", { name: "送出" }));
  await act(async () => {});
  expect(screen.getByText("主管引擎：本機腳本 fallback")).toBeVisible();
  expect(screen.getByText("主管立場更新")).toBeVisible();
});

test("does not reset the four-second engine toast while the meeting clock rerenders", () => {
  vi.useFakeTimers();
  let now = 0;
  render(<MeetingRoom meeting={scheduledMeeting(10)} scenario={defaultScenario} responder={simulatedResponder} clock={{ now: () => now, intervalMs: 1000 }} />);

  expect(screen.getByText("主管引擎：等待首次回覆")).toBeVisible();
  now = 1000;
  act(() => vi.advanceTimersByTime(1000));
  now = 2000;
  act(() => vi.advanceTimersByTime(1000));
  now = 3000;
  act(() => vi.advanceTimersByTime(1000));
  now = 4000;
  act(() => vi.advanceTimersByTime(1000));

  expect(screen.queryByText("主管引擎：等待首次回覆")).toBeNull();
});

test("keeps a send error through retry failures and removes it only after a successful reply", async () => {
  let rejectRetry = (error: Error) => {};
  const responder = {
    reply: vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(() => new Promise<never>((_resolve, reject) => { rejectRetry = reject; }))
      .mockResolvedValueOnce({ text: "收到", source: "simulated" as const }),
  };
  render(<MeetingRoom meeting={scheduledMeeting(10)} scenario={defaultScenario} responder={responder} />);
  fireEvent.click(screen.getByRole("button", { name: "開啟逐字稿" }));

  fireEvent.change(screen.getByLabelText("開發用文字輸入"), { target: { value: "第一次" } });
  fireEvent.click(screen.getByRole("button", { name: "送出" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("主管回覆暫時無法取得，請重新送出。");

  fireEvent.change(screen.getByLabelText("開發用文字輸入"), { target: { value: "第二次" } });
  fireEvent.click(screen.getByRole("button", { name: "送出" }));
  expect(screen.getByRole("alert")).toHaveTextContent("主管回覆暫時無法取得，請重新送出。");
  await act(async () => rejectRetry(new Error("offline")));
  expect(screen.getByRole("alert")).toHaveTextContent("主管回覆暫時無法取得，請重新送出。");

  fireEvent.change(screen.getByLabelText("開發用文字輸入"), { target: { value: "第三次" } });
  fireEvent.click(screen.getByRole("button", { name: "送出" }));
  await screen.findByText("收到");
  expect(screen.queryByRole("alert")).toBeNull();
});

test("returns focus to the manager tile menu trigger after its information action closes", () => {
  render(<MeetingRoom meeting={scheduledMeeting(10)} scenario={defaultScenario} responder={simulatedResponder} />);
  const opener = screen.getByRole("button", { name: "主管更多操作" });

  fireEvent.click(opener);
  fireEvent.click(screen.getByRole("menuitem", { name: "開啟會議資訊" }));
  fireEvent.click(screen.getByRole("button", { name: "關閉資訊面板" }));

  expect(opener).toHaveFocus();
});

test("returns focus to the self tile menu trigger after its device action closes", () => {
  render(<MeetingRoom meeting={scheduledMeeting(10)} scenario={defaultScenario} responder={simulatedResponder} />);
  const opener = screen.getByRole("button", { name: "你的更多操作" });

  fireEvent.click(opener);
  fireEvent.click(screen.getByRole("menuitem", { name: "開啟裝置設定" }));
  expect(screen.getByText("麥克風與鏡頭選擇會套用到下一次明確請求裝置權限。" )).toBeVisible();
  expect(screen.queryByText(/喇叭/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "關閉資訊面板" }));

  expect(opener).toHaveFocus();
});

test("keeps a timed event after the development fallback receives a reply", async () => {
  let resolveReply = (_reply: { text: string; source: "simulated" }) => {};
  const delayedResponder = {
    reply: () => new Promise<{ text: string; source: "simulated" }>((resolve) => {
      resolveReply = resolve;
    }),
  };
  render(<MeetingRoom meeting={scheduledMeeting(10)} scenario={defaultScenario} responder={delayedResponder} />);

  fireEvent.click(screen.getByRole("button", { name: "開啟逐字稿" }));
  fireEvent.change(screen.getByLabelText("開發用文字輸入"), {
    target: { value: "我想依成果討論調薪" },
  });
  fireEvent.click(screen.getByRole("button", { name: "送出" }));
  fireEvent.click(screen.getByRole("button", { name: "跳到第一個壓力事件" }));
  await act(async () => resolveReply({ text: "請說明具體成果。", source: "simulated" }));

  fireEvent.click(screen.getByRole("tab", { name: "壓力事件" }));
  expect(screen.getByText("1:00 · 已發生")).toBeVisible();
});

test("hands the append-only transcript to onFinish", async () => {
  const onFinish = vi.fn();
  render(
    <MeetingRoom
      meeting={scheduledMeeting(10)}
      scenario={defaultScenario}
      responder={simulatedResponder}
      onFinish={onFinish}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "開啟逐字稿" }));
  fireEvent.change(screen.getByLabelText("開發用文字輸入"), {
    target: { value: "我想依成果討論調薪" },
  });
  fireEvent.click(screen.getByRole("button", { name: "送出" }));
  await screen.findByText("請以具體成果說明這次薪資調整請求。");
  fireEvent.click(screen.getByRole("button", { name: "離開並查看報告" }));

  expect(onFinish).toHaveBeenCalledWith([
    { speaker: "user", text: "我想依成果討論調薪", elapsedSeconds: 0, delivery: { source: "text" } },
    {
      speaker: "manager",
      text: "請以具體成果說明這次薪資調整請求。",
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
  render(<MeetingRoom meeting={scheduledMeeting(10)} scenario={defaultScenario} responder={simulatedResponder} onFinish={onFinish} />);

  fireEvent.click(screen.getByRole("button", { name: "離開並查看報告" }));

  expect(visionState.value.stopObserving).toHaveBeenCalledOnce();
  expect(onFinish).toHaveBeenCalledWith([], visionState.value.signals);
});

test("renders one bottom-control camera toggle when Perxona is not configured", () => {
  render(<MeetingRoom meeting={scheduledMeeting(10)} scenario={defaultScenario} responder={simulatedResponder} />);

  expect(screen.getAllByRole("button", { name: "開啟我的鏡頭" })).toHaveLength(1);
});

test("marks text fallback turns and disables a second submission while replying", async () => {
  let resolveReply = (_reply: { text: string; source: "simulated" }) => {};
  render(<MeetingRoom meeting={scheduledMeeting(10)} scenario={defaultScenario} responder={{ reply: () => new Promise((resolve) => { resolveReply = resolve; }) }} />);
  fireEvent.click(screen.getByRole("button", { name: "開啟逐字稿" }));
  fireEvent.change(screen.getByLabelText("開發用文字輸入"), { target: { value: "文字回合" } }); fireEvent.click(screen.getByRole("button", { name: "送出" }));
  expect(screen.getByRole("button", { name: "送出" })).toBeDisabled(); await act(async () => resolveReply({ text: "收到", source: "simulated" }));
  fireEvent.click(screen.getByRole("button", { name: "離開並查看報告" }));
});

test("auto-completion hands the latest append-only transcript to onFinish exactly once", async () => {
  vi.useFakeTimers(); let now = 0; let resolveReply = (_reply: { text: string; source: "simulated" }) => {}; const onFinish = vi.fn();
  render(<MeetingRoom meeting={scheduledMeeting(10)} scenario={defaultScenario} responder={{ reply: () => new Promise<{ text: string; source: "simulated" }>((resolve) => { resolveReply = resolve; }) }} onFinish={onFinish} clock={{ durationSeconds: 2, now: () => now, intervalMs: 250 }} />);
  fireEvent.click(screen.getByRole("button", { name: "開啟逐字稿" }));
  fireEvent.change(screen.getByLabelText("開發用文字輸入"), { target: { value: "最新回合" } }); fireEvent.click(screen.getByRole("button", { name: "送出" })); await act(async () => resolveReply({ text: "主管回覆", source: "simulated" }));
  now = 2_000; act(() => vi.advanceTimersByTime(250));
  expect(onFinish).toHaveBeenCalledTimes(1); expect(onFinish).toHaveBeenCalledWith([
    { speaker: "user", text: "最新回合", elapsedSeconds: 0, delivery: { source: "text" } }, { speaker: "manager", text: "主管回覆", elapsedSeconds: 0, managerSource: "simulated" },
  ]); vi.useRealTimers();
});

test("unlocks text input and shows a visible error when the manager responder rejects", async () => {
  render(<MeetingRoom meeting={scheduledMeeting(10)} scenario={defaultScenario} responder={{ reply: () => Promise.reject(new Error("offline")) }} />);
  fireEvent.click(screen.getByRole("button", { name: "開啟逐字稿" }));
  fireEvent.change(screen.getByLabelText("開發用文字輸入"), { target: { value: "重試" } }); fireEvent.click(screen.getByRole("button", { name: "送出" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("主管回覆暫時無法取得，請重新送出。"); expect(screen.getByRole("button", { name: "送出" })).not.toBeDisabled();
});

test("announces the Perxona manager source after a successful reply", async () => {
  render(
    <MeetingRoom
      meeting={scheduledMeeting(10)}
      scenario={defaultScenario}
      responder={{ reply: async () => ({ text: "請先說明具體成果。", source: "perxona" }) }}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "開啟逐字稿" }));
  expect(screen.getByText("主管引擎：等待首次回覆")).toBeVisible();
  fireEvent.change(screen.getByLabelText("開發用文字輸入"), { target: { value: "我的請求" } });
  fireEvent.click(screen.getByRole("button", { name: "送出" }));

  expect(await screen.findByText("主管引擎：Perxona 動態主管")).toBeVisible();
});

test("shows a non-blocking fallback notice without placing it in the transcript", async () => {
  render(
    <MeetingRoom
      meeting={scheduledMeeting(10)}
      scenario={defaultScenario}
      responder={{
        reply: async () => ({
          text: "請先說明具體成果。",
          source: "simulated",
          notice: "Perxona 動態主管暫時無法使用，已切換為本機腳本 fallback。",
        }),
      }}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "開啟逐字稿" }));
  fireEvent.change(screen.getByLabelText("開發用文字輸入"), { target: { value: "我的請求" } });
  fireEvent.click(screen.getByRole("button", { name: "送出" }));

  expect(await screen.findByText("主管引擎：本機腳本 fallback")).toBeVisible();
  expect(screen.getByText("Perxona 動態主管暫時無法使用，已切換為本機腳本 fallback。")).toBeVisible();
  expect(screen.getByText("請先說明具體成果。")).toBeVisible();
});
