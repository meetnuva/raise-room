import { compareTranscript } from "../domain/transcript-accuracy";
import type { VoiceLanguage } from "../lib/local-asr";

export function TranscriptComparison({
  reference,
  actual,
  language,
}: {
  reference: string;
  actual: string;
  language: VoiceLanguage;
}) {
  const comparison = compareTranscript(reference, actual, language);
  const percentage = comparison.matchRatio === null ? null : Math.round(comparison.matchRatio * 100);

  return (
    <section className="transcript-comparison" aria-label="文字吻合度比較">
      {percentage === null ? <p>請先輸入參考句</p> : <strong>文字吻合度：{percentage}%</strong>}
      <p>參考句：{comparison.normalizedReference}</p>
      <p>辨識句：{comparison.normalizedActual}</p>
      {comparison.distance === 0 ? (
        <p>參考句與辨識句一致</p>
      ) : (
        <p className="transcript-diff" aria-label="文字差異">
          {comparison.parts.map((part, index) => (
            <span className={`diff-${part.type}`} key={`${part.type}-${index}`}>
              {part.type === "delete" ? `−${part.expected}` : part.type === "insert" ? `＋${part.actual}` : part.type === "replace" ? `${part.expected}→${part.actual}` : part.actual}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
