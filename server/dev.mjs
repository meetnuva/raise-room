import { createServer as createViteServer } from "vite";
import { createApp } from "./app.mjs";

function localPort(value) {
  const parsed = Number(value ?? 5173);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65_536 ? parsed : 5173;
}

const app = createApp();
const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
app.use(vite.middlewares);
app.listen(localPort(process.env.PORT), "127.0.0.1");
