export type PerxonaConfig =
  | { enabled: false }
  | { enabled: true; publishableKey: string };

export function readPerxonaConfig(
  env: Record<string, string | undefined>,
): PerxonaConfig {
  const publishableKey = env.VITE_PERXONA_CONNECT_PUBLISHABLE_KEY?.trim();

  return publishableKey
    ? { enabled: true, publishableKey }
    : { enabled: false };
}

export interface PerxonaTarget {
  avatarId: string;
  sceneId: string;
  voiceId: string;
}

export type PresenterRuntimeConfig =
  | { enabled: false; reason: "missing-key" | "missing-target" }
  | { enabled: true; publishableKey: string; presenterUrl: string; target: PerxonaTarget };

const defaultPresenterUrl = "https://cdn.perxona.ai/asia/prod/latest/widget/entry/presenter.js";

export function readPresenterRuntimeConfig(env: Record<string, string | undefined>): PresenterRuntimeConfig {
  const publishableKey = env.VITE_PERXONA_CONNECT_PUBLISHABLE_KEY?.trim();
  if (!publishableKey) return { enabled: false, reason: "missing-key" };
  const target = {
    avatarId: env.VITE_PERXONA_AVATAR_ID?.trim() ?? "",
    sceneId: env.VITE_PERXONA_SCENE_ID?.trim() ?? "",
    voiceId: env.VITE_PERXONA_VOICE_ID?.trim() ?? "",
  };
  if (!target.avatarId || !target.sceneId || !target.voiceId) return { enabled: false, reason: "missing-target" };
  return { enabled: true, publishableKey, presenterUrl: env.VITE_PRESENTER_URL?.trim() || defaultPresenterUrl, target };
}
