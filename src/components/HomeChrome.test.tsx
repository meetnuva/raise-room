import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { vi } from "vitest";
import { HomeChrome } from "./HomeChrome";

test("opens help, about, and local privacy content while routing every settings action", () => {
  const onOpenSettings = vi.fn();
  render(<HomeChrome onOpenSettings={onOpenSettings} />);

  const help = screen.getByRole("button", { name: "說明" });
  fireEvent.click(help);
  expect(screen.getByRole("heading", { name: "Raise Room 使用說明" })).toBeVisible();
  fireEvent.keyDown(help, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Raise Room 使用說明" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "設定" }));
  expect(onOpenSettings).toHaveBeenLastCalledWith();

  fireEvent.click(screen.getByRole("button", { name: "更多選項" }));
  expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
    "檢查裝置",
    "查看本機資料與隱私",
    "關於 Raise Room",
  ]);
  fireEvent.click(screen.getByRole("menuitem", { name: "檢查裝置" }));
  expect(onOpenSettings).toHaveBeenLastCalledWith("audio");

  fireEvent.click(screen.getByRole("button", { name: "更多選項" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "查看本機資料與隱私" }));
  expect(onOpenSettings).toHaveBeenLastCalledWith("privacy");

  fireEvent.click(screen.getByRole("button", { name: "更多選項" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "關於 Raise Room" }));
  expect(screen.getByRole("heading", { name: "關於 Raise Room" })).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "本機使用者" }));
  expect(screen.getByText("資料只存在這台裝置")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "隱私設定" }));
  expect(onOpenSettings).toHaveBeenLastCalledWith("privacy");
});

test("closes the local user popover before opening privacy settings", () => {
  const onOpenSettings = vi.fn();
  render(<HomeChrome onOpenSettings={onOpenSettings} />);

  fireEvent.click(screen.getByRole("button", { name: "本機使用者" }));
  fireEvent.click(screen.getByRole("button", { name: "隱私設定" }));

  expect(screen.queryByRole("dialog", { name: "本機使用者" })).toBeNull();
  expect(onOpenSettings).toHaveBeenCalledWith("privacy");
});

test("uses the shared focus token for home controls", () => {
  const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

  expect(styles).toMatch(/\.meet-home button:focus-visible\s*\{\s*outline: 3px solid var\(--focus-light\);/);
  expect(styles).not.toMatch(/\.meet-home button:focus-visible\s*\{[^}]*#7dd3fc/);
});
