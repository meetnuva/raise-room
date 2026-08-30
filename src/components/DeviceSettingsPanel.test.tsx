import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { DeviceSettingsPanel } from "./DeviceSettingsPanel";

test("enumerates devices only after explicit request, groups them, and keeps preview injected", async () => {
  const enumerateDevices = vi.fn().mockResolvedValue([
    { deviceId: "mic-id", groupId: "group", kind: "audioinput", label: "麥克風" },
    { deviceId: "speaker-id", groupId: "group", kind: "audiooutput", label: "喇叭" },
    { deviceId: "camera-id", groupId: "group", kind: "videoinput", label: "攝影機" },
  ]);
  const onPreview = vi.fn();
  render(<DeviceSettingsPanel mediaDevices={{ enumerateDevices }} onPreview={onPreview} />);

  expect(enumerateDevices).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "讀取可用裝置" }));
  await screen.findByRole("heading", { name: "麥克風" });
  expect(screen.getByRole("heading", { name: "喇叭" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "攝影機" })).toBeVisible();
  expect(screen.getByText("此瀏覽器不支援喇叭輸出切換。")) .toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "預覽 麥克風" }));
  expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ deviceId: "mic-id", kind: "audioinput" }));
});
