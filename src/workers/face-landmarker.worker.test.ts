import { expect, test, vi } from "vitest";
import { createVisionFileset } from "./face-landmarker.worker";

test("maps every resolver-selected loader and binary pair to Vite-managed URLs", async () => {
  const bundledAssetUrls = {
    "vision_wasm_internal.js": "/assets/vision_wasm_internal-A.js",
    "vision_wasm_internal.wasm": "/assets/vision_wasm_internal-A.wasm",
    "vision_wasm_nosimd_internal.js": "/assets/vision_wasm_nosimd_internal-B.js",
    "vision_wasm_nosimd_internal.wasm": "/assets/vision_wasm_nosimd_internal-B.wasm",
    "vision_wasm_module_internal.js": "/assets/vision_wasm_module_internal-C.js",
    "vision_wasm_module_internal.wasm": "/assets/vision_wasm_module_internal-C.wasm",
  };

  for (const [loader, binary] of [
    ["vision_wasm_internal.js", "vision_wasm_internal.wasm"],
    ["vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"],
    ["vision_wasm_module_internal.js", "vision_wasm_module_internal.wasm"],
  ]) {
    const fileset = { wasmLoaderPath: `/resolver/${loader}`, wasmBinaryPath: `/resolver/${binary}` };
    const forVisionTasks = vi.fn().mockResolvedValue(fileset);
    await expect(createVisionFileset(forVisionTasks, bundledAssetUrls)).resolves.toEqual({
      wasmLoaderPath: bundledAssetUrls[loader as keyof typeof bundledAssetUrls],
      wasmBinaryPath: bundledAssetUrls[binary as keyof typeof bundledAssetUrls],
    });
    expect(forVisionTasks).toHaveBeenCalledWith("vite-asset-selection", true);
  }
});
