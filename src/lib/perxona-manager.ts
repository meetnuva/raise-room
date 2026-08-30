import {
  simulatedResponder,
  type ManagerResponder,
} from "../domain/meeting";

type FetchImplementation = typeof fetch;

const fallbackNotice = "Perxona 動態主管暫時無法使用，已切換為本機腳本 fallback。";

function isPerxonaReply(value: unknown): value is { replyText: string; source: "perxona" } {
  return (
    typeof value === "object" &&
    value !== null &&
    "replyText" in value &&
    typeof value.replyText === "string" &&
    value.replyText.trim().length > 0 &&
    "source" in value &&
    value.source === "perxona"
  );
}

export function createHybridManagerResponder(
  fetchImpl: FetchImplementation = fetch,
): ManagerResponder {
  return {
    async reply(input) {
      try {
        const response = await fetchImpl("/api/manager/reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!response.ok) throw new Error("manager API unavailable");

        const payload: unknown = await response.json();
        if (!isPerxonaReply(payload)) throw new Error("invalid manager API response");

        return { text: payload.replyText.trim(), source: "perxona" };
      } catch {
        const fallback = await simulatedResponder.reply(input);
        return { ...fallback, notice: fallbackNotice };
      }
    },
  };
}
