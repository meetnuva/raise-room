import type { TranscriptTurn } from "./meeting";

export interface DeliverySignals {
  voiceTurnCount: number;
  totalVoiceDurationSeconds: number;
  charactersPerMinute: number | null;
  fillerWordCount: number;
  fillerWords: Array<{ word: string; count: number }>;
}

const fillers = ["嗯", "呃", "就是", "然後", "那個"];

export function createDeliverySignals(transcript: TranscriptTurn[]): DeliverySignals {
  const voiceTurns = transcript.filter((turn) => turn.speaker === "user" && turn.delivery?.source === "voice");
  const totalVoiceDurationSeconds = voiceTurns.reduce((total, turn) => {
    const duration = turn.delivery?.durationSeconds;
    return Number.isFinite(duration) && (duration ?? 0) > 0 ? total + (duration ?? 0) : total;
  }, 0);
  const characters = voiceTurns.reduce((total, turn) => total + turn.text.replace(/\s/g, "").length, 0);
  const fillerWords = fillers.map((word) => ({
    word,
    count: voiceTurns.reduce((total, turn) => total + (turn.text.match(new RegExp(word, "g"))?.length ?? 0), 0),
  }));
  return {
    voiceTurnCount: voiceTurns.length,
    totalVoiceDurationSeconds,
    charactersPerMinute: totalVoiceDurationSeconds > 0 ? (characters / totalVoiceDurationSeconds) * 60 : null,
    fillerWordCount: fillerWords.reduce((total, item) => total + item.count, 0),
    fillerWords,
  };
}
