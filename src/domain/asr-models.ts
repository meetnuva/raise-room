export type AsrModelPresetId = "quality" | "balanced" | "fast";

export interface AsrModelPreset {
  id: AsrModelPresetId;
  label: string;
  description: string;
  modelId: string;
  approximateDownloadMb: number;
  webgpuRequired: boolean;
  webgpuDtype: {
    encoder_model: "fp16" | "fp32";
    decoder_model_merged: "q4";
  };
  wasmDtype?: "q8";
}

export const defaultAsrModelPresetId: AsrModelPresetId = "quality";

export const asrModelPresets: Readonly<Record<AsrModelPresetId, AsrModelPreset>> = {
  quality: {
    id: "quality",
    label: "高品質",
    description: "最準確，首次約 1.5 GB",
    modelId: "onnx-community/whisper-large-v3-turbo",
    approximateDownloadMb: 1535,
    webgpuRequired: true,
    webgpuDtype: { encoder_model: "fp16", decoder_model_merged: "q4" },
  },
  balanced: {
    id: "balanced",
    label: "平衡",
    description: "品質與速度平衡，首次約 390 MB",
    modelId: "onnx-community/whisper-small",
    approximateDownloadMb: 390,
    webgpuRequired: false,
    webgpuDtype: { encoder_model: "fp16", decoder_model_merged: "q4" },
    wasmDtype: "q8",
  },
  fast: {
    id: "fast",
    label: "快速",
    description: "速度優先，首次約 114 MB",
    modelId: "onnx-community/whisper-tiny",
    approximateDownloadMb: 114,
    webgpuRequired: false,
    webgpuDtype: { encoder_model: "fp32", decoder_model_merged: "q4" },
    wasmDtype: "q8",
  },
};

export function isAsrModelPresetId(value: unknown): value is AsrModelPresetId {
  return value === "quality" || value === "balanced" || value === "fast";
}

export function isPresetAvailable(id: AsrModelPresetId, hasWebGpu: boolean): boolean {
  return !asrModelPresets[id].webgpuRequired || hasWebGpu;
}
