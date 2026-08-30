import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
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
