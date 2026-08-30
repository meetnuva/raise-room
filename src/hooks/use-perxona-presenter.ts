import { useCallback, useEffect, useRef, useState } from "react";
import type { PresenterRuntimeConfig } from "../lib/perxona-config";
import { createPresenterClient, type PresenterClient } from "../lib/perxona-presenter";

export type PresenterStatus =
  | "disabled"
  | "loading"
  | "mounted"
  | "initializing"
  | "ready"
  | "key-rejected"
  | "error";

export function usePerxonaPresenter({
  containerRef,
  config,
  clientFactory = createPresenterClient,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  config: PresenterRuntimeConfig;
  clientFactory?: (url: string) => PresenterClient;
}) {
  const [status, setStatus] = useState<PresenterStatus>(config.enabled ? "loading" : "disabled");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const clientRef = useRef<PresenterClient | null>(null);
  useEffect(() => {
    if (!config.enabled) {
      setStatus("disabled");
      return;
    }

    let active = true;
    const client = clientFactory(config.presenterUrl);
    clientRef.current = client;
    const unsubscribe = client.subscribe((event) => {
      if (!active) return;
      if (event === "ready") {
        setStatus("ready");
      } else {
        setStatus("key-rejected");
        setErrorMessage("Perxona 金鑰遭拒絕，請檢查 Publishable Key 與網域限制。");
      }
    });

    void client
      .mount(containerRef.current ?? document.createElement("div"))
      .then(() => {
        if (active) setStatus("mounted");
      })
      .catch(() => {
        if (active) {
          setStatus("error");
          setErrorMessage("無法載入 Perxona 3D 主管。");
        }
      });

    return () => {
      active = false;
      unsubscribe();
      client.destroy();
      clientRef.current = null;
    };
  }, [clientFactory, config, containerRef]);

  const launch = useCallback(async () => {
    if (!config.enabled || !clientRef.current || status !== "mounted") return;
    setStatus("initializing");
    try {
      await clientRef.current.resumeAudio();
      await clientRef.current.initialize(config.publishableKey, config.target);
    } catch {
      setStatus("error");
      setErrorMessage("無法初始化 Perxona 3D 主管。");
    }
  }, [config, status]);

  const speak = useCallback(async (text: string) => {
    if (status !== "ready" || !clientRef.current) return;
    try {
      const result = await clientRef.current.speak(text);
      if (result && "success" in result && result.success === false) {
        setStatus("error");
        setErrorMessage("3D 主管暫時無法發話。");
      }
    } catch {
      setStatus("error");
      setErrorMessage("3D 主管暫時無法發話。");
    }
  }, [status]);

  const interrupt = useCallback(() => clientRef.current?.interrupt(), []);

  return { status, errorMessage, launch, speak, interrupt };
}
