import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { beforeEach, expect, test, vi } from "vitest";
import type { ScheduledPracticeMeeting } from "../domain/practice-schedule";
import { defaultScenario } from "../domain/scenario";
import type { PresenterRuntimeConfig } from "../lib/perxona-config";
import type { PracticeMediaController } from "../runtime/use-practice-media";
import type { VoiceStatus } from "../hooks/use-local-voice";
import { PrejoinLobby } from "./PrejoinLobby";

const meeting: ScheduledPracticeMeeting = {
  id: "practice-2026-08-30T10:00:00.000Z-20",
  title: "與王主管的年度調薪 1:1",
  managerName: "王主管",
  company: "nuva",
  role: "產品營運專員",
  startsAt: new Date(2026, 7, 30, 18, 0).toISOString(),
  endsAt: new Date(2026, 7, 30, 18, 20).toISOString(),
  durationMinutes: 20,
};

function fakeMedia(overrides: Partial<PracticeMediaController> = {}): PracticeMediaController {
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

function fakeVoice(status: VoiceStatus = "idle") {
  return {
    status,
    progress: null,
    loadingMessage: null,
    partialText: "",
    errorMessage: null,
    language: "zh" as const,
    setLanguage: vi.fn(),
    loadModel: vi.fn(),
    startRecording: vi.fn(),
    stopAndTranscribe: vi.fn(),
    cancel: vi.fn(),
    device: null,
    releaseModel: vi.fn(),
  };
}

const enabledPresenter: PresenterRuntimeConfig = {
  enabled: true,
  publishableKey: "publishable-key",
  presenterUrl: "https://cdn.perxona.ai/asia/prod/latest/widget/entry/presenter.js",
  target: { avatarId: "avatar", sceneId: "scene", voiceId: "voice" },
};

function renderLobby(input: {
  media?: PracticeMediaController;
  voice?: ReturnType<typeof fakeVoice>;
  presenterConfig?: PresenterRuntimeConfig;
  presenterPreloader?: (url: string) => Promise<void>;
} = {}) {
  const onJoin = vi.fn();
  const onCancel = vi.fn();
  render(
    <PrejoinLobby
      meeting={meeting}
      scenario={defaultScenario}
      media={input.media ?? fakeMedia()}
      voice={input.voice ?? fakeVoice()}
      presenterConfig={input.presenterConfig ?? { enabled: false, reason: "missing-target" }}
      presenterPreloader={input.presenterPreloader}
      onJoin={onJoin}
      onCancel={onCancel}
    />,
  );
  return { onJoin, onCancel };
}

beforeEach(() => vi.clearAllMocks());

test("keeps the desktop lobby at 70/30 with a 16:9 local preview stage", () => {
  const styles = readFileSync("src/styles.css", "utf8");

  expect(styles).toMatch(/\.prejoin-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*7fr\)\s*minmax\(320px,\s*3fr\);/s);
  expect(styles).toMatch(/\.prejoin-preview \.local-camera-tile\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9;/s);
  expect(styles).toMatch(/\.prejoin-preview \.local-camera-tile video\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9;/s);
});

test("waits for explicit permission, has no mount side effects, and always permits early negotiation", () => {
  const media = fakeMedia();
  const preloader = vi.fn().mockResolvedValue(undefined);
  const { onJoin } = renderLobby({ media, presenterConfig: enabledPresenter, presenterPreloader: preloader });

  expect(media.request).not.toHaveBeenCalled();
  expect(preloader).not.toHaveBeenCalled();
  expect(screen.getByText("18:00–18:20")).toBeVisible();
  expect(screen.getByRole("heading", { level: 1, name: "與王主管的年度調薪 1:1" })).toBeVisible();
  expect(screen.getByText("可以提早開始談判")).toBeVisible();
  expect(screen.getByRole("button", { name: "立即進入會議室" })).toBeEnabled();

  fireEvent.click(screen.getByRole("button", { name: "允許鏡頭與麥克風" }));
  expect(media.request).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "立即進入會議室" }));
  expect(onJoin).toHaveBeenCalledOnce();
});

