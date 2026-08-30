import type { IPresentationWidget, PresentationResult, PresentationTarget } from "@perxona/presenter-types";

export type PresenterElement = HTMLElement & IPresentationWidget;
export interface PresenterClient {
  mount(container: HTMLElement): Promise<void>;
  subscribe(listener: (event: "ready" | "key-rejected") => void): () => void;
  initialize(connectKey: string, target: PresentationTarget): Promise<void>;
  resumeAudio(): Promise<void>;
  speak(text: string): Promise<PresentationResult | undefined>;
  interrupt(): void;
  destroy(): void;
}

let enginePromise: Promise<void> | null = null;

export function isAllowedPresenterUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "cdn.perxona.ai" && url.pathname.endsWith(".js") && !url.search;
  } catch { return false; }
}

export function loadPresenterEngine(url: string): Promise<void> {
  if (!isAllowedPresenterUrl(url)) return Promise.reject(new Error("不允許的 Perxona Presenter URL"));
  if (enginePromise) return enginePromise;
  enginePromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = url;
    script.dataset.perxonaPresenter = "true";
    script.onload = () => resolve();
    script.onerror = () => { enginePromise = null; reject(new Error("Perxona Presenter 載入失敗")); };
    document.head.append(script);
  });
  return enginePromise;
}

export function createPresenterClient(url: string): PresenterClient {
  let element: PresenterElement | null = null;
  let destroyed = false;
  const subscriptions = new Set<(event: "ready" | "key-rejected") => void>();
  let statusHandler: EventListener | null = null;
  let rejectedHandler: EventListener | null = null;
  return {
    async mount(container) {
      await loadPresenterEngine(url);
      if (destroyed || element) return;
      element = document.createElement("sv-presenter") as PresenterElement;
      element.style.width = "100%";
      element.style.height = "100%";
      statusHandler = (event) => {
        const detail = (event as CustomEvent<unknown>).detail;
        if (typeof detail === "object" && detail !== null && "status" in detail && (detail as { status?: unknown }).status === "Ready") {
          subscriptions.forEach((listener) => listener("ready"));
        }
      };
      rejectedHandler = () => subscriptions.forEach((listener) => listener("key-rejected"));
      element.addEventListener("PRESENTER_STATUS", statusHandler);
      element.addEventListener("CONNECT_KEY_REJECTED", rejectedHandler);
      container.append(element);
    },
    subscribe(listener) { subscriptions.add(listener); return () => subscriptions.delete(listener); },
    async initialize(connectKey, target) { await element?.initializeWithConnectKey(connectKey, target); },
    async resumeAudio() { await element?.resumeAudioPlayback(); },
    async speak(text) { const content = text.trim(); return content ? element?.present(content) : undefined; },
    interrupt() { element?.interruptPresentation(); },
    destroy() {
      destroyed = true;
      if (element && statusHandler) element.removeEventListener("PRESENTER_STATUS", statusHandler);
      if (element && rejectedHandler) element.removeEventListener("CONNECT_KEY_REJECTED", rejectedHandler);
      element?.remove(); element = null; subscriptions.clear(); statusHandler = null; rejectedHandler = null;
    },
  };
}
