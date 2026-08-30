import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { VisualSignals } from "../domain/visual";
import type { useLocalVision } from "../hooks/use-local-vision";
import { LocalVisualControl } from "./LocalVisualControl";

function vision(overrides: Partial<ReturnType<typeof useLocalVision>> = {}) {
  const signals: VisualSignals = {
    sampleCount: 0,
    faceVisibleRatio: null,
    centeredRatio: null,
    stableDistanceRatio: null,
    cameraDirectionEstimateRatio: null,
  };
  return {
    status: "idle",
    progress: null,
    lastObservation: null,
    signals,
    errorMessage: null,
    loadModel: vi.fn(),
    startObserving: vi.fn(),
    stopObserving: vi.fn(),
    resetSignals: vi.fn(),
    getSignals: vi.fn(() => signals),
    ...overrides,
  } as ReturnType<typeof useLocalVision>;
}

test("requires an explicit model-load click and discloses the local boundary", () => {
  const localVision = vision();
  render(<LocalVisualControl vision={localVision} cameraActive={false} />);
  expect(screen.getByText("模型檔首次下載；畫面不會上傳")).toBeVisible();
  expect(screen.getByText("只看畫面幾何，不判斷情緒、誠實或自信")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "載入本機視覺模型" }));
  expect(localVision.loadModel).toHaveBeenCalledOnce();
});

test("keeps start disabled until the local camera is active", () => {
  const localVision = vision({ status: "ready" });
  const { rerender } = render(<LocalVisualControl vision={localVision} cameraActive={false} />);
  expect(screen.getByRole("button", { name: "請先開啟鏡頭" })).toBeDisabled();
  rerender(<LocalVisualControl vision={localVision} cameraActive />);
  fireEvent.click(screen.getByRole("button", { name: "開始本機視覺觀察" }));
  expect(localVision.startObserving).toHaveBeenCalledOnce();
});

test("shows observing status, sample count, and an explicit stop", () => {
  const localVision = vision({
    status: "observing",
    lastObservation: { timestampMs: 1, hasFace: true, faceCenterX: 0.5, faceCenterY: 0.5, faceAreaRatio: 0.2, irisHorizontalOffset: 0.1 },
    signals: { sampleCount: 4, faceVisibleRatio: 1, centeredRatio: 1, stableDistanceRatio: 1, cameraDirectionEstimateRatio: 1 },
  });
  render(<LocalVisualControl vision={localVision} cameraActive />);
  expect(screen.getByText("視覺觀察中")).toBeVisible();
  expect(screen.getByText("目前偵測到單一臉部")).toBeVisible();
  expect(screen.getByText("樣本數：4")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "停止觀察" }));
  expect(localVision.stopObserving).toHaveBeenCalledOnce();
});
