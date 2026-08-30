import {
  getEventOffsetSeconds,
  type Scenario,
  type ScheduledEvent,
} from "./scenario";
import type { AsrModelPresetId } from "./asr-models";
import type { VoiceLanguage } from "../lib/local-asr";

interface BaseTranscriptTurn {
  text: string;
  elapsedSeconds: number;
  delivery?: TurnDelivery;
}

export interface UserTranscriptTurn extends BaseTranscriptTurn {
  speaker: "user";
  managerSource?: never;
}

export interface ManagerTranscriptTurn extends BaseTranscriptTurn {
  speaker: "manager";
  managerSource?: ManagerReply["source"];
  managerNotice?: string;
}

export type TranscriptTurn = UserTranscriptTurn | ManagerTranscriptTurn;

export interface TurnDelivery {
  source: "text" | "voice";
  durationSeconds?: number;
  modelPreset?: AsrModelPresetId;
  language?: VoiceLanguage;
}

export interface MeetingState {
  scenario: Scenario;
  durationSeconds: number;
  elapsedSeconds: number;
  transcript: TranscriptTurn[];
  emittedEventIds: string[];
}

export interface ManagerReply {
  text: string;
  source: "perxona" | "simulated";
  notice?: string;
}

export interface ManagerResponder {
  reply(input: {
    scenario: Scenario;
    transcript: TranscriptTurn[];
    dueEvents: ScheduledEvent[];
  }): Promise<ManagerReply>;
}

export function createMeeting(
  scenario: Scenario,
  durationSeconds: number,
): MeetingState {
  return {
    scenario,
    durationSeconds,
    elapsedSeconds: 0,
    transcript: [],
    emittedEventIds: [],
  };
}

export function advanceMeeting(
  state: MeetingState,
  elapsedSeconds: number,
): MeetingState {
  const nextElapsedSeconds = Math.max(state.elapsedSeconds, elapsedSeconds);
  const dueEvents = state.scenario.events.filter(
    (event) =>
      getEventOffsetSeconds(event, state.durationSeconds) <= nextElapsedSeconds &&
      !state.emittedEventIds.includes(event.id),
  );

  return {
    ...state,
    elapsedSeconds: nextElapsedSeconds,
    emittedEventIds: [...state.emittedEventIds, ...dueEvents.map((event) => event.id)],
  };
}

export function appendUserTurn(
  state: MeetingState,
  text: string,
  delivery?: TurnDelivery,
): MeetingState {
  return {
    ...state,
    transcript: [
      ...state.transcript,
      { speaker: "user", text, elapsedSeconds: state.elapsedSeconds, ...(delivery ? { delivery } : {}) },
    ],
  };
}

export async function respondToUser(
  state: MeetingState,
  scenario: Scenario,
  responder: ManagerResponder,
): Promise<MeetingState> {
  const dueEvents = scenario.events.filter((event) =>
    state.emittedEventIds.includes(event.id),
  );
  const reply = await responder.reply({
    scenario,
    transcript: state.transcript,
    dueEvents,
  });

  return {
    ...state,
    transcript: [
      ...state.transcript,
      {
        speaker: "manager",
        text: reply.text,
        elapsedSeconds: state.elapsedSeconds,
        managerSource: reply.source,
        ...(reply.notice ? { managerNotice: reply.notice } : {}),
      },
    ],
  };
}

export const simulatedResponder: ManagerResponder = {
  async reply({ scenario, transcript, dueEvents }) {
    const latestEvent = dueEvents[dueEvents.length - 1];

    if (latestEvent) {
      return {
        text: latestEvent.instruction,
        source: "simulated",
      };
    }

    if (transcript[transcript.length - 1]?.speaker === "user") {
      return {
        text: "請以具體成果說明這次薪資調整請求。",
        source: "simulated",
      };
    }

    return {
      text: "我們開始吧，請說明你希望討論的薪資調整。",
      source: "simulated",
    };
  },
};
