import type { TranscriptTurn } from "./meeting";
import type { Scenario } from "./scenario";

export interface Evidence {
  kind: "transcript" | "missing";
  atSeconds: number;
  text: string;
}

export interface Recommendation {
  id: string;
  title: string;
  summary: string;
  evidence: Evidence;
  retryPrompt: string;
}

export interface NegotiationMapItem {
  id: "request" | "achievement" | "recovery" | "next-step";
  label: string;
  complete: boolean;
}

export interface CoachingReport {
  strengths: Recommendation[];
  practiceTargets: Recommendation[];
  negotiationMap: NegotiationMapItem[];
}

type RecommendationId = NegotiationMapItem["id"];

const recommendationContent: Record<RecommendationId, Omit<Recommendation, "id" | "summary" | "evidence"> & { missing: string; complete: string }> = {
  request: {
    title: "提出具體請求",
    complete: "你已清楚說出希望調整的數字。",
    missing: "逐字稿中尚未出現提出具體請求的內容。",
    retryPrompt: "直接說出你期待的調整數字，並接著說明依據。",
  },
  achievement: {
    title: "量化成果",
    complete: "你已用可核對的成果說明自己的貢獻。",
    missing: "逐字稿中尚未出現量化成果的內容。",
    retryPrompt: "補上一項可量化的成果，例如改善幅度或完成時間。",
  },
  recovery: {
    title: "拒絕後回應",
    complete: "你在預算限制提出後仍繼續推進對話。",
    missing: "逐字稿中尚未出現面對拒絕後的回應。",
    retryPrompt: "聽到預算限制後，先承接限制，再提出可討論的替代方向。",
  },
  "next-step": {
    title: "確認下一步",
    complete: "你已把對話帶向可追蹤的後續安排。",
    missing: "逐字稿中尚未出現確認下一步的內容。",
    retryPrompt: "用何時、由誰回覆或下一次確認時間，收束這次討論。",
  },
};

const negotiationMapLabels: Record<RecommendationId, string> = {
  request: "提出具體請求",
  achievement: "量化成果",
  recovery: "拒絕後回應",
  "next-step": "確認下一步",
};

function numberPattern(value: string): RegExp {
  return new RegExp(`(^|\\D)${value.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(?=\\D|$)`);
}

function findRequestTurn(scenario: Scenario, transcript: TranscriptTurn[]) {
  const userTurns = transcript.filter((turn) => turn.speaker === "user");

  if (scenario.compensation.requestedMonthlySalary === 0) {
    return userTurns.find(
      (turn) => /希望|期待|調整/.test(turn.text) && /\d/.test(turn.text),
    );
  }

  const requestedSalary = scenario.compensation.requestedMonthlySalary;
  const exactNumber = numberPattern(String(requestedSalary));
  const groupedNumber = numberPattern(requestedSalary.toLocaleString("en-US"));

  return userTurns.find(
    (turn) => exactNumber.test(turn.text) || groupedNumber.test(turn.text),
  );
}

function findAchievementTurn(transcript: TranscriptTurn[]) {
  return transcript.find(
    (turn) =>
      turn.speaker === "user" &&
      (/\d/.test(turn.text) || /%|百分之|提升|縮短|增加|減少|節省|成長/.test(turn.text)),
  );
}

function findRecoveryTurn(transcript: TranscriptTurn[]) {
  const refusalIndex = transcript.findIndex(
    (turn) =>
      turn.speaker === "manager" && /預算|凍結|無法|不能|沒有空間/.test(turn.text),
  );

  if (refusalIndex < 0) return undefined;

  return transcript.slice(refusalIndex + 1).find((turn) => turn.speaker === "user");
}

function findNextStepTurn(transcript: TranscriptTurn[]) {
  return transcript.find(
    (turn) => turn.speaker === "user" && /下一步|何時|時間|回覆|確認|再約|追蹤/.test(turn.text),
  );
}

function missingEvidence(transcript: TranscriptTurn[], text: string): Evidence {
  const userTurns = transcript.filter((turn) => turn.speaker === "user");
  const lastUserTurn = userTurns[userTurns.length - 1];

  return {
    kind: "missing",
    atSeconds: lastUserTurn?.elapsedSeconds ?? 0,
    text,
  };
}

function createRecommendation(
  id: RecommendationId,
  transcript: TranscriptTurn[],
  turn: TranscriptTurn | undefined,
): Recommendation {
  const content = recommendationContent[id];
  const evidence = turn
    ? { kind: "transcript" as const, atSeconds: turn.elapsedSeconds, text: turn.text }
    : missingEvidence(transcript, content.missing);

  return {
    id,
    title: content.title,
    summary: turn ? content.complete : content.missing,
    evidence,
    retryPrompt: content.retryPrompt,
  };
}

export function createCoachingReport(
  scenario: Scenario,
  transcript: TranscriptTurn[],
): CoachingReport {
  const completedTurns: Record<RecommendationId, TranscriptTurn | undefined> = {
    request: findRequestTurn(scenario, transcript),
    achievement: findAchievementTurn(transcript),
    recovery: findRecoveryTurn(transcript),
    "next-step": findNextStepTurn(transcript),
  };
  const ids: RecommendationId[] = ["request", "achievement", "recovery", "next-step"];
  const recommendations = ids.map((id) =>
    createRecommendation(id, transcript, completedTurns[id]),
  );

  return {
    strengths: recommendations.filter((recommendation) => recommendation.evidence.kind === "transcript"),
    practiceTargets: recommendations.filter((recommendation) => recommendation.evidence.kind === "missing"),
    negotiationMap: ids.map((id) => ({
      id,
      label: negotiationMapLabels[id],
      complete: Boolean(completedTurns[id]),
    })),
  };
}

export function formatTimestamp(elapsedSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(elapsedSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
