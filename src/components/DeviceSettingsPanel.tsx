import { useState } from "react";

export type DeviceSettingsDevice = Pick<MediaDeviceInfo, "deviceId" | "groupId" | "kind" | "label">;

const deviceGroupLabels = {
  audioinput: "麥克風",
  audiooutput: "喇叭",
  videoinput: "攝影機",
} as const;

export function DeviceSettingsPanel({
  kinds,
  mediaDevices = typeof navigator === "undefined" ? undefined : navigator.mediaDevices,
  selectedDeviceIds,
  onSelectDevice,
}: {
  kinds: readonly MediaDeviceKind[];
  mediaDevices?: Pick<MediaDevices, "enumerateDevices">;
  selectedDeviceIds?: Partial<Record<MediaDeviceKind, string>>;
  onSelectDevice(device: DeviceSettingsDevice): void;
}) {
  const [devices, setDevices] = useState<DeviceSettingsDevice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supportsSetSinkId = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
  const readDevices = async () => {
    if (!mediaDevices) {
      setError("此瀏覽器無法讀取可用裝置。");
      return;
    }
    try {
      setDevices(await mediaDevices.enumerateDevices());
      setError(null);
    } catch {
      setError("無法讀取可用裝置。");
    }
  };

  return (
    <section className="device-settings-panel" aria-label="裝置設定">
      <p>裝置清單僅在你選擇讀取後顯示，裝置 ID 不會儲存。</p>
      <button type="button" onClick={() => void readDevices()}>讀取可用裝置</button>
      {error && <p role="alert">{error}</p>}
      {devices && kinds.map((kind) => {
        const group = devices.filter((device) => device.kind === kind);
        const groupLabel = deviceGroupLabels[kind as keyof typeof deviceGroupLabels];
        if (!groupLabel) return null;
        return (
          <section className="device-settings-group" key={kind} aria-label={groupLabel}>
            <h3>{groupLabel}</h3>
            {group.length === 0 ? <p>未找到可用裝置。</p> : group.map((device, index) => (
              <div key={device.deviceId || `${kind}-${index}`}>
                <span>{device.label || `${groupLabel} ${index + 1}`}</span>
                <button aria-pressed={selectedDeviceIds?.[kind] === device.deviceId} type="button" onClick={() => onSelectDevice(device)}>使用 {device.label || `${groupLabel} ${index + 1}`}</button>
                {selectedDeviceIds?.[kind] === device.deviceId && <span>目前使用中</span>}
              </div>
            ))}
          </section>
        );
      })}
      {!supportsSetSinkId && <p>此瀏覽器不支援喇叭輸出切換。</p>}
    </section>
  );
}
