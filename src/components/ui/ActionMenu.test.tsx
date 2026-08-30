import { fireEvent, render, screen } from "@testing-library/react";
import { test, vi } from "vitest";
import { ActionMenu, type ActionMenuItem } from "./ActionMenu";

function renderMenu() {
  const onDevices = vi.fn();
  const items: ActionMenuItem[] = [
    { id: "devices", label: "檢查裝置", icon: "devices", onSelect: onDevices },
    { id: "privacy", label: "查看本機資料與隱私", icon: "info", onSelect: vi.fn() },
  ];
  render(<ActionMenu label="更多選項" items={items} />);
  return { onDevices };
}

test("uses roving arrow focus and selects the active action", () => {
  const { onDevices } = renderMenu();
  const trigger = screen.getByRole("button", { name: "更多選項" });
  fireEvent.click(trigger);

  const first = screen.getByRole("menuitem", { name: "檢查裝置" });
  expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: "ArrowDown" });
  expect(screen.getByRole("menuitem", { name: "查看本機資料與隱私" })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "查看本機資料與隱私" }), { key: "ArrowUp" });
  fireEvent.keyDown(first, { key: "Enter" });

  expect(onDevices).toHaveBeenCalledOnce();
  expect(screen.queryByRole("menu")).toBeNull();
  expect(trigger).toHaveFocus();
});

test("closes on Escape and outside clicks, then returns focus to its trigger", () => {
  renderMenu();
  const trigger = screen.getByRole("button", { name: "更多選項" });
  fireEvent.click(trigger);
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "檢查裝置" }), { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(trigger).toHaveFocus();

  fireEvent.click(trigger);
  fireEvent.mouseDown(document.body);
  expect(screen.queryByRole("menu")).toBeNull();
  expect(trigger).toHaveFocus();
});
