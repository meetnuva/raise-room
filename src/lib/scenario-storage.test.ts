import { defaultScenario } from "../domain/scenario";
import {
  clearScenarioDraft,
  readScenarioDraft,
  writeScenarioDraft,
} from "./scenario-storage";

const draftStorageKey = "raise-room-scenario-draft";

test("migrates legacy event minutes to ratios by event index", () => {
  const legacyScenario = {
    ...defaultScenario,
    events: defaultScenario.events.map((event, index) => ({
      id: `legacy-${index}`,
      minute: [1, 3, 5, 7, 9][index],
      label: `標籤 ${index}`,
      instruction: `指令 ${index}`,
    })),
  };
  const storage = new Map<string, string>([
    [draftStorageKey, JSON.stringify(legacyScenario)],
  ]);

  const scenario = readScenarioDraft({
    getItem: (key) => storage.get(key) ?? null,
    removeItem: (key) => storage.delete(key),
  });

  expect(scenario.events).toEqual([
    { id: "legacy-0", triggerRatio: 0.1, label: "標籤 0", instruction: "指令 0" },
    { id: "legacy-1", triggerRatio: 0.3, label: "標籤 1", instruction: "指令 1" },
    { id: "legacy-2", triggerRatio: 0.5, label: "標籤 2", instruction: "指令 2" },
    { id: "legacy-3", triggerRatio: 0.7, label: "標籤 3", instruction: "指令 3" },
    { id: "legacy-4", triggerRatio: 0.9, label: "標籤 4", instruction: "指令 4" },
  ]);
});

test("assigns approved ratios by index instead of trusting persisted ratios", () => {
  const persistedScenario = {
    ...defaultScenario,
    events: defaultScenario.events.map((event, index) => ({
      id: `persisted-${index}`,
      triggerRatio: 0.42,
      label: `保留標籤 ${index}`,
      instruction: `保留指令 ${index}`,
    })),
  };
  const storage = new Map<string, string>([
    [draftStorageKey, JSON.stringify(persistedScenario)],
  ]);

  const scenario = readScenarioDraft({
    getItem: (key) => storage.get(key) ?? null,
    removeItem: (key) => storage.delete(key),
  });

  expect(scenario.events).toEqual([
    { id: "persisted-0", triggerRatio: 0.1, label: "保留標籤 0", instruction: "保留指令 0" },
    { id: "persisted-1", triggerRatio: 0.3, label: "保留標籤 1", instruction: "保留指令 1" },
    { id: "persisted-2", triggerRatio: 0.5, label: "保留標籤 2", instruction: "保留指令 2" },
    { id: "persisted-3", triggerRatio: 0.7, label: "保留標籤 3", instruction: "保留指令 3" },
    { id: "persisted-4", triggerRatio: 0.9, label: "保留標籤 4", instruction: "保留指令 4" },
  ]);
});

test.each([
  ["omits events", undefined],
  ["stores a non-array events value", {}],
  ["stores more than five events", [...defaultScenario.events, defaultScenario.events[0]]],
  [
    "stores malformed event text",
    defaultScenario.events.map((event, index) =>
      index === 2 ? { ...event, label: 42 } : event,
    ),
  ],
])("fails closed when a draft %s", (_description, events) => {
  const removedKeys: string[] = [];
  const storage = {
    getItem: () => JSON.stringify({ ...defaultScenario, events }),
    removeItem: (key: string) => removedKeys.push(key),
  };

  expect(readScenarioDraft(storage)).toBe(defaultScenario);
  expect(removedKeys).toEqual([draftStorageKey]);
});

test("removes only the scenario draft when its JSON is corrupt", () => {
  const removedKeys: string[] = [];
  const storage = {
    getItem: (key: string) => (key === draftStorageKey ? "{" : null),
    removeItem: (key: string) => removedKeys.push(key),
  };

  expect(readScenarioDraft(storage)).toBe(defaultScenario);
  expect(removedKeys).toEqual([draftStorageKey]);
});

test("writes and clears a scenario draft", () => {
  const writes: Array<[string, string]> = [];
  const removals: string[] = [];

  writeScenarioDraft(
    { setItem: (key, value) => writes.push([key, value]) },
    defaultScenario,
  );
  clearScenarioDraft({ removeItem: (key) => removals.push(key) });

  expect(writes).toEqual([[draftStorageKey, JSON.stringify(defaultScenario)]]);
  expect(removals).toEqual([draftStorageKey]);
});
