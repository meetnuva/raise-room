import { cp, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(projectRoot, "node_modules/@mediapipe/tasks-vision/wasm");
const destination = resolve(projectRoot, "public/mediapipe/wasm");

try {
  await stat(source);
} catch {
  throw new Error(`找不到 MediaPipe WASM 來源：${source}`);
}

await cp(source, destination, { recursive: true, force: true });
