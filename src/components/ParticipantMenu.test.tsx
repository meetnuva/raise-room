import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ParticipantMenu } from "./ParticipantMenu";

test("manager menu offers only pin, role, and meeting information actions", () => {
  const onTogglePin = vi.fn();
  const onViewRole = vi.fn();
  const onOpenInfo = vi.fn();
  render(<ParticipantMenu kind="manager" pinned={false} expanded={false} onTogglePin={onTogglePin} onViewRole={onViewRole} onOpenInfo={onOpenInfo} />);

  fireEvent.click(screen.getByRole("button", { name: "主管更多操作" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "釘選主管" }));
  expect(onTogglePin).toHaveBeenCalledOnce();

  fireEvent.click(screen.getByRole("button", { name: "主管更多操作" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "查看主管角色" }));
  expect(onViewRole).toHaveBeenCalledOnce();
  expect(screen.queryByRole("menuitem", { name: /靜音|移除|共同主持/ })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "主管更多操作" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "開啟會議資訊" }));
  expect(onOpenInfo).toHaveBeenCalledOnce();
});

test("self menu toggles expansion and pin, then opens device settings", () => {
  const onTogglePin = vi.fn();
  const onToggleExpand = vi.fn();
  const onOpenDevices = vi.fn();
  render(<ParticipantMenu kind="self" pinned={false} expanded={false} onTogglePin={onTogglePin} onToggleExpand={onToggleExpand} onOpenDevices={onOpenDevices} />);

  fireEvent.click(screen.getByRole("button", { name: "你的更多操作" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "放大自己" }));
  expect(onToggleExpand).toHaveBeenCalledOnce();

  fireEvent.click(screen.getByRole("button", { name: "你的更多操作" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "釘選自己" }));
  expect(onTogglePin).toHaveBeenCalledOnce();

  fireEvent.click(screen.getByRole("button", { name: "你的更多操作" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "開啟裝置設定" }));
  expect(onOpenDevices).toHaveBeenCalledOnce();
});
