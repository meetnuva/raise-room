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
