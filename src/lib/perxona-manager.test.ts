import { expect, test, vi } from "vitest";
import { appendUserTurn, createMeeting } from "../domain/meeting";
import { defaultScenario } from "../domain/scenario";
import { createHybridManagerResponder } from "./perxona-manager";

function replyInput() {
  return {
    scenario: defaultScenario,
    transcript: appendUserTurn(createMeeting(defaultScenario), "我想依成果討論調薪").transcript,
    dueEvents: [],
  };
}

test("does not post when the same-origin status reports an unconfigured manager", async () => {
  const fetchImpl = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ configured: false }), { status: 200 }),
  );

  const reply = await createHybridManagerResponder(fetchImpl).reply(replyInput());

  expect(reply).toMatchObject({ source: "simulated", notice: expect.any(String) });
  expect(fetchImpl).toHaveBeenCalledWith("/api/manager/status");
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test("checks status before posting a validated Perxona manager reply", async () => {
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ configured: true }), { status: 200 }))
    .mockResolvedValueOnce(
    new Response(JSON.stringify({ replyText: "請先說明具體成果。", source: "perxona" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
    );

  const reply = await createHybridManagerResponder(fetchImpl).reply(replyInput());

  expect(reply).toEqual({ text: "請先說明具體成果。", source: "perxona" });
  expect(fetchImpl).toHaveBeenNthCalledWith(1, "/api/manager/status");
  expect(fetchImpl).toHaveBeenCalledWith(
    "/api/manager/reply",
    expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } }),
  );
});

test("caches configured status across manager replies", async () => {
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ configured: true }), { status: 200 }))
    .mockResolvedValue(
      new Response(JSON.stringify({ replyText: "請先說明具體成果。", source: "perxona" }), { status: 200 }),
    );
  const responder = createHybridManagerResponder(fetchImpl);

  await responder.reply(replyInput());
  await responder.reply(replyInput());

  expect(fetchImpl.mock.calls.filter(([url]) => url === "/api/manager/status")).toHaveLength(1);
  expect(fetchImpl.mock.calls.filter(([url]) => url === "/api/manager/reply")).toHaveLength(2);
});

test("uses a visible local fallback when a configured manager API is unavailable", async () => {
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ configured: true }), { status: 200 }))
    .mockResolvedValueOnce(
    new Response(JSON.stringify({ error: { code: "PERXONA_NOT_CONFIGURED" } }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    }),
    );

  const reply = await createHybridManagerResponder(fetchImpl).reply(replyInput());

  expect(reply).toMatchObject({
    source: "simulated",
    notice: "Perxona 動態主管暫時無法使用，已切換為本機腳本 fallback。",
  });
});

test("uses a visible local fallback when a configured manager reply is malformed", async () => {
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ configured: true }), { status: 200 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ replyText: 42, source: "perxona" }), { status: 200 }),
    );

  const reply = await createHybridManagerResponder(fetchImpl).reply(replyInput());

  expect(reply).toMatchObject({
    source: "simulated",
    notice: "Perxona 動態主管暫時無法使用，已切換為本機腳本 fallback。",
  });
});

test("uses a visible local fallback for status network or malformed responses", async () => {
  const networkReply = await createHybridManagerResponder(
    vi.fn().mockRejectedValue(new TypeError("network unavailable")),
  ).reply(replyInput());
  const malformedReply = await createHybridManagerResponder(
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ configured: "yes" }), { status: 200 })),
  ).reply(replyInput());

  expect(networkReply).toMatchObject({ source: "simulated", notice: expect.any(String) });
  expect(malformedReply).toMatchObject({ source: "simulated", notice: expect.any(String) });
});
