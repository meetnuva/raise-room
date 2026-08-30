import { useEffect, useRef, useState } from "react";

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
  allowMediaTest = true,
}: {
  kinds: readonly MediaDeviceKind[];
  mediaDevices?: Pick<MediaDevices, "enumerateDevices"> & Partial<Pick<MediaDevices, "getUserMedia">>;
  selectedDeviceIds?: Partial<Record<MediaDeviceKind, string>>;
  onSelectDevice(device: DeviceSettingsDevice): void;
  allowMediaTest?: boolean;
}) {
  const [devices, setDevices] = useState<DeviceSettingsDevice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const previewVideo = useRef<HTMLVideoElement>(null);
  const mounted = useRef(true);
  const requestVersion = useRef(0);
  const activePreview = useRef<MediaStream | null>(null);
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
  const testMicrophone = async () => {
    if (!mediaDevices?.getUserMedia) { setTestStatus("此瀏覽器無法測試麥克風。"); return; }
    const version = ++requestVersion.current;
    try {
      const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getTracks().forEach((track) => track.stop());
      if (!mounted.current || version !== requestVersion.current) return;
      setTestStatus("麥克風測試完成。");
    } catch { if (mounted.current && version === requestVersion.current) setTestStatus("無法啟動麥克風測試。"); }
  };
  const previewCamera = async () => {
    if (!mediaDevices?.getUserMedia) { setTestStatus("此瀏覽器無法預覽攝影機。"); return; }
    const version = ++requestVersion.current;
    try {
      const stream = await mediaDevices.getUserMedia({ audio: false, video: true });
      if (!mounted.current || version !== requestVersion.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      activePreview.current?.getTracks().forEach((track) => track.stop());
      activePreview.current = stream;
      setPreviewStream(stream);
    } catch { if (mounted.current && version === requestVersion.current) setTestStatus("無法啟動攝影機預覽。"); }
  };
  useEffect(() => {
    if (previewVideo.current) previewVideo.current.srcObject = previewStream;
  }, [previewStream]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestVersion.current += 1;
      activePreview.current?.getTracks().forEach((track) => track.stop());
      activePreview.current = null;
    };
  }, []);

  return (
    <section className="device-settings-panel" aria-label="裝置設定">
      <p>裝置清單僅在你選擇讀取後顯示，裝置 ID 不會儲存。</p>
      <button type="button" onClick={() => void readDevices()}>讀取可用裝置</button>
      {allowMediaTest && kinds.includes("audioinput") && <button type="button" onClick={() => void testMicrophone()}>測試麥克風</button>}
      {allowMediaTest && kinds.includes("videoinput") && <><button type="button" onClick={() => void previewCamera()}>預覽攝影機</button>{previewStream && <video aria-label="攝影機預覽" autoPlay muted playsInline ref={previewVideo} />}</>}
      {testStatus && <p role="status">{testStatus}</p>}
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
                {selectedDeviceIds?.[kind] === device.deviceId && <span>已選擇，下次明確開啟時套用</span>}
              </div>
            ))}
          </section>
        );
      })}
      {kinds.includes("audiooutput") && !supportsSetSinkId && <p>此瀏覽器不支援喇叭輸出切換。</p>}
    </section>
  );
}
