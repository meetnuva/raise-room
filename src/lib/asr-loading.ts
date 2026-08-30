import { asrModelPresets, type AsrModelPresetId } from "../domain/asr-models";

export function getAsrAttemptLoadingMessage(
  preset: AsrModelPresetId,
  device: "webgpu" | "wasm",
  isFallback = false,
): string {
  const name = `${asrModelPresets[preset].label}模型（${preset}）`;
  if (isFallback) return `${name}· WebGPU 無法使用，改用 WASM`;
  return `${name}· ${device === "webgpu" ? "WebGPU" : "WASM"}`;
}
