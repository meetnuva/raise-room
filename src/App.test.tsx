import { render, screen } from "@testing-library/react";
import { App } from "./App";

test("renders Raise Room's local-first setup entry point", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Raise Room" })).toBeVisible();
  expect(screen.getByText("你的練習資料預設只留在這台裝置。")).toBeVisible();
});
