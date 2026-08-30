import { afterEach, expect, test, vi } from "vitest";
import { createPresenterClient, isAllowedPresenterUrl, loadPresenterEngine } from "./perxona-presenter";

const url = "https://cdn.perxona.ai/asia/prod/latest/widget/entry/presenter.js";

afterEach(() => document.head.querySelectorAll("script[data-perxona-presenter]").forEach((script) => script.remove()));

test("only permits the official HTTPS CDN JavaScript URL", () => {
  expect(isAllowedPresenterUrl(url)).toBe(true);
  expect(isAllowedPresenterUrl("https://cdn.perxona.ai/entry/presenter.js?x=1")).toBe(false);
  expect(isAllowedPresenterUrl("https://example.com/presenter.js")).toBe(false);
  expect(isAllowedPresenterUrl("http://cdn.perxona.ai/presenter.js")).toBe(false);
});

test("rejects an untrusted URL before appending a script", async () => {
  await expect(loadPresenterEngine("https://example.com/presenter.js")).rejects.toThrow("不允許");
  expect(document.head.querySelector("script[data-perxona-presenter]")).toBeNull();
});

test("mounts one presenter and tears down its event listeners", async () => {
  const container = document.createElement("div");
  const client = createPresenterClient(url);
  const listener = vi.fn();
  client.subscribe(listener);
  const load = client.mount(container);
  document.head.querySelector<HTMLScriptElement>("script[data-perxona-presenter]")!.dispatchEvent(new Event("load"));
  await load;
  const presenter = container.querySelector("sv-presenter")!;
  presenter.dispatchEvent(new CustomEvent("PRESENTER_STATUS", { detail: { status: "Ready" } }));
  expect(listener).toHaveBeenCalledWith("ready");
  client.destroy();
  expect(container.querySelector("sv-presenter")).toBeNull();
});
