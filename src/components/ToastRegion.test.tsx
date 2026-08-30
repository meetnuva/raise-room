import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ToastRegion } from "./ToastRegion";

afterEach(() => vi.useRealTimers());

test("dismisses a four-second notice automatically", () => {
  vi.useFakeTimers();
  const onDismiss = vi.fn();
  render(<ToastRegion toasts={[{ id: "engine", tone: "notice", message: "主管引擎：本機腳本 fallback", durationMs: 4000, onDismiss }]} />);

  expect(screen.getByRole("status")).toHaveTextContent("主管引擎：本機腳本 fallback");
  act(() => vi.advanceTimersByTime(4000));
  expect(onDismiss).toHaveBeenCalledWith("engine");
});

test("allows a notice to be manually closed", () => {
  const onDismiss = vi.fn();
  render(<ToastRegion toasts={[{ id: "notice", tone: "notice", message: "主管已更新立場", durationMs: 4000, onDismiss }]} />);

  fireEvent.click(screen.getByRole("button", { name: "關閉通知：主管已更新立場" }));
  expect(onDismiss).toHaveBeenCalledWith("notice");
});

test("keeps errors as dismissible persistent alerts", () => {
  vi.useFakeTimers();
  const onDismiss = vi.fn();
  render(<ToastRegion toasts={[{ id: "error", tone: "error", message: "主管回覆暫時無法取得", onDismiss }]} />);

  act(() => vi.advanceTimersByTime(10_000));
  expect(onDismiss).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("主管回覆暫時無法取得");
  fireEvent.click(screen.getByRole("button", { name: "關閉通知：主管回覆暫時無法取得" }));
  expect(onDismiss).toHaveBeenCalledWith("error");
});
