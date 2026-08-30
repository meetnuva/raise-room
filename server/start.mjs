import { resolve } from "node:path";
import { createApp } from "./app.mjs";

function localPort(value) {
  const parsed = Number(value ?? 4173);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65_536 ? parsed : 4173;
}

const app = createApp({ staticDir: resolve("dist") });
app.listen(localPort(process.env.PORT), "127.0.0.1");
