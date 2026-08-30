import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { LocalCameraTile } from "./LocalCameraTile";

test("only starts the local camera after an explicit click", () => {
  const start = vi.fn();
  render(<LocalCameraTile camera={{ status: "idle", stream: null, errorMessage: null, start, stop: vi.fn() }} />);
  expect(screen.getByText("鏡頭尚未開啟")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "開啟我的鏡頭" }));
  expect(start).toHaveBeenCalledOnce();
});

test("keeps its standalone explicit-click control by default", () => {
  render(<LocalCameraTile camera={{ status: "idle", stream: null, errorMessage: null, start: vi.fn(), stop: vi.fn() }} />);

  expect(screen.getByRole("button", { name: "開啟我的鏡頭" })).toBeVisible();
});

test("hands an active video element to its local consumer and clears it on unmount", () => {
  const onVideoElement = vi.fn();
  const { unmount } = render(
    <LocalCameraTile
      camera={{ status: "active", stream: {} as MediaStream, errorMessage: null, start: vi.fn(), stop: vi.fn() }}
      onVideoElement={onVideoElement}
    />,
  );
  expect(onVideoElement).toHaveBeenCalledWith(expect.any(HTMLVideoElement));
  unmount();
  expect(onVideoElement).toHaveBeenLastCalledWith(null);
});
