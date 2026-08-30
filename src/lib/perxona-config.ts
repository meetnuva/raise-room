import type { ManagerPresentation } from "../domain/practice-settings";

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

export type PresenterCatalog = Readonly<Partial<Record<ManagerPresentation, PresenterRuntimeConfig>>>;

const defaultPresenterUrl = "https://cdn.perxona.ai/asia/prod/latest/widget/entry/presenter.js";

function readPresenterRuntimeConfigForTarget(
  env: Record<string, string | undefined>,
  avatarId: string,
  voiceId: string,
): PresenterRuntimeConfig {
  const publishableKey = env.VITE_PERXONA_CONNECT_PUBLISHABLE_KEY?.trim();
  if (!publishableKey) return { enabled: false, reason: "missing-key" };
  const target = {
    avatarId,
    sceneId: env.VITE_PERXONA_SCENE_ID?.trim() ?? "",
    voiceId,
  };
  if (!target.avatarId || !target.sceneId || !target.voiceId) return { enabled: false, reason: "missing-target" };
  return { enabled: true, publishableKey, presenterUrl: env.VITE_PRESENTER_URL?.trim() || defaultPresenterUrl, target };
}

export function readPresenterRuntimeConfig(env: Record<string, string | undefined>): PresenterRuntimeConfig {
  return readPresenterRuntimeConfigForTarget(
    env,
    env.VITE_PERXONA_AVATAR_ID?.trim() ?? "",
    env.VITE_PERXONA_VOICE_ID?.trim() ?? "",
  );
}

export function readPresenterCatalog(env: Record<string, string | undefined>): PresenterCatalog {
  const maleAvatarId = env.VITE_PERXONA_MALE_AVATAR_ID?.trim() || env.VITE_PERXONA_AVATAR_ID?.trim() || "";
  const maleVoiceId = env.VITE_PERXONA_MALE_VOICE_ID?.trim() || env.VITE_PERXONA_VOICE_ID?.trim() || "";

  return {
    male: readPresenterRuntimeConfigForTarget(env, maleAvatarId, maleVoiceId),
    female: readPresenterRuntimeConfigForTarget(
      env,
      env.VITE_PERXONA_FEMALE_AVATAR_ID?.trim() ?? "",
      env.VITE_PERXONA_FEMALE_VOICE_ID?.trim() ?? "",
    ),
  };
}

export function selectPresenterConfig(
  catalog: PresenterCatalog,
  presentation: ManagerPresentation,
): PresenterRuntimeConfig {
  return catalog[presentation] ?? { enabled: false, reason: "missing-target" };
}

export function isPresenterPresentationAvailable(
  catalog: PresenterCatalog,
  presentation: ManagerPresentation,
): boolean {
  return selectPresenterConfig(catalog, presentation).enabled;
}
