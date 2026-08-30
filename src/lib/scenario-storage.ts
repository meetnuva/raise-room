import {
  defaultScenario,
  pressureEventRatios,
  type Scenario,
  type ScheduledEvent,
} from "../domain/scenario";

const draftStorageKey = "raise-room-scenario-draft";

type StoredEvent = Pick<ScheduledEvent, "id" | "label" | "instruction">;

function isStoredEvent(event: unknown): event is StoredEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    typeof (event as StoredEvent).id === "string" &&
    typeof (event as StoredEvent).label === "string" &&
    typeof (event as StoredEvent).instruction === "string"
  );
}

function migrateEvents(events: unknown): ScheduledEvent[] {
  if (
    !Array.isArray(events) ||
    events.length !== pressureEventRatios.length ||
    !events.every(isStoredEvent)
  ) {
    throw new Error("Invalid scenario draft events");
  }

  return pressureEventRatios.map((triggerRatio, index) => {
    const event = events[index];

    return {
      id: event.id,
      triggerRatio,
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
      const parsed = JSON.parse(draft) as Scenario;

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
