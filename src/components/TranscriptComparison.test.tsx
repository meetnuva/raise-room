import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { TranscriptComparison } from "./TranscriptComparison";

test("shows normalized results, integer text match and accessible character differences", () => {
  render(
    <TranscriptComparison
      reference="客戶投訴下降百分之三十"
      actual="客户投诉下降百分之三十"
      language="zh"
    />,
  );
  expect(screen.getByText("文字吻合度：100%")).toBeVisible();
  expect(screen.getByText("辨識句：客戶投訴下降百分之三十")).toBeVisible();
  expect(screen.getByText("參考句與辨識句一致")).toBeVisible();
});

test("asks for reference text instead of creating a misleading score", () => {
  render(<TranscriptComparison reference="" actual="任何文字" language="zh" />);
  expect(screen.getByText("請先輸入參考句")).toBeVisible();
  expect(screen.queryByText(/文字吻合度：/)).toBeNull();
});
