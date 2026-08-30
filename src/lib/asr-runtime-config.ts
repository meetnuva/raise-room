import { asrModelPresets, type AsrModelPresetId } from "../domain/asr-models";

export type AsrRuntimeConfig =
  | {
      ok: true;
      modelId: string;
      device: "webgpu" | "wasm";
      dtype: { encoder_model: "fp16" | "fp32"; decoder_model_merged: "q4" } | "q8";
    }
  | { ok: false; message: string };

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
