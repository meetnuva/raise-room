import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
import type { PresenterClient } from "../lib/perxona-presenter";
import { PerxonaManagerStage } from "./PerxonaManagerStage";

test("shows the pinned state and exposes real manager tile actions", () => {
  const onTogglePin = vi.fn();
  const onViewRole = vi.fn();
  const onOpenInfo = vi.fn();
  render(<PerxonaManagerStage managerName="王主管" config={{ enabled: false, reason: "missing-key" }} latestManagerText={null} pinned onTogglePin={onTogglePin} onViewRole={onViewRole} onOpenInfo={onOpenInfo} />);

  expect(screen.getByText("已釘選")).toBeVisible();
  expect(screen.getAllByTestId("ui-icon")[0]).toBeVisible();
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
test("opens the manager participant menu from the tile surface", async () => {
  render(<PerxonaManagerStage managerName="王主管" config={{ enabled: false, reason: "missing-key" }} latestManagerText={null} />);
  fireEvent.click(screen.getByLabelText("Perxona 3D 主管舞台"));
  expect(await screen.findByRole("menu")).toBeVisible();
});

test("uses compact stage overlays for presenter actions and status without blocking the canvas", () => {
  const styles = readFileSync("src/styles.css", "utf8");

  expect(styles).toMatch(/\.manager-stage-status\s*\{[^}]*position:\s*absolute;[^}]*z-index:\s*5;[^}]*pointer-events:\s*none;/s);
  expect(styles).toMatch(/\.manager-stage\s*>\s*button\.manager-stage-action\s*\{[^}]*position:\s*absolute;[^}]*z-index:\s*5;[^}]*width:\s*auto;[^}]*align-self:\s*auto;/s);
  expect(styles).toMatch(/\.manager-stage \.presenter-canvas\s*\{[^}]*pointer-events:\s*auto;/s);
});

test("anchors Presenter actions away from the bottom-right self tile", () => {
  const styles = readFileSync("src/styles.css", "utf8");
  const sharedStageStyles = styles.slice(styles.indexOf("/* Task 6:"), styles.lastIndexOf("@media (max-width: 767px)"));
  const actionRule = sharedStageStyles.match(/\.manager-stage\s*>\s*button\.manager-stage-action\s*\{([^}]*)\}/)?.[1];

  expect(actionRule).toMatch(/left:\s*50%;/);
  expect(actionRule).toMatch(/transform:\s*translateX\(-50%\);/);
  expect(actionRule).not.toMatch(/right:/);
});

test("uses a mobile bottom-left Presenter action anchor clear of the self tile", () => {
  const styles = readFileSync("src/styles.css", "utf8");

  expect(styles).toMatch(/@media \(max-width: 767px\)\s*\{[\s\S]*?\.manager-stage\s*>\s*button\.manager-stage-action\s*\{[^}]*left:\s*\.5rem;[^}]*bottom:\s*\.5rem;[^}]*transform:\s*none;/s);
  expect(styles).toMatch(/@media \(max-width: 767px\)\s*\{[\s\S]*?\.manager-stage-status\s*\{[^}]*bottom:\s*3\.5rem;/s);
});

test("places the final mobile Presenter override after shared stage rules", () => {
  const styles = readFileSync("src/styles.css", "utf8");
  const finalMobileStyles = styles.slice(styles.lastIndexOf("@media (max-width: 767px)"));

  expect(finalMobileStyles).toMatch(/\.manager-stage\s*>\s*button\.manager-stage-action\s*\{[^}]*left:\s*\.5rem;[^}]*transform:\s*none;/s);
});

test("keeps the desktop compact manager status above its Presenter action", () => {
  const styles = readFileSync("src/styles.css", "utf8");

  expect(styles).toMatch(/@media \(min-width: 768px\)\s*\{[^}]*\.stage-focus-self \.manager-stage \.manager-stage-status\s*\{[^}]*bottom:\s*5\.5rem;/s);
});
