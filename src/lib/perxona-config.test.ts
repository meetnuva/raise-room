import {
  isPresenterPresentationAvailable,
  readPerxonaConfig,
  readPresenterCatalog,
  readPresenterRuntimeConfig,
  selectPresenterConfig,
} from "./perxona-config";

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

test("disables both presenter presentations when the publishable key is missing", () => {
  const catalog = readPresenterCatalog({
    VITE_PERXONA_MALE_AVATAR_ID: "male-avatar",
    VITE_PERXONA_FEMALE_AVATAR_ID: "female-avatar",
    VITE_PERXONA_SCENE_ID: "shared-scene",
    VITE_PERXONA_MALE_VOICE_ID: "male-voice",
    VITE_PERXONA_FEMALE_VOICE_ID: "female-voice",
  });

  expect(selectPresenterConfig(catalog, "male")).toEqual({ enabled: false, reason: "missing-key" });
  expect(selectPresenterConfig(catalog, "female")).toEqual({ enabled: false, reason: "missing-key" });
  expect(isPresenterPresentationAvailable(catalog, "male")).toBe(false);
  expect(isPresenterPresentationAvailable(catalog, "female")).toBe(false);
});

test("uses the legacy avatar and voice only for the male presentation", () => {
  const catalog = readPresenterCatalog({
    VITE_PERXONA_CONNECT_PUBLISHABLE_KEY: " publishable-key ",
    VITE_PERXONA_AVATAR_ID: " legacy-male-avatar ",
    VITE_PERXONA_SCENE_ID: " shared-scene ",
    VITE_PERXONA_VOICE_ID: " legacy-male-voice ",
  });

  expect(selectPresenterConfig(catalog, "male")).toEqual({
    enabled: true,
    publishableKey: "publishable-key",
    presenterUrl: "https://cdn.perxona.ai/asia/prod/latest/widget/entry/presenter.js",
    target: { avatarId: "legacy-male-avatar", sceneId: "shared-scene", voiceId: "legacy-male-voice" },
  });
  expect(selectPresenterConfig(catalog, "female")).toEqual({ enabled: false, reason: "missing-target" });
  expect(isPresenterPresentationAvailable(catalog, "male")).toBe(true);
  expect(isPresenterPresentationAvailable(catalog, "female")).toBe(false);
});

test("enables both presentations from their allowlisted variables", () => {
  const catalog = readPresenterCatalog({
    VITE_PERXONA_CONNECT_PUBLISHABLE_KEY: " publishable-key ",
    VITE_PERXONA_MALE_AVATAR_ID: " male-avatar ",
    VITE_PERXONA_FEMALE_AVATAR_ID: " female-avatar ",
    VITE_PERXONA_SCENE_ID: " shared-scene ",
    VITE_PERXONA_MALE_VOICE_ID: " male-voice ",
    VITE_PERXONA_FEMALE_VOICE_ID: " female-voice ",
  });

  expect(selectPresenterConfig(catalog, "male")).toMatchObject({
    enabled: true,
    target: { avatarId: "male-avatar", sceneId: "shared-scene", voiceId: "male-voice" },
  });
  expect(selectPresenterConfig(catalog, "female")).toMatchObject({
    enabled: true,
    target: { avatarId: "female-avatar", sceneId: "shared-scene", voiceId: "female-voice" },
  });
  expect(isPresenterPresentationAvailable(catalog, "male")).toBe(true);
  expect(isPresenterPresentationAvailable(catalog, "female")).toBe(true);
});

test("does not fall back from an incomplete female presentation to male or legacy targets", () => {
  const catalog = readPresenterCatalog({
    VITE_PERXONA_CONNECT_PUBLISHABLE_KEY: "publishable-key",
    VITE_PERXONA_MALE_AVATAR_ID: "male-avatar",
    VITE_PERXONA_MALE_VOICE_ID: "male-voice",
    VITE_PERXONA_AVATAR_ID: "legacy-male-avatar",
    VITE_PERXONA_SCENE_ID: "shared-scene",
    VITE_PERXONA_VOICE_ID: "legacy-male-voice",
    VITE_PERXONA_FEMALE_AVATAR_ID: "female-avatar",
  });

  const female = selectPresenterConfig(catalog, "female");

  expect(female).toEqual({ enabled: false, reason: "missing-target" });
  expect(JSON.stringify(female)).not.toContain("male-avatar");
  expect(JSON.stringify(female)).not.toContain("legacy-male-avatar");
  expect(isPresenterPresentationAvailable(catalog, "female")).toBe(false);
});
