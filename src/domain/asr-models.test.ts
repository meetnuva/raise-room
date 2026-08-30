import { expect, test } from "vitest";
import {
  asrModelPresets,
  defaultAsrModelPresetId,
  isAsrModelPresetId,
  isPresetAvailable,
} from "./asr-models";

test("uses high quality as the non-downloading default", () => {
  expect(defaultAsrModelPresetId).toBe("quality");
  expect(asrModelPresets.quality).toMatchObject({
    modelId: "onnx-community/whisper-large-v3-turbo",
    approximateDownloadMb: 1535,
    webgpuRequired: true,
  });
});

test("allows only the three approved preset ids", () => {
  expect(isAsrModelPresetId("quality")).toBe(true);
  expect(isAsrModelPresetId("balanced")).toBe(true);
  expect(isAsrModelPresetId("fast")).toBe(true);
  expect(isAsrModelPresetId("https://untrusted.example/model")).toBe(false);
});

test("disables only quality when WebGPU is missing", () => {
  expect(isPresetAvailable("quality", false)).toBe(false);
  expect(isPresetAvailable("balanced", false)).toBe(true);
  expect(isPresetAvailable("fast", false)).toBe(true);
});
