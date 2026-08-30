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
