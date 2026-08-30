import { expect, test } from "vitest";
import { getAsrAttemptLoadingMessage } from "./asr-loading";

test("labels every allowlisted model attempt with its runtime", () => {
  expect(getAsrAttemptLoadingMessage("fast", "webgpu")).toBe("快速模型（fast）· WebGPU");
  expect(getAsrAttemptLoadingMessage("balanced", "wasm", true)).toBe("平衡模型（balanced）· WebGPU 無法使用，改用 WASM");
  expect(getAsrAttemptLoadingMessage("quality", "webgpu")).toBe("高品質模型（quality）· WebGPU");
});
