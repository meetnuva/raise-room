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

test("returns a validated Perxona manager reply from the same-origin API", async () => {
  const fetchImpl = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ replyText: "請先說明具體成果。", source: "perxona" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );

  const reply = await createHybridManagerResponder(fetchImpl).reply(replyInput());

  expect(reply).toEqual({ text: "請先說明具體成果。", source: "perxona" });
  expect(fetchImpl).toHaveBeenCalledWith(
    "/api/manager/reply",
    expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } }),
  );
});

test("uses a visible local fallback when the manager API is unavailable", async () => {
  const fetchImpl = vi.fn().mockResolvedValue(
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

test("uses a visible local fallback for network or malformed API responses", async () => {
  const networkReply = await createHybridManagerResponder(
    vi.fn().mockRejectedValue(new TypeError("network unavailable")),
  ).reply(replyInput());
  const malformedReply = await createHybridManagerResponder(
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ replyText: 42 }), { status: 200 })),
  ).reply(replyInput());

  expect(networkReply).toMatchObject({ source: "simulated", notice: expect.any(String) });
  expect(malformedReply).toMatchObject({ source: "simulated", notice: expect.any(String) });
});
