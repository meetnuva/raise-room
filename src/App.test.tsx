import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "./App";

test("renders Raise Room's local-first setup entry point", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Raise Room" })).toBeVisible();
  expect(screen.getByText("你的練習資料預設只留在這台裝置。")).toBeVisible();
  expect(screen.getByText("視覺教練功能尚未啟用")).toBeVisible();
});

test("preserves the scenario through the report retry flow and can return to setup", async () => {
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: "進入會議大廳" }));
  fireEvent.change(screen.getByLabelText("開發用文字輸入"), {
    target: { value: "我期待調整 5%。" },
  });
  fireEvent.click(screen.getByRole("button", { name: "送出" }));
  await screen.findByText("王主管：請以具體成果說明這次薪資調整請求。");
  fireEvent.click(screen.getByRole("button", { name: "結束並看報告" }));

  expect(screen.getByRole("heading", { name: "會後教練報告" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "再練一次" }));
  expect(screen.getByRole("heading", { name: "薪資檢討 Raise Room" })).toBeVisible();
  expect(screen.getByText("nuva · 18 個月年資")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "結束並看報告" }));
  fireEvent.click(screen.getByRole("button", { name: "重新設定情境" }));
  expect(screen.getByRole("heading", { name: "設定這場薪資檢討" })).toBeVisible();
});
