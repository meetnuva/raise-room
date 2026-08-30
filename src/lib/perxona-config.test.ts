import { readPerxonaConfig } from "./perxona-config";

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
