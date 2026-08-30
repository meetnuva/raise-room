import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, test, vi } from "vitest";
import { IconButton } from "./IconButton";

afterEach(() => vi.useRealTimers());

test("exposes selected state through aria-pressed", () => {
  render(<IconButton icon="microphone" label="麥克風" selected />);

  expect(screen.getByRole("button", { name: "麥克風" })).toHaveAttribute("aria-pressed", "true");
});

test("uses its tooltip delay override", () => {
  vi.useFakeTimers();
  render(<IconButton icon="settings" label="設定" tooltipDelayMs={100} />);

  fireEvent.mouseEnter(screen.getByRole("button", { name: "設定" }));
  act(() => vi.advanceTimersByTime(99));
  expect(screen.queryByRole("tooltip")).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("tooltip")).toHaveTextContent("設定");
});
