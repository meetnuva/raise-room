import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { ScheduledPracticeMeeting } from "../domain/practice-schedule";
import { MeetHome } from "./MeetHome";

const now = new Date(2026, 7, 30, 17, 5);
const meeting20: ScheduledPracticeMeeting = {
  id: "practice-2026-08-30T10:00:00.000Z-20",
  title: "與王主管的年度調薪 1:1",
  managerName: "王主管",
  company: "nuva",
  role: "產品營運專員",
  startsAt: new Date(2026, 7, 30, 18, 0).toISOString(),
  endsAt: new Date(2026, 7, 30, 18, 20).toISOString(),
  durationMinutes: 20,
};

test("uses the blue nuva brand and opens settings", () => {
  const onOpenSettings = vi.fn();
  render(
    <MeetHome
      meeting={meeting20}
      now={now}
      onOpenSettings={onOpenSettings}
      onEnterLobby={vi.fn()}
    />,
  );

  expect(screen.getByRole("img", { name: "nuva" })).toHaveAttribute(
    "src",
    "/brand/blue-nuva-logo.png",
  );
  fireEvent.click(screen.getByRole("button", { name: "設定" }));
  expect(onOpenSettings).toHaveBeenCalledOnce();
});

test("shows the schedule and permits early entry", () => {
  const onEnterLobby = vi.fn();
  render(
    <MeetHome
      meeting={meeting20}
      now={now}
      onOpenSettings={vi.fn()}
      onEnterLobby={onEnterLobby}
    />,
  );

  expect(screen.getByText("18:00–18:20")).toBeVisible();
  expect(screen.getByText("與王主管的年度調薪 1:1")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "提早進入準備室" }));
  expect(onEnterLobby).toHaveBeenCalledOnce();
});

test("shows an empty state for a future date and restores today schedule", () => {
  render(
    <MeetHome
      meeting={meeting20}
      now={now}
      onOpenSettings={vi.fn()}
      onEnterLobby={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /8月31日$/ }));
  expect(screen.getByText("這一天沒有安排練習")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: /8月30日$/ }));
  expect(screen.getByText("與王主管的年度調薪 1:1")).toBeVisible();
  expect(screen.getByRole("button", { name: /8月30日$/ })).toHaveAttribute("aria-current", "date");
});

test("switches between schedule and the empty practice history", () => {
  render(
    <MeetHome
      meeting={meeting20}
      now={now}
      onOpenSettings={vi.fn()}
      onEnterLobby={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "練習紀錄" }));
  expect(screen.getByText("尚無練習紀錄")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "會議" }));
  expect(screen.getByText("與王主管的年度調薪 1:1")).toBeVisible();
});
