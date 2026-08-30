import { asrModelPresets, type AsrModelPresetId } from "../domain/asr-models";

export type AsrRuntimeConfig =
  | {
      ok: true;
      modelId: string;
      device: "webgpu" | "wasm";
      dtype: { encoder_model: "fp16" | "fp32"; decoder_model_merged: "q4" } | "q8";
    }
  | { ok: false; message: string };

export type ReadyAsrRuntimeConfig = Extract<AsrRuntimeConfig, { ok: true }>;

export function hasWebGpuSupport(gpu: unknown): boolean {
  return typeof gpu === "object" && gpu !== null &&
    typeof (gpu as { requestAdapter?: unknown }).requestAdapter === "function";
}

export function getAsrRuntimeConfig(
  preset: AsrModelPresetId,
  hasWebGpu: boolean,
): AsrRuntimeConfig {
  const model = asrModelPresets[preset];
  if (model.webgpuRequired && !hasWebGpu) {
    return { ok: false, message: "高品質模型需要 WebGPU，請改選平衡或快速模型。" };
  }

  if (hasWebGpu) {
    return {
      ok: true,
      modelId: model.modelId,
      device: "webgpu",
      dtype: model.webgpuDtype,
    };
  }

  return { ok: true, modelId: model.modelId, device: "wasm", dtype: "q8" };
}

export function getAsrRuntimeAttempts(
  preset: AsrModelPresetId,
  hasWebGpu: boolean,
): ReadyAsrRuntimeConfig[] {
  const primary = getAsrRuntimeConfig(preset, hasWebGpu);
  if (!primary.ok) return [];
  if (preset === "quality" || !hasWebGpu) return [primary];

  const wasm = getAsrRuntimeConfig(preset, false);
  return wasm.ok ? [primary, wasm] : [primary];
}
