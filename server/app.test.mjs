import { expect, test, vi } from "vitest";
import { createApp } from "./app.mjs";

const scenario = {
  company: "nuva", role: "產品營運專員", tenureMonths: 18,
  compensation: { currentMonthlySalary: 60000, requestedMonthlySalary: 70000, minimumMonthlySalary: 65000 },
  achievements: "整理跨部門流程", reason: "依成果討論調薪",
  manager: {
    name: "王主管", budgetDefensiveness: "高", evidenceDemand: "高", patience: "中",
    directness: "高", warmth: "中", authority: "高", hiddenStance: "先要求證據",
    customInstructions: "追問數字。",
  },
  events: [],
};
const validBody = { scenario, transcript: [], dueEvents: [] };

async function requestFrom(app, request) {
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  try {
    const { port } = server.address();
    return await fetch(`http://127.0.0.1:${port}${request.path}`, request.options);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("reports an unconfigured manager without exposing server settings", async () => {
  const app = createApp({ env: {} });

  const status = await requestFrom(app, { path: "/api/manager/status", options: {} });
  const reply = await requestFrom(app, {
    path: "/api/manager/reply",
    options: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validBody) },
  });

  expect(await status.json()).toEqual({ configured: false });
  expect(await reply.json()).toEqual({ error: { code: "PERXONA_NOT_CONFIGURED", message: "Perxona 動態主管尚未設定。" } });
  expect(status.headers.get("access-control-allow-origin")).toBeNull();
});

test("adds narrow safety headers without changing allowed local device behavior", async () => {
  const app = createApp({ env: {} });

  const status = await requestFrom(app, { path: "/api/manager/status", options: {} });

  expect(status.headers.get("x-content-type-options")).toBe("nosniff");
  expect(status.headers.get("referrer-policy")).toBe("no-referrer");
  expect(status.headers.get("x-frame-options")).toBe("DENY");
  expect(status.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
  expect(status.headers.get("permissions-policy")).toBe("camera=(self), microphone=(self)");
});

test("returns a fixed JSON error without exposing a thrown route error", async () => {
  const app = createApp({
    env: {},
    configureApp(instance) {
      instance.get("/test/throw", () => {
        throw new Error("private test failure");
      });
    },
  });

  const response = await requestFrom(app, { path: "/test/throw", options: {} });
  const payload = await response.json();

  expect(response.status).toBe(500);
  expect(payload).toEqual({ error: { code: "INTERNAL_ERROR", message: "伺服器暫時無法完成請求。" } });
  expect(JSON.stringify(payload)).not.toContain("private test failure");
});

test("returns only a Perxona reply and never echoes server credentials", async () => {
  const secret = "server-only-test-key";
  const fetchImpl = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ id: "interaction", status: "succeeded", reply_text: "請先說明具體成果。" }), { status: 200 }),
  );
  const app = createApp({
    env: { PERXONA_API_BASE_URL: "https://console.perxona.ai/asia", PERXONA_CONNECT_SECRET_KEY: secret, PERXONA_CHATBOT_ID: "chatbot-1" },
    fetchImpl,
  });

  const response = await requestFrom(app, {
    path: "/api/manager/reply",
    options: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validBody) },
  });
  const payload = await response.json();

  expect(payload).toEqual({ replyText: "請先說明具體成果。", source: "perxona" });
  expect(JSON.stringify(payload)).not.toContain(secret);
  expect(fetchImpl.mock.calls[0][1].headers["X-Connect-Key"]).toBe(secret);
});

test("rejects JSON request bodies above 32KB with the fixed invalid-request error", async () => {
  const app = createApp({ env: {} });
  const response = await requestFrom(app, {
    path: "/api/manager/reply",
    options: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ padding: "x".repeat(33 * 1024) }),
    },
  });

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: { code: "INVALID_REQUEST", message: "請確認情境與逐字稿格式後再試一次。" } });
});
