import { expect, test, vi } from "vitest";
import { createVisionFileset } from "./face-landmarker.worker";

test("selects the module-compatible MediaPipe WASM fileset", async () => {
  const fileset = {};
  const forVisionTasks = vi.fn().mockResolvedValue(fileset);

  await expect(createVisionFileset(forVisionTasks)).resolves.toBe(fileset);
  expect(forVisionTasks).toHaveBeenCalledWith("/mediapipe/wasm", true);
});
