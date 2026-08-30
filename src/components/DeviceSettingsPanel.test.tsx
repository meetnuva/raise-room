import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { readFileSync } from "node:fs";
import { vi } from "vitest";
import { DeviceSettingsPanel } from "./DeviceSettingsPanel";

test("enumerates only after explicit request, filters kinds, and selects a real device control", async () => {
  const enumerateDevices = vi.fn().mockResolvedValue([
    { deviceId: "mic-id", groupId: "group", kind: "audioinput", label: "麥克風" },
    { deviceId: "speaker-id", groupId: "group", kind: "audiooutput", label: "喇叭" },
    { deviceId: "camera-id", groupId: "group", kind: "videoinput", label: "攝影機" },
  ]);
  const onSelectDevice = vi.fn();
  render(<DeviceSettingsPanel kinds={["audioinput", "audiooutput"]} mediaDevices={{ enumerateDevices }} onSelectDevice={onSelectDevice} selectedDeviceIds={{ audioinput: "mic-id" }} />);

  expect(enumerateDevices).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "讀取可用裝置" }));
  await screen.findByRole("heading", { name: "麥克風" });
  expect(screen.getByRole("heading", { name: "喇叭" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "攝影機" })).toBeNull();
  expect(screen.getByText("此瀏覽器不支援喇叭輸出切換。")) .toBeVisible();
  expect(screen.getByRole("button", { name: "使用 麥克風" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("已選擇，下次明確開啟時套用")).toBeVisible();
  expect(screen.queryByRole("button", { name: /預覽/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "使用 喇叭" }));
  expect(onSelectDevice).toHaveBeenCalledWith(expect.objectContaining({ deviceId: "speaker-id", kind: "audiooutput" }));
});

test("stops a late camera preview after unmount and never exposes media tests when disabled", async () => {
  let resolveStream: (stream: MediaStream) => void = () => {};
  const getUserMedia = vi.fn(() => new Promise<MediaStream>((resolve) => { resolveStream = resolve; }));
  const stop = vi.fn();
  const { unmount } = render(<DeviceSettingsPanel kinds={["videoinput"]} mediaDevices={{ enumerateDevices: vi.fn(), getUserMedia }} onSelectDevice={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "預覽攝影機" }));
  unmount();
  await act(async () => resolveStream({ getTracks: () => [{ stop }] } as unknown as MediaStream));
  expect(stop).toHaveBeenCalledOnce();

  render(<DeviceSettingsPanel allowMediaTest={false} kinds={["audioinput", "videoinput"]} mediaDevices={{ enumerateDevices: vi.fn(), getUserMedia }} onSelectDevice={vi.fn()} />);
  expect(screen.queryByRole("button", { name: /測試麥克風|預覽攝影機/ })).toBeNull();
  expect(getUserMedia).toHaveBeenCalledOnce();
});

test("keeps explicit media requests live after StrictMode replay and stops the resulting preview on unmount", async () => {
  const microphoneTrack = { stop: vi.fn() };
  const cameraTrack = { stop: vi.fn() };
  const getUserMedia = vi.fn()
    .mockResolvedValueOnce({ getTracks: () => [microphoneTrack] } as unknown as MediaStream)
    .mockResolvedValueOnce({ getTracks: () => [cameraTrack] } as unknown as MediaStream);
  const { unmount } = render(
    <StrictMode><DeviceSettingsPanel kinds={["audioinput", "videoinput"]} mediaDevices={{ enumerateDevices: vi.fn(), getUserMedia }} onSelectDevice={vi.fn()} /></StrictMode>,
  );
  fireEvent.click(screen.getByRole("button", { name: "測試麥克風" }));
  expect(await screen.findByText("麥克風測試完成。")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "預覽攝影機" }));
  expect(await screen.findByLabelText("攝影機預覽")).toBeVisible();
  unmount();
  expect(cameraTrack.stop).toHaveBeenCalledOnce();
});

test("styles explicit device read and test actions as compact controls with hover and focus feedback", () => {
  const styles = readFileSync("src/styles.css", "utf8");

  expect(styles).toMatch(/\.device-settings-panel\s*>\s*button\s*\{[^}]*justify-self:\s*start;[^}]*min-width:\s*10rem;/s);
  expect(styles).toMatch(/\.device-settings-panel\s*>\s*button:hover\s*\{[^}]*background:/);
  expect(styles).toMatch(/\.device-settings-panel\s*>\s*button:focus-visible\s*\{[^}]*outline:/);
});
