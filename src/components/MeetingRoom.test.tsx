import { act, fireEvent, render, screen } from "@testing-library/react";
import { simulatedResponder } from "../domain/meeting";
import { defaultScenario } from "../domain/scenario";
import { MeetingRoom } from "./MeetingRoom";

test("shows the budget-freeze card when the test clock reaches three minutes", () => {
  render(<MeetingRoom scenario={defaultScenario} responder={simulatedResponder} />);

  fireEvent.click(screen.getByRole("button", { name: "跳到第 3 分鐘" }));

  expect(screen.getByText("本季預算已凍結")).toBeVisible();
});

test("keeps a timed event after the development fallback receives a reply", async () => {
  let resolveReply = (_reply: string) => {};
  const delayedResponder = {
    reply: () => new Promise<string>((resolve) => {
      resolveReply = resolve;
    }),
  };
  render(<MeetingRoom scenario={defaultScenario} responder={delayedResponder} />);

  fireEvent.change(screen.getByLabelText("開發用文字輸入"), {
    target: { value: "我想依成果討論調薪" },
  });
  fireEvent.click(screen.getByRole("button", { name: "送出" }));
  fireEvent.click(screen.getByRole("button", { name: "跳到第 3 分鐘" }));
  await act(async () => resolveReply("請說明具體成果。"));

  expect(screen.getByText("第 3 分鐘 · 已發生")).toBeVisible();
});
