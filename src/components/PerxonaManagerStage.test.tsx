import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { PresenterClient } from "../lib/perxona-presenter";
import { PerxonaManagerStage } from "./PerxonaManagerStage";

test("shows the pinned state and exposes real manager tile actions", () => {
  const onTogglePin = vi.fn();
  const onViewRole = vi.fn();
  const onOpenInfo = vi.fn();
  render(<PerxonaManagerStage managerName="王主管" config={{ enabled: false, reason: "missing-key" }} latestManagerText={null} pinned onTogglePin={onTogglePin} onViewRole={onViewRole} onOpenInfo={onOpenInfo} />);

  expect(screen.getByText("主管畫面 · 已釘選")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "主管更多操作" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "取消釘選主管" }));
  expect(onTogglePin).toHaveBeenCalledOnce();
});

test("keeps a visible deterministic fallback when Perxona is not configured", () => {
  render(<PerxonaManagerStage managerName="王主管" config={{ enabled: false, reason: "missing-key" }} latestManagerText={null} />);
  expect(screen.getByRole("status")).toHaveTextContent("尚未設定 Perxona");
  expect(screen.getByText("王主管")).toBeVisible();
});

test("only speaks each ready manager reply once with an injected client", async () => {
  let emit: ((event: "ready" | "key-rejected") => void) | undefined;
  const speak = vi.fn().mockResolvedValue(undefined);
  const client = { mount: vi.fn().mockResolvedValue(undefined), subscribe: vi.fn((listener) => { emit = listener; return vi.fn(); }), resumeAudio: vi.fn().mockResolvedValue(undefined), initialize: vi.fn().mockImplementation(async () => emit?.("ready")), speak, interrupt: vi.fn(), destroy: vi.fn() } as unknown as PresenterClient;
  const config = { enabled: true as const, publishableKey: "key", presenterUrl: "https://cdn.perxona.ai/asia/prod/latest/widget/entry/presenter.js", target: { avatarId: "avatar", sceneId: "scene", voiceId: "voice" } };
  render(<PerxonaManagerStage managerName="王主管" config={config} latestManagerText="請說明具體成果。" clientFactory={() => client} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "啟動 3D 主管" })).toBeVisible());
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "啟動 3D 主管" })); });
  await waitFor(() => expect(speak).toHaveBeenCalledWith("請說明具體成果。"));
  expect(speak).toHaveBeenCalledOnce();
});
