import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ComponentType } from "react";
import { expect, test, vi } from "vitest";
import { LocalCameraTile } from "./LocalCameraTile";

const LocalCameraTileWithOverlay = LocalCameraTile as unknown as ComponentType<ComponentProps<typeof LocalCameraTile> & {
  overlay?: React.ReactNode;
}>;

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

test("renders an injected preview stream without requesting or owning it", () => {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  const { unmount } = render(<LocalCameraTile previewStream={stream} showControl={false} />);

  const video = screen.getByLabelText("本機鏡頭預覽") as HTMLVideoElement;
  expect(video.srcObject).toBe(stream);
  expect(screen.queryByRole("button", { name: "開啟我的鏡頭" })).toBeNull();
  unmount();
  expect(stop).not.toHaveBeenCalled();
});

test("renders an injected preview overlay without taking ownership of its stream", () => {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  const { unmount } = render(
    <LocalCameraTileWithOverlay
      previewStream={stream}
      showControl={false}
      overlay={<button type="button">預覽控制</button>}
    />,
  );

  expect(screen.getByRole("button", { name: "預覽控制" })).toBeVisible();
  unmount();
  expect(stop).not.toHaveBeenCalled();
});
