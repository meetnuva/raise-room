import { readPerxonaConfig, readPresenterRuntimeConfig } from "./perxona-config";

test("disables Perxona when the publishable key is missing", () => {
  expect(readPerxonaConfig({})).toEqual({ enabled: false });
});

test("disables Perxona when the publishable key is blank", () => {
  expect(
    readPerxonaConfig({ VITE_PERXONA_CONNECT_PUBLISHABLE_KEY: "   " }),
  ).toEqual({ enabled: false });
});

test("enables Perxona only with a trimmed publishable key", () => {
  expect(
    readPerxonaConfig({ VITE_PERXONA_CONNECT_PUBLISHABLE_KEY: " publishable-demo " }),
  ).toEqual({ enabled: true, publishableKey: "publishable-demo" });
});

test("only enables the presenter with a key and all trimmed target ids", () => {
  expect(readPresenterRuntimeConfig({})).toEqual({ enabled: false, reason: "missing-key" });
  expect(readPresenterRuntimeConfig({ VITE_PERXONA_CONNECT_PUBLISHABLE_KEY: " key " })).toEqual({ enabled: false, reason: "missing-target" });
  expect(readPresenterRuntimeConfig({
    VITE_PERXONA_CONNECT_PUBLISHABLE_KEY: " key ",
    VITE_PERXONA_AVATAR_ID: " avatar ",
    VITE_PERXONA_SCENE_ID: " scene ",
    VITE_PERXONA_VOICE_ID: " voice ",
  })).toEqual({
    enabled: true,
    publishableKey: "key",
    presenterUrl: "https://cdn.perxona.ai/asia/prod/latest/widget/entry/presenter.js",
    target: { avatarId: "avatar", sceneId: "scene", voiceId: "voice" },
  });
});
