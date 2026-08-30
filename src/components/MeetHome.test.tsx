import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
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
  const settings = screen.getByRole("button", { name: "設定" });
  expect(settings).toHaveAttribute("title", "設定");
  expect(settings.querySelector("svg")).not.toBeNull();
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  fireEvent.click(settings);
  expect(onOpenSettings).toHaveBeenCalledOnce();
});

test("uses one semantic schedule button and enters the lobby once", () => {
  const onEnterLobby = vi.fn();
  render(
    <MeetHome
      meeting={meeting20}
      now={now}
      onOpenSettings={vi.fn()}
      onEnterLobby={onEnterLobby}
    />,
  );

  for (const button of [screen.getByRole("button", { name: "會議" }), screen.getByRole("button", { name: "練習紀錄" })]) {
    expect(button.querySelector("svg")).not.toBeNull();
  }

  const card = screen.getByRole("button", { name: "進入與王主管的年度調薪 1:1準備室" });
  fireEvent.click(card);
  expect(onEnterLobby).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "提早進入準備室" })).toBeNull();
  expect(screen.getByText("提早進入準備室")).toBeVisible();
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
  fireEvent.click(screen.getByRole("button", { name: /進入.*準備室/ }));
  expect(onEnterLobby).toHaveBeenCalledOnce();
});

test("renders a compact numeric day while retaining the full date as its accessible name", () => {
  render(<MeetHome meeting={meeting20} now={now} onOpenSettings={vi.fn()} onEnterLobby={vi.fn()} />);

  const today = screen.getByRole("button", { name: "8月30日" });
  expect(today).toHaveAttribute("title", "8月30日");
  expect(today.querySelector("strong")).toHaveTextContent("30");
  expect(today.querySelector("strong")).not.toHaveTextContent("8月30日");
});

test("defines a wrapping details column and a compact visual CTA without adding another button", () => {
  const styles = readFileSync("src/styles.css", "utf8");

  expect(styles).toMatch(/\.meet-home-schedule-details\s*\{[^}]*display:\s*flex;[^}]*flex:\s*1\s+1\s+auto;[^}]*flex-direction:\s*column;[^}]*min-width:\s*0;[^}]*text-align:\s*left;/s);
  expect(styles).toMatch(/\.meet-home-enter\s*\{[^}]*display:\s*inline-flex;[^}]*padding:\s*\.5rem\s+\.75rem;[^}]*border-radius:\s*999px;[^}]*white-space:\s*nowrap;/s);
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
