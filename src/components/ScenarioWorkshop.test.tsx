import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { defaultScenario } from "../domain/scenario";
import { ScenarioWorkshop } from "./ScenarioWorkshop";

test("starts a meeting with the configured manager and request", () => {
  const onStart = vi.fn();

  render(<ScenarioWorkshop onStart={onStart} />);

  fireEvent.change(screen.getByLabelText("主管姓名"), {
    target: { value: "陳經理" },
  });
  fireEvent.change(screen.getByLabelText("期待月薪"), {
    target: { value: "85000" },
  });
  fireEvent.click(screen.getByRole("button", { name: "進入會議大廳" }));

  expect(onStart).toHaveBeenCalledWith(
    expect.objectContaining({
      manager: expect.objectContaining({ name: "陳經理" }),
      compensation: expect.objectContaining({ requestedMonthlySalary: 85000 }),
    }),
  );
});

test("shows the local-only setup label in Traditional Chinese", () => {
  render(<ScenarioWorkshop onStart={vi.fn()} />);

  expect(screen.getByText("僅限本機設定")).toBeInTheDocument();
  expect(screen.queryByText("Local-only setup")).not.toBeInTheDocument();
});

test("clears the locally stored draft", () => {
  localStorage.setItem("raise-room-scenario-draft", "saved");

  render(<ScenarioWorkshop onStart={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "清除本機草稿" }));

  expect(localStorage.getItem("raise-room-scenario-draft")).toBeNull();
});

test("migrates an older local draft without custom manager instructions", () => {
  const { customInstructions: _removed, ...legacyManager } = defaultScenario.manager;
  localStorage.setItem(
    "raise-room-scenario-draft",
    JSON.stringify({ ...defaultScenario, manager: legacyManager }),
  );

  render(<ScenarioWorkshop onStart={vi.fn()} />);

  expect(screen.getByLabelText("主管補充角色指令（像 system prompt）")).toHaveValue(
    "保持主管角色，只回主管會說的話，不提供教練建議。",
  );
});

test("saves the manager instruction from the scenario workshop", () => {
  render(<ScenarioWorkshop onStart={vi.fn()} />);

  fireEvent.change(screen.getByLabelText("主管補充角色指令（像 system prompt）"), {
    target: { value: "對成果數字追問到底。" },
  });

  expect(JSON.parse(localStorage.getItem("raise-room-scenario-draft") ?? "{}")).toMatchObject({
    manager: { customInstructions: "對成果數字追問到底。" },
  });
});
