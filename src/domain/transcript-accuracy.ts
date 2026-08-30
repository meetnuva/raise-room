import type { VoiceLanguage } from "../lib/local-asr";
import { toTaiwanTraditional } from "../lib/traditional-chinese";

export interface TranscriptDiffPart {
  type: "equal" | "insert" | "delete" | "replace";
  expected: string;
  actual: string;
}

export function normalizeTranscriptText(text: string, language: VoiceLanguage): string {
  const normalized = (language === "zh" ? toTaiwanTraditional(text) : text).normalize("NFKC");
  const cased = language === "en" ? normalized.toLowerCase() : normalized;
  return Array.from(cased).filter((character) => /[\p{L}\p{N}]/u.test(character)).join("");
}

function backtrace(reference: string[], actual: string[], table: number[][]): TranscriptDiffPart[] {
  const parts: TranscriptDiffPart[] = [];
  let row = reference.length;
  let column = actual.length;

  while (row > 0 || column > 0) {
    if (row > 0 && column > 0 && reference[row - 1] === actual[column - 1]) {
      parts.push({ type: "equal", expected: reference[row - 1], actual: actual[column - 1] });
      row -= 1;
      column -= 1;
    } else if (
      row > 0 &&
      column > 0 &&
      table[row][column] === table[row - 1][column - 1] + 1
    ) {
      parts.push({ type: "replace", expected: reference[row - 1], actual: actual[column - 1] });
      row -= 1;
      column -= 1;
    } else if (row > 0 && table[row][column] === table[row - 1][column] + 1) {
      parts.push({ type: "delete", expected: reference[row - 1], actual: "" });
      row -= 1;
    } else {
      parts.push({ type: "insert", expected: "", actual: actual[column - 1] });
      column -= 1;
    }
  }

  return parts.reverse();
}

export function compareTranscript(reference: string, actual: string, language: VoiceLanguage) {
  const normalizedReference = normalizeTranscriptText(reference, language);
  const normalizedActual = normalizeTranscriptText(actual, language);
  const expected = Array.from(normalizedReference);
  const received = Array.from(normalizedActual);
  const table = Array.from({ length: expected.length + 1 }, () => Array<number>(received.length + 1).fill(0));

  for (let row = 0; row <= expected.length; row += 1) table[row][0] = row;
  for (let column = 0; column <= received.length; column += 1) table[0][column] = column;
  for (let row = 1; row <= expected.length; row += 1) {
    for (let column = 1; column <= received.length; column += 1) {
      table[row][column] = expected[row - 1] === received[column - 1]
        ? table[row - 1][column - 1]
        : Math.min(table[row - 1][column] + 1, table[row][column - 1] + 1, table[row - 1][column - 1] + 1);
    }
  }

  const distance = table[expected.length][received.length];
  const matchRatio = expected.length === 0
    ? null
    : Math.max(0, Math.min(1, 1 - distance / Math.max(expected.length, 1)));

  return {
    normalizedReference,
    normalizedActual,
    distance,
    matchRatio,
    parts: backtrace(expected, received, table),
  };
}
