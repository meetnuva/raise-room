import { expect, test, vi } from "vitest";
import {
  ManagerApiError,
  buildPerxonaMessages,
  createFixedWindowRateLimiter,
  createManagerService,
  parseManagerRequest,
} from "./manager-api.mjs";

const scenario = {
  company: " nuva ",
  role: "產品營運專員",
  tenureMonths: 18,
  compensation: { currentMonthlySalary: 60000, requestedMonthlySalary: 70000, minimumMonthlySalary: 65000 },
  achievements: "整理跨部門流程",
  reason: "依成果討論調薪",
  manager: {
    name: "王主管", budgetDefensiveness: "高", evidenceDemand: "高", patience: "中",
    directness: "高", warmth: "中", authority: "高", hiddenStance: "先要求證據",
    customInstructions: "追問數字。",
  },
  events: [],
};

const validRequest = {
  scenario,
  transcript: [
    { speaker: "user", text: " 我希望調整薪資 ", elapsedSeconds: 0 },
    { speaker: "manager", text: " 請先說明成果。 ", elapsedSeconds: 0, managerSource: "simulated" },
  ],
  dueEvents: [{ id: "budget-freeze", triggerRatio: 0.3, label: "預算暫緩", instruction: "告知預算防守較嚴格" }],
};

test("builds stateless user and assistant messages without duplicating the newest turn", () => {
  const messages = buildPerxonaMessages(parseManagerRequest(validRequest));

  expect(messages.map((message) => [message.role, message.parts[0].text])).toEqual([
    ["user", expect.stringContaining("<raise_room_scenario>")],
    ["assistant", "角色與情境已載入，我會只輸出主管台詞。"],
    ["user", "我希望調整薪資"],
    ["assistant", "請先說明成果。"],
  ]);
  expect(messages[0].parts[0].text).toContain("公司：nuva");
  expect(messages[0].parts[0].text).toContain("主管補充角色指令：追問數字。");
  expect(messages[0].parts[0].text).toContain("目前已發生壓力事件：進度 30%：預算暫緩－告知預算防守較嚴格");
});

test("accepts approved trigger ratios for scenario and due events", () => {
  const event = { id: "budget-freeze", triggerRatio: 0.3, label: "預算暫緩", instruction: "告知預算防守較嚴格" };
  const request = parseManagerRequest({ ...validRequest, scenario: { ...scenario, events: [event] }, dueEvents: [event] });

  expect(request.scenario.events[0].triggerRatio).toBe(0.3);
  expect(request.dueEvents[0].triggerRatio).toBe(0.3);
  expect(buildPerxonaMessages(request)[0].parts[0].text).toContain("目前已發生壓力事件：進度 30%：預算暫緩－告知預算防守較嚴格");

  for (const triggerRatio of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    expect(parseManagerRequest({ ...validRequest, dueEvents: [{ ...event, triggerRatio }] }).dueEvents[0].triggerRatio).toBe(triggerRatio);
  }
});

test("rejects legacy minute-shaped and non-approved trigger-ratio events", () => {
  const event = { id: "budget-freeze", triggerRatio: 0.3, label: "預算暫緩", instruction: "告知預算防守較嚴格" };
  const invalidEvents = [
    { id: event.id, minute: 3, label: event.label, instruction: event.instruction },
    { ...event, triggerRatio: 0.2 },
    { ...event, triggerRatio: -0.1 },
    { ...event, triggerRatio: NaN },
    { ...event, triggerRatio: "0.3" },
    { id: event.id, label: event.label, instruction: event.instruction },
  ];

  for (const invalidEvent of invalidEvents) {
    for (const request of [
      { ...validRequest, dueEvents: [invalidEvent] },
      { ...validRequest, scenario: { ...scenario, events: [invalidEvent] } },
    ]) {
      try {
        parseManagerRequest(request);
        throw new Error("expected INVALID_REQUEST");
      } catch (error) {
        expect(error).toMatchObject({ code: "INVALID_REQUEST", status: 400 });
      }
    }
  }
});

test("rejects malformed values, overlong transcripts, and excessive total text", () => {
  expect(() => parseManagerRequest({ ...validRequest, transcript: "not-an-array" })).toThrow(ManagerApiError);
  expect(() => parseManagerRequest({ ...validRequest, transcript: Array.from({ length: 41 }, () => validRequest.transcript[0]) })).toThrow(ManagerApiError);
  expect(() => parseManagerRequest({ ...validRequest, transcript: [{ ...validRequest.transcript[0], text: "x".repeat(24_001) }] })).toThrow(ManagerApiError);
});

test("enforces a fixed 30-call window", () => {
  const limiter = createFixedWindowRateLimiter({ now: () => 1_000 });

  for (let index = 0; index < 30; index += 1) expect(limiter.allow()).toBe(true);
  expect(limiter.allow()).toBe(false);
});

test("sends only the server secret in the official upstream header and returns succeeded text", async () => {
  const fetchImpl = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ id: "interaction-1", status: "succeeded", reply_text: "請先說明成果。" }), { status: 200 }),
  );
  const service = createManagerService({
    config: { apiBaseUrl: "https://console.perxona.ai/asia", secretKey: "server-only-test-key", chatbotId: "bot id" },
    fetchImpl,
  });

  await expect(service.reply(validRequest)).resolves.toEqual("請先說明成果。");
  expect(fetchImpl).toHaveBeenCalledWith(
    "https://console.perxona.ai/asia/api/v1/connect/chatbots/bot%20id/chat",
    expect.objectContaining({ headers: { "Content-Type": "application/json", "X-Connect-Key": "server-only-test-key" } }),
  );
});

test("maps auth, subscription, chatbot failure, and timeout to fixed public errors", async () => {
  const configured = { apiBaseUrl: "https://console.perxona.ai/asia", secretKey: "server-only-test-key", chatbotId: "bot" };
  const responseFor = (status, body) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

  await expect(createManagerService({ config: configured, fetchImpl: responseFor(401, {}) }).reply(validRequest)).rejects.toMatchObject({ code: "PERXONA_AUTH_REJECTED", status: 502 });
  await expect(createManagerService({ config: configured, fetchImpl: responseFor(400, { code: 1003 }) }).reply(validRequest)).rejects.toMatchObject({ code: "PERXONA_CREDIT_UNAVAILABLE", status: 503 });
  await expect(createManagerService({ config: configured, fetchImpl: responseFor(403, { code: 14005 }) }).reply(validRequest)).rejects.toMatchObject({ code: "PERXONA_CREDIT_UNAVAILABLE", status: 503 });
  await expect(createManagerService({ config: configured, fetchImpl: responseFor(200, { id: "x", status: "failed", reply_text: null }) }).reply(validRequest)).rejects.toMatchObject({ code: "PERXONA_CHATBOT_FAILED", status: 502 });
  await expect(createManagerService({ config: configured, fetchImpl: vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")) }).reply(validRequest)).rejects.toMatchObject({ code: "PERXONA_TIMEOUT", status: 504 });
});
