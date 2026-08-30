import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { defaultScenario } from "../domain/scenario";
import { ScenarioSettingsPanel } from "./ScenarioSettingsPanel";

test("reads every scenario field from the controlled value and returns complete edits", () => {
  const onChange = vi.fn();
  const value = {
    ...defaultScenario,
    company: "示範公司",
    role: "策略主管",
    achievements: "完成跨部門計畫",
    reason: "依成果調整薪資",
    manager: {
      ...defaultScenario.manager,
      name: "林主管",
      hiddenStance: "先確認證據",
      customInstructions: "保持平靜",
    },
    events: defaultScenario.events.map((event, index) => ({
      ...event,
      label: `事件名稱 ${index + 1}`,
      instruction: `事件指令 ${index + 1}`,
    })),
  };

  render(<ScenarioSettingsPanel value={value} durationMinutes={20} onChange={onChange} />);

  expect(screen.getByLabelText("公司")).toHaveValue("示範公司");
  expect(screen.getByLabelText("職位")).toHaveValue("策略主管");
  expect(screen.getByLabelText("年資（月）")).toHaveValue(18);
  expect(screen.getByLabelText("現薪（月）")).toHaveValue(0);
  expect(screen.getByLabelText("期待月薪")).toHaveValue(0);
  expect(screen.getByLabelText("最低可接受結果（月）")).toHaveValue(0);
  expect(screen.getByLabelText("近期成果")).toHaveValue("完成跨部門計畫");
  expect(screen.getByLabelText("會議原因")).toHaveValue("依成果調整薪資");
  expect(screen.getByLabelText("主管姓名")).toHaveValue("林主管");
  expect(screen.getByLabelText("主管隱藏立場")).toHaveValue("先確認證據");
  expect(screen.getByLabelText("主管補充角色指令（像 system prompt）")).toHaveValue("保持平靜");
  expect(screen.getAllByRole("combobox")).toHaveLength(6);
  for (let index = 1; index <= 5; index += 1) {
    expect(screen.getByLabelText(`事件 ${index} 名稱`)).toHaveValue(`事件名稱 ${index}`);
    expect(screen.getByLabelText(`事件 ${index} 指令`)).toHaveValue(`事件指令 ${index}`);
  }
  expect(screen.getByText("事件 1：第 2 分鐘觸發")).toBeVisible();
  expect(screen.queryByLabelText(/分鐘$/)).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("主管姓名"), { target: { value: "鄭主管" } });

  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
    manager: expect.objectContaining({ name: "鄭主管" }),
  }));
});
