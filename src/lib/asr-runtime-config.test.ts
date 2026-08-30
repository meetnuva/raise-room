import { expect, test } from "vitest";
import { getAsrRuntimeAttempts, getAsrRuntimeConfig, hasWebGpuSupport } from "./asr-runtime-config";

test("uses the exact WebGPU quality configuration", () => {
  expect(getAsrRuntimeConfig("quality", true)).toEqual({
    ok: true,
    modelId: "onnx-community/whisper-large-v3-turbo",
    device: "webgpu",
    dtype: { encoder_model: "fp16", decoder_model_merged: "q4" },
  });
});

test("rejects quality without WebGPU instead of silently falling back", () => {
  expect(getAsrRuntimeConfig("quality", false)).toMatchObject({
    ok: false,
    message: expect.stringContaining("WebGPU"),
  });
});

test("uses q8 WASM only for the approved balanced and fast presets", () => {
  expect(getAsrRuntimeConfig("balanced", false)).toEqual({
    ok: true,
    modelId: "onnx-community/whisper-small",
    device: "wasm",
    dtype: "q8",
  });
  expect(getAsrRuntimeConfig("fast", false)).toEqual({
    ok: true,
    modelId: "onnx-community/whisper-tiny",
    device: "wasm",
    dtype: "q8",
  });
});

test("plans an actual WebGPU retry only for balanced and fast", () => {
  expect(getAsrRuntimeAttempts("quality", true).map((attempt) => attempt.device)).toEqual(["webgpu"]);
  expect(getAsrRuntimeAttempts("balanced", true).map((attempt) => attempt.device)).toEqual(["webgpu", "wasm"]);
  expect(getAsrRuntimeAttempts("fast", true).map((attempt) => attempt.device)).toEqual(["webgpu", "wasm"]);
});

test("requires a usable navigator.gpu value rather than property presence", () => {
  expect(hasWebGpuSupport(undefined)).toBe(false);
  expect(hasWebGpuSupport(null)).toBe(false);
  expect(hasWebGpuSupport({ requestAdapter: () => undefined })).toBe(true);
});