test("shows denied fallback and delegates the round microphone and camera controls", () => {
  const denied = fakeMedia({ status: "denied", errorMessage: "你尚未允許相機與麥克風權限。" });
  renderLobby({ media: denied });

  expect(screen.getByText("你尚未允許相機與麥克風權限。")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "允許鏡頭與麥克風" }));
  expect(denied.request).toHaveBeenCalledOnce();

  const active = fakeMedia({ status: "active", stream: {} as MediaStream, cameraEnabled: true, microphoneEnabled: true });
  const { rerender } = render(
    <PrejoinLobby meeting={meeting} scenario={defaultScenario} media={active} voice={fakeVoice()} presenterConfig={{ enabled: false, reason: "missing-target" }} onJoin={vi.fn()} onCancel={vi.fn()} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "關閉麥克風" }));
  fireEvent.click(screen.getByRole("button", { name: "關閉鏡頭" }));
  expect(active.toggleMicrophone).toHaveBeenCalledOnce();
  expect(active.toggleCamera).toHaveBeenCalledOnce();
  rerender(<PrejoinLobby meeting={meeting} scenario={defaultScenario} media={active} voice={fakeVoice()} presenterConfig={{ enabled: false, reason: "missing-target" }} onJoin={vi.fn()} onCancel={vi.fn()} />);
});

test("delegates ASR model load and cancellation without constructing a new controller", () => {
  const idle = fakeVoice("idle");
  const { rerender } = render(
    <PrejoinLobby meeting={meeting} scenario={defaultScenario} media={fakeMedia()} voice={idle} presenterConfig={{ enabled: false, reason: "missing-target" }} onJoin={vi.fn()} onCancel={vi.fn()} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "載入本機語音模型" }));
  expect(idle.loadModel).toHaveBeenCalledOnce();

  const loading = fakeVoice("loading-model");
  rerender(<PrejoinLobby meeting={meeting} scenario={defaultScenario} media={fakeMedia()} voice={loading} presenterConfig={{ enabled: false, reason: "missing-target" }} onJoin={vi.fn()} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "取消載入" }));
  expect(loading.releaseModel).toHaveBeenCalledOnce();
});

test("preloads only after explicit presenter check and reports success, failure, and disabled state", async () => {
  const preloader = vi.fn().mockResolvedValue(undefined);
  const { rerender } = render(
    <PrejoinLobby meeting={meeting} scenario={defaultScenario} media={fakeMedia()} voice={fakeVoice()} presenterConfig={enabledPresenter} presenterPreloader={preloader} onJoin={vi.fn()} onCancel={vi.fn()} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "檢查 3D 主管" }));
  await screen.findByText("連線已驗證");
  expect(preloader).toHaveBeenCalledOnce();
  expect(preloader).toHaveBeenLastCalledWith(enabledPresenter.presenterUrl);

  const rejected = vi.fn().mockRejectedValue(new Error("載入失敗"));
  rerender(<PrejoinLobby meeting={meeting} scenario={defaultScenario} media={fakeMedia()} voice={fakeVoice()} presenterConfig={enabledPresenter} presenterPreloader={rejected} onJoin={vi.fn()} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "檢查 3D 主管" }));
  expect(await screen.findByText("3D 主管連線暫時無法驗證")).toBeVisible();

  rerender(<PrejoinLobby meeting={meeting} scenario={defaultScenario} media={fakeMedia()} voice={fakeVoice()} presenterConfig={{ enabled: false, reason: "missing-key" }} onJoin={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.getByRole("button", { name: "檢查 3D 主管" })).toBeDisabled();
  expect(screen.getByText("尚未設定 3D 主管")).toBeVisible();
});
