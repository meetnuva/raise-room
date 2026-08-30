import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { ComponentProps } from "react";
import { expect, test, vi } from "vitest";
import { MeetingControlBar } from "./MeetingControlBar";

function renderBar(overrides: Partial<ComponentProps<typeof MeetingControlBar>> = {}) {
  const props = {
    voiceStatus: "ready" as const,
    cameraActive: false,
    cameraRequesting: false,
    panelOpen: false,
    activePanelTab: "transcript" as const,
    onVoiceAction: vi.fn(),
    onCameraToggle: vi.fn(),
    onOpenPanel: vi.fn(),
    onFinish: vi.fn(),
    ...overrides,
  };
  render(<MeetingControlBar {...props} />);
  return props;
}

test("renders the six Meet controls in the required order with named SVG icons", () => {
  renderBar();

  const controls = screen.getByRole("toolbar", { name: "會議控制" }).querySelectorAll("button");
  expect([...controls].map((control) => control.getAttribute("aria-label"))).toEqual([
    "開始說話",
    "開啟我的鏡頭",
    "開啟逐字稿",
    "開啟壓力事件",
    "更多會議選項",
    "離開並查看報告",
  ]);
  expect([...controls].every((control) => control.querySelector("svg"))).toBe(true);
  expect(controls[0]).toHaveAttribute("aria-pressed", "false");
  expect(controls[1]).toHaveAttribute("aria-pressed", "false");
  expect(controls[5]).toHaveClass("icon-button--danger");
});

test("routes captions, events and every more-menu action to actual information content", () => {
  const props = renderBar();

  fireEvent.click(screen.getByRole("button", { name: "開啟逐字稿" }));
  expect(props.onOpenPanel).toHaveBeenLastCalledWith("transcript", expect.any(HTMLButtonElement));
  fireEvent.click(screen.getByRole("button", { name: "開啟壓力事件" }));
  expect(props.onOpenPanel).toHaveBeenLastCalledWith("events", expect.any(HTMLButtonElement));
  fireEvent.click(screen.getByRole("button", { name: "更多會議選項" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "語音與逐字稿" }));
  expect(props.onOpenPanel).toHaveBeenLastCalledWith("transcript", expect.any(HTMLButtonElement));
  fireEvent.click(screen.getByRole("button", { name: "更多會議選項" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "本機觀察" }));
  expect(props.onOpenPanel).toHaveBeenLastCalledWith("observations", expect.any(HTMLButtonElement));
  fireEvent.click(screen.getByRole("button", { name: "更多會議選項" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "裝置狀態" }));
  expect(props.onOpenPanel).toHaveBeenLastCalledWith("devices", expect.any(HTMLButtonElement));
  fireEvent.click(screen.getByRole("button", { name: "更多會議選項" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "會議資訊" }));
  expect(props.onOpenPanel).toHaveBeenLastCalledWith("transcript", expect.any(HTMLButtonElement));
});

test("keeps microphone and camera state controlled by its owner", () => {
  const props = renderBar({ voiceStatus: "recording", cameraActive: true });

  expect(screen.getByRole("button", { name: "停止並轉成文字" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "關閉我的鏡頭" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "停止並轉成文字" }));
  fireEvent.click(screen.getByRole("button", { name: "關閉我的鏡頭" }));
  expect(props.onVoiceAction).toHaveBeenCalledOnce();
  expect(props.onCameraToggle).toHaveBeenCalledOnce();
});

test("does not expose an inert voice action and marks camera off as danger", () => {
  renderBar({ voiceStatus: "denied", cameraActive: false });
  expect(screen.getByRole("button", { name: "開始說話" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "開啟我的鏡頭" })).toHaveClass("icon-button--danger");
});

test.each([
  ["loading-model", "本機語音模型載入中，完成後即可開始說話。"],
  ["requesting-microphone", "正在請求麥克風權限。"],
  ["transcribing", "正在本機轉錄。"],
  ["denied", "麥克風權限已拒絕，請改用文字輸入。"],
  ["unsupported", "此瀏覽器不支援本機語音，請改用文字輸入。"],
  ["error", "語音目前無法使用，請改用文字輸入。"],
] as const)("announces the truthful disabled voice reason for %s", (voiceStatus, reason) => {
  renderBar({ voiceStatus });

  expect(screen.getByRole("button", { name: "開始說話" })).toBeDisabled();
  expect(screen.getByText(reason)).toBeVisible();
});

test("reflects only the owner-selected information tab as pressed", () => {
  renderBar({ panelOpen: true, activePanelTab: "events" });

  expect(screen.getByRole("button", { name: "開啟逐字稿" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "開啟壓力事件" })).toHaveAttribute("aria-pressed", "true");
});

test("uses a box-sized fixed 56px control group that cannot wrap", () => {
  const styles = readFileSync("src/styles.css", "utf8");

  expect(styles).toMatch(/\.meeting-control-bar\s*\{[^}]*box-sizing:\s*border-box;[^}]*flex-wrap:\s*nowrap;[^}]*height:\s*56px;/s);
});
