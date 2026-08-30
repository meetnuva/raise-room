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
  const second = screen.getByRole("menuitem", { name: "查看本機資料與隱私" });
  expect(first).toHaveFocus();
  expect(first).toHaveAttribute("tabindex", "0");
  expect(second).toHaveAttribute("tabindex", "-1");
  expect(screen.getAllByRole("menuitem").filter((item) => item.getAttribute("tabindex") === "0")).toHaveLength(1);
  fireEvent.keyDown(first, { key: "ArrowDown" });
  expect(second).toHaveFocus();
  expect(first).toHaveAttribute("tabindex", "-1");
  expect(second).toHaveAttribute("tabindex", "0");
  expect(screen.getAllByRole("menuitem").filter((item) => item.getAttribute("tabindex") === "0")).toHaveLength(1);
  fireEvent.keyDown(second, { key: "ArrowUp" });
  fireEvent.keyDown(first, { key: "Enter" });

  expect(onDevices).toHaveBeenCalledOnce();
  expect(screen.queryByRole("menu")).toBeNull();
  expect(trigger).toHaveFocus();
});

const nonActionMenus: Array<[string, ActionMenuItem[]]> = [
  ["empty", []],
  ["all-disabled", [{ id: "unavailable", label: "尚未提供", icon: "warning", disabled: true, disabledReason: "目前沒有可用操作", onSelect: vi.fn() }]],
];

test.each(nonActionMenus)("keeps a %s menu dismissable with Escape and returns focus", (_kind, items) => {
  render(<ActionMenu label="更多選項" items={items} />);
  const trigger = screen.getByRole("button", { name: "更多選項" });
  fireEvent.click(trigger);

  const menu = screen.getByRole("menu");
  expect(menu).toHaveFocus();
  fireEvent.keyDown(menu, { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(trigger).toHaveFocus();
});

test("exposes a disabled action reason to assistive technology", () => {
  const items: ActionMenuItem[] = [
    { id: "unavailable", label: "尚未提供", icon: "warning", disabled: true, disabledReason: "目前沒有可用操作", onSelect: vi.fn() },
  ];
  render(<ActionMenu label="更多選項" items={items} />);
  fireEvent.click(screen.getByRole("button", { name: "更多選項" }));

  const disabledItem = screen.getByRole("menuitem", { name: "尚未提供" });
  const descriptionId = disabledItem.getAttribute("aria-describedby");
  expect(descriptionId).not.toBeNull();
  expect(document.getElementById(descriptionId!)).toHaveTextContent("目前沒有可用操作");
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

test("stops Escape after dismissing the menu so an enclosing drawer remains open", () => {
  const onContainerKeyDown = vi.fn();
  render(<div onKeyDown={onContainerKeyDown}><ActionMenu label="更多選項" items={[]} /></div>);
  fireEvent.click(screen.getByRole("button", { name: "更多選項" }));

  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(onContainerKeyDown).not.toHaveBeenCalled();
});
