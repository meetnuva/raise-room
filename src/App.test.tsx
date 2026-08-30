import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "./App";

const appMocks = vi.hoisted(() => ({ practiceSession: vi.fn() }));

vi.mock("./components/PracticeSession", () => ({
  PracticeSession: ({ children }: { children: (runtime: { media: object; voice: object }) => React.ReactNode }) => {
    appMocks.practiceSession();
    return <>{children({ media: {}, voice: {} })}</>;
  },
}));
vi.mock("./components/MeetingRoom", () => ({
  MeetingRoom: ({ onFinish }: { onFinish: (transcript: []) => void }) => (
    <section aria-labelledby="meeting-room-title">
      <h2 id="meeting-room-title" tabIndex={-1}>薪資檢討 Raise Room</h2>
      <button type="button" onClick={() => onFinish([])}>結束並看報告</button>
    </section>
  ),
}));

function openSettings() {
  fireEvent.click(screen.getByRole("button", { name: "設定" }));
  return screen.getByRole("dialog");
}

function enterLobby() {
  fireEvent.click(screen.getByRole("button", { name: "提早進入準備室" }));
}

function joinMeeting() {
  fireEvent.click(screen.getByRole("button", { name: "立即進入會議室" }));
}

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  appMocks.practiceSession.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("creates the strict next meeting from the document-load clock", () => {
  render(<App now={() => new Date(2026, 7, 30, 17, 5)} />);
  expect(screen.getByRole("heading", { name: "Raise Room" })).toBeVisible();
  expect(screen.getByText("18:00–18:20")).toBeVisible();
  expect(screen.queryByRole("heading", { name: "設定這場薪資檢討" })).toBeNull();
});

test("saves five minutes without moving the start hour", () => {
  render(<App now={() => new Date(2026, 7, 30, 17, 5)} />);
  openSettings();
  fireEvent.click(screen.getByRole("tab", { name: "會議" }));
  fireEvent.click(screen.getByRole("radio", { name: "5 分鐘" }));
  fireEvent.click(screen.getByRole("button", { name: "儲存" }));
  expect(screen.getByText("18:00–18:05")).toBeVisible();
  expect(screen.getByRole("button", { name: "設定" })).toHaveFocus();
});

test("navigates home to lobby to meeting, retries through lobby, and resets home", () => {
  render(<App now={() => new Date(2026, 7, 30, 17, 5)} />);
  enterLobby();
  expect(screen.getByRole("heading", { name: "確認你的裝置" })).toBeVisible();
  joinMeeting();
  expect(screen.getByRole("heading", { name: "薪資檢討 Raise Room" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "結束並看報告" }));
  expect(screen.getByRole("heading", { name: "會後教練報告" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "再練一次" }));
  expect(screen.getByRole("heading", { name: "確認你的裝置" })).toBeVisible();
  joinMeeting();
  fireEvent.click(screen.getByRole("button", { name: "結束並看報告" }));
  fireEvent.click(screen.getByRole("button", { name: "重新設定情境" }));
  expect(screen.getByRole("heading", { name: "Raise Room" })).toBeVisible();
});

test("keeps settings edits local on cancel and returns focus to settings", () => {
  window.localStorage.setItem("raise-room-meeting-settings-v1", JSON.stringify({ durationMinutes: 20, managerPresentation: "male" }));
  render(<App now={() => new Date(2026, 7, 30, 17, 5)} />);
  openSettings();
  fireEvent.click(screen.getByRole("tab", { name: "會議" }));
  fireEvent.click(screen.getByRole("radio", { name: "5 分鐘" }));
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(window.localStorage.getItem("raise-room-meeting-settings-v1")).toBe(JSON.stringify({ durationMinutes: 20, managerPresentation: "male" }));
  expect(screen.getByRole("button", { name: "設定" })).toHaveFocus();
  expect(screen.getByText("18:00–18:20")).toBeVisible();
});

test("reads persisted boundaries once and starts no practice resource on the home page", () => {
  const getItem = vi.spyOn(Storage.prototype, "getItem");
  const { rerender } = render(<App now={() => new Date(2026, 7, 30, 17, 5)} />);
  rerender(<App now={() => new Date(2026, 7, 30, 17, 6)} />);
  expect(getItem.mock.calls.map(([key]) => key)).toEqual([
    "raise-room-scenario-draft",
    "raise-room-meeting-settings-v1",
    "raise-room-voice-settings-v1",
  ]);
  expect(appMocks.practiceSession).not.toHaveBeenCalled();
});

test("saves exactly scenario, practice, and voice boundaries", () => {
  render(<App now={() => new Date(2026, 7, 30, 17, 5)} />);
  openSettings();
  fireEvent.click(screen.getByRole("tab", { name: "會議" }));
  fireEvent.click(screen.getByRole("radio", { name: "5 分鐘" }));
  fireEvent.click(screen.getByRole("button", { name: "儲存" }));
  expect(window.localStorage.getItem("raise-room-scenario-draft")).not.toBeNull();
  expect(window.localStorage.getItem("raise-room-meeting-settings-v1")).toBe(JSON.stringify({ durationMinutes: 5, managerPresentation: "male" }));
  expect(window.localStorage.getItem("raise-room-voice-settings-v1")).not.toBeNull();
});

test("clear confirmation removes only practice storage and returns home defaults", () => {
  window.localStorage.setItem("raise-room-scenario-draft", "scenario");
  window.localStorage.setItem("raise-room-meeting-settings-v1", "practice");
  window.localStorage.setItem("raise-room-voice-settings-v1", "voice");
  window.localStorage.setItem("credentials", "keep");
  render(<App now={() => new Date(2026, 7, 30, 17, 5)} />);
  openSettings();
  fireEvent.click(screen.getByRole("tab", { name: "隱私" }));
  fireEvent.click(screen.getByRole("button", { name: "清除本機設定與草稿" }));
  fireEvent.click(screen.getByRole("button", { name: "確認清除" }));
  expect(window.localStorage.getItem("raise-room-scenario-draft")).toBeNull();
  expect(window.localStorage.getItem("raise-room-meeting-settings-v1")).toBeNull();
  expect(window.localStorage.getItem("raise-room-voice-settings-v1")).toBeNull();
  expect(window.localStorage.getItem("credentials")).toBe("keep");
  expect(screen.getByText("18:00–18:20")).toBeVisible();
  expect(screen.getByRole("button", { name: "設定" })).toHaveFocus();
});

test("auto-rolls an expired schedule only while home is active", () => {
  vi.useFakeTimers();
  let current = new Date(2026, 7, 30, 17, 5);
  render(<App now={() => current} />);
  current = new Date(2026, 7, 30, 18, 20);
  act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getByText("19:00–19:20")).toBeVisible();
  enterLobby();
  current = new Date(2026, 7, 30, 19, 20);
  act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getByRole("heading", { name: "確認你的裝置" })).toBeVisible();
  expect(screen.queryByText("20:00–20:20")).toBeNull();
});

test("updates the home schedule status before rolling an expired meeting", () => {
  vi.useFakeTimers();
  let current = new Date(2026, 7, 30, 17, 5);
  render(<App now={() => current} />);

  expect(screen.getByText("即將開始")).toBeVisible();
  current = new Date(2026, 7, 30, 18, 0);
  act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getByText("進行中")).toBeVisible();
  expect(screen.getByText("18:00–18:20")).toBeVisible();

  current = new Date(2026, 7, 30, 18, 20);
  act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getByText("19:00–19:20")).toBeVisible();
  expect(screen.getByText("即將開始")).toBeVisible();
});
