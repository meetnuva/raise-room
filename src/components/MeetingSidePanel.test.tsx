import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { defaultScenario } from "../domain/scenario";
import { MeetingSidePanel } from "./MeetingSidePanel";

const transcript = [
  { speaker: "user" as const, elapsedSeconds: 12, text: "我想依成果討論調薪" },
  { speaker: "manager" as const, elapsedSeconds: 20, text: "請說明具體成果。", managerSource: "simulated" as const },
];

test("keeps one active information tab and lets close return control to the stage", () => {
  const onClose = vi.fn();
  render(
    <MeetingSidePanel
      transcript={transcript}
      events={defaultScenario.events}
      emittedEventIds={["opening-question"]}
      durationSeconds={1200}
      managerName={defaultScenario.manager.name}
      observationContent={<button type="button">本機視覺控制</button>}
      onClose={onClose}
    />,
  );

  expect(screen.getByRole("tab", { name: "逐字稿" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getAllByRole("tab", { selected: true })).toHaveLength(1);
  expect(screen.getByRole("tab", { name: "逐字稿" })).toHaveAttribute("aria-controls", "meeting-information-transcript-panel");
  expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "meeting-information-transcript-tab");
  expect(screen.getAllByText("我想依成果討論調薪")).toHaveLength(1);
  fireEvent.keyDown(screen.getByRole("tab", { name: "逐字稿" }), { key: "ArrowRight" });
  expect(screen.getByRole("tab", { name: "壓力事件" })).toHaveFocus();
  fireEvent.click(screen.getByRole("tab", { name: "壓力事件" }));
  expect(screen.getByRole("tab", { name: "壓力事件" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getAllByRole("tab", { selected: true })).toHaveLength(1);
  expect(screen.getByText("2:00 · 已發生")).toBeVisible();
  expect(screen.getByText("18:00 · 待命")).toBeVisible();
  fireEvent.click(screen.getByRole("tab", { name: "觀察" }));
  expect(screen.getByRole("button", { name: "本機視覺控制" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "關閉資訊面板" }));
  expect(onClose).toHaveBeenCalledOnce();
});
