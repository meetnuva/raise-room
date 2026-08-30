import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { useRef } from "react";
import { usePerxonaPresenter } from "./use-perxona-presenter";

test("launches in the required audio then initialization order", async () => {
  const resumeAudio = vi.fn().mockResolvedValue(undefined);
  const initialize = vi.fn().mockResolvedValue(undefined);
  const client = { mount: vi.fn().mockResolvedValue(undefined), subscribe: vi.fn(() => vi.fn()), resumeAudio, initialize, speak: vi.fn(), interrupt: vi.fn(), destroy: vi.fn() };
  const { result } = renderHook(() => usePerxonaPresenter({ containerRef: useRef(document.createElement("div")), config: { enabled: true, publishableKey: "key", presenterUrl: "https://cdn.perxona.ai/asia/prod/latest/widget/entry/presenter.js", target: { avatarId: "avatar", sceneId: "scene", voiceId: "voice" } }, clientFactory: () => client }));
  await waitFor(() => expect(result.current.status).toBe("mounted"));
  await act(() => result.current.launch());
  expect(resumeAudio).toHaveBeenCalledBefore(initialize);
});
