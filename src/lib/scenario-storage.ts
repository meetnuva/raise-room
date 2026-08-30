import {
  defaultScenario,
  pressureEventRatios,
  type PressureEventRatio,
  type Scenario,
  type ScheduledEvent,
} from "../domain/scenario";

const draftStorageKey = "raise-room-scenario-draft";

type LegacyScheduledEvent = Omit<ScheduledEvent, "triggerRatio"> & {
  minute: number;
};

function migrateEvents(
  events: Array<ScheduledEvent | LegacyScheduledEvent>,
): ScheduledEvent[] {
  return events.map((event, index) => {
    if ("triggerRatio" in event) {
      return event;
    }

    return {
      id: event.id,
      triggerRatio: pressureEventRatios[index] as PressureEventRatio,
      label: event.label,
      instruction: event.instruction,
    };
  });
}

export function readScenarioDraft(
  storage: Pick<Storage, "getItem" | "removeItem">,
): Scenario {
  try {
    const draft = storage.getItem(draftStorageKey);
    if (draft) {
      const parsed = JSON.parse(draft) as Scenario & {
        events: Array<ScheduledEvent | LegacyScheduledEvent>;
      };

      return {
        ...parsed,
        manager: {
          ...parsed.manager,
          customInstructions:
            typeof parsed.manager?.customInstructions === "string"
              ? parsed.manager.customInstructions
              : defaultScenario.manager.customInstructions,
        },
        events: migrateEvents(parsed.events),
      };
    }
  } catch {
    storage.removeItem(draftStorageKey);
  }

  return defaultScenario;
}

export function writeScenarioDraft(
  storage: Pick<Storage, "setItem">,
  scenario: Scenario,
): void {
  storage.setItem(draftStorageKey, JSON.stringify(scenario));
}

export function clearScenarioDraft(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(draftStorageKey);
}
