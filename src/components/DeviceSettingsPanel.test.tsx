import { fireEvent, render, screen } from "@testing-library/react";
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
  expect(screen.getByText("目前使用中")).toBeVisible();
  expect(screen.queryByRole("button", { name: /預覽/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "使用 喇叭" }));
  expect(onSelectDevice).toHaveBeenCalledWith(expect.objectContaining({ deviceId: "speaker-id", kind: "audiooutput" }));
});
