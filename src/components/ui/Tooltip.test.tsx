import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, test, vi } from "vitest";
import { Tooltip } from "./Tooltip";

afterEach(() => vi.useRealTimers());

test("opens only after the default 500ms hover delay", () => {
  vi.useFakeTimers();
  render(<Tooltip content="設定說明"><button type="button">設定</button></Tooltip>);

  const trigger = screen.getByRole("button", { name: "設定" });
  fireEvent.mouseEnter(trigger);
  act(() => vi.advanceTimersByTime(499));
  expect(screen.queryByRole("tooltip")).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("tooltip")).toHaveTextContent("設定說明");
});

test("opens from focus and clears its scheduled timer when unmounted", () => {
  vi.useFakeTimers();
  const clearTimeout = vi.spyOn(window, "clearTimeout");
  const { unmount } = render(<Tooltip content="設定說明"><button type="button">設定</button></Tooltip>);

  const trigger = screen.getByRole("button", { name: "設定" });
  fireEvent.focus(trigger);
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByRole("tooltip")).toBeVisible();

  fireEvent.blur(trigger);
  fireEvent.mouseEnter(trigger);
  unmount();
  expect(clearTimeout).toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(500));
});
