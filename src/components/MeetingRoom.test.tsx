import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
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

test("hands the append-only transcript to onFinish", async () => {
  const onFinish = vi.fn();
  render(
    <MeetingRoom
      scenario={defaultScenario}
      responder={simulatedResponder}
      onFinish={onFinish}
    />,
  );

  fireEvent.change(screen.getByLabelText("開發用文字輸入"), {
    target: { value: "我想依成果討論調薪" },
  });
  fireEvent.click(screen.getByRole("button", { name: "送出" }));
  await screen.findByText("王主管：請以具體成果說明這次薪資調整請求。");
  fireEvent.click(screen.getByRole("button", { name: "結束並看報告" }));

  expect(onFinish).toHaveBeenCalledWith([
    { speaker: "user", text: "我想依成果討論調薪", elapsedSeconds: 0 },
    {
      speaker: "manager",
      text: "王主管：請以具體成果說明這次薪資調整請求。",
      elapsedSeconds: 0,
    },
  ]);
});
