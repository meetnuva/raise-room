import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
import { defaultScenario } from "../domain/scenario";
import { MeetingSidePanel, type MeetingPanelTab } from "./MeetingSidePanel";

const transcript = [
  { speaker: "user" as const, elapsedSeconds: 12, text: "我想依成果討論調薪" },
  { speaker: "manager" as const, elapsedSeconds: 20, text: "請說明具體成果。", managerSource: "simulated" as const },
];

test("keeps one active information tab and lets close return control to the stage", () => {
  const onClose = vi.fn();
  const onActiveTabChange = vi.fn<(tab: MeetingPanelTab) => void>();
  render(
    <MeetingSidePanel
      activeTab="transcript"
      onActiveTabChange={onActiveTabChange}
      transcript={transcript}
      events={defaultScenario.events}
      emittedEventIds={["opening-question"]}
      durationSeconds={1200}
      managerName={defaultScenario.manager.name}
      observationContent={<button type="button">本機視覺控制</button>}
      voiceContent={<p>本機語音控制</p>}
      deviceContent={<p>裝置狀態會依本次會議顯示</p>}
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
  expect(onActiveTabChange).toHaveBeenCalledWith("events");
  fireEvent.click(screen.getByRole("button", { name: "關閉資訊面板" }));
  expect(onClose).toHaveBeenCalledOnce();
});

test("renders only the owner-selected tab and closes through Escape", () => {
  const onClose = vi.fn();
  const baseProps = {
    transcript,
    events: defaultScenario.events,
    emittedEventIds: ["opening-question"],
    durationSeconds: 1200,
    managerName: defaultScenario.manager.name,
    observationContent: <button type="button">本機視覺控制</button>,
    voiceContent: <p>本機語音控制</p>,
    deviceContent: <p>鏡頭目前未開啟</p>,
    onClose,
    onActiveTabChange: vi.fn(),
  };
  const { rerender } = render(<MeetingSidePanel {...baseProps} activeTab="devices" />);
  expect(screen.getByRole("complementary", { name: "會議資訊" })).toHaveAttribute("data-motion", "entered");
  expect(screen.getByRole("tab", { name: "裝置" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("鏡頭目前未開啟")).toBeVisible();
  fireEvent.keyDown(screen.getByRole("complementary", { name: "會議資訊" }), { key: "Escape" });
  expect(onClose).toHaveBeenCalledOnce();

  rerender(<MeetingSidePanel {...baseProps} activeTab="events" />);
  expect(screen.getByText("2:00 · 已發生")).toBeVisible();
  expect(screen.getByText("18:00 · 待命")).toBeVisible();
});

test("uses the shared drawer motion token for panel and scrim transitions", () => {
  const styles = readFileSync("src/styles.css", "utf8");

  expect(styles).toMatch(/\.meeting-side-panel\s*\{[^}]*transition:\s*opacity\s+var\(--motion-dialog\),\s*transform\s+var\(--motion-dialog\);/s);
  expect(styles).toMatch(/\.meeting-panel-scrim\s*\{[^}]*transition:\s*opacity\s+var\(--motion-dialog\);/s);
});
