import { useState } from "react";
import {
  createCoachingReport,
  formatTimestamp,
  type Recommendation,
} from "../domain/report";
import type { TranscriptTurn } from "../domain/meeting";
import type { Scenario } from "../domain/scenario";

export function CoachingReport({
  scenario,
  transcript,
  onRetry,
  onReset,
}: {
  scenario: Scenario;
  transcript: TranscriptTurn[];
  onRetry: () => void;
  onReset: () => void;
}) {
  const report = createCoachingReport(scenario, transcript);
  const [selectedEvidence, setSelectedEvidence] = useState<Recommendation | null>(null);

  return (
    <section aria-labelledby="coaching-report-title" className="coaching-report">
      <header className="report-header">
        <p className="eyebrow">本機逐字稿分析</p>
        <h2 id="coaching-report-title">會後教練報告</h2>
        <p>建議只根據這次會議的逐字稿與設定情境產生。</p>
      </header>

      <section aria-labelledby="negotiation-map-title" className="report-section">
        <h3 id="negotiation-map-title">談判地圖</h3>
        <ul className="negotiation-map">
          {report.negotiationMap.map((item) => (
            <li key={item.id} className={item.complete ? "complete" : "incomplete"}>
              {item.label}：{item.complete ? "已完成" : "待練習"}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="delivery-signals-title" className="report-section">
        <h3 id="delivery-signals-title">可觀察表達訊號</h3>
        <p>語音回合數：{report.deliverySignals.voiceTurnCount}</p>
        <p>有效語音總秒數：{report.deliverySignals.totalVoiceDurationSeconds}</p>
        <p>字元／分鐘：{report.deliverySignals.charactersPerMinute === null ? "本局沒有足夠語音資料" : report.deliverySignals.charactersPerMinute.toFixed(1)}</p>
        <p>填充詞總數：{report.deliverySignals.fillerWordCount}</p>
        <ul className="delivery-filler-words">{report.deliverySignals.fillerWords.map((item) => <li key={item.word}>{item.word}：{item.count}</li>)}</ul>
        <p>這些是可回看的行為資料，不是自信、誠實或情緒分數；不同語言不可直接比較。</p>
      </section>

      <div className="report-columns">
        <section aria-labelledby="strengths-title" className="report-section">
          <h3 id="strengths-title">做得好的地方</h3>
          {report.strengths.length === 0 ? (
            <p>本局尚未出現可連結的談判行為。</p>
          ) : (
            <ul className="recommendation-list">
              {report.strengths.map((recommendation) => (
                <li key={recommendation.id}>
                  <h4>{recommendation.title}</h4>
                  <p>{recommendation.summary}</p>
                  <button
                    type="button"
                    onClick={() => setSelectedEvidence(recommendation)}
                  >
                    查看 {formatTimestamp(recommendation.evidence.atSeconds)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="practice-targets-title" className="report-section">
          <h3 id="practice-targets-title">最值得重練</h3>
          <ul className="recommendation-list">
            {report.practiceTargets.map((recommendation) => (
              <li key={recommendation.id}>
                <h4>{recommendation.title}</h4>
                <span className="missing-evidence">本局未出現</span>
                <p>{recommendation.summary}</p>
                <p className="retry-prompt">重練提示：{recommendation.retryPrompt}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {selectedEvidence && (
        <p className="evidence-detail" role="status">
          逐字稿證據：{selectedEvidence.evidence.text}
        </p>
      )}

      <div className="report-actions">
        <button className="retry-meeting" type="button" onClick={onRetry}>再練一次</button>
        <button type="button" onClick={onReset}>重新設定情境</button>
      </div>
    </section>
  );
}
