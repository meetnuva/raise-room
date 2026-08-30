import { useState } from "react";
import type { VoiceTranscriptResult } from "../hooks/use-local-voice";

export function VoiceTranscriptPreview({
  result,
  disabled = false,
  onConfirm,
  onRetry,
  onCancel,
}: {
  result: VoiceTranscriptResult;
  disabled?: boolean;
  onConfirm(editedText: string): void;
  onRetry(): void;
  onCancel(): void;
}) {
  const [editedText, setEditedText] = useState(result.text);
  const trimmed = editedText.trim();
  return (
    <section className="voice-transcript-preview" aria-labelledby="voice-preview-title">
      <h3 id="voice-preview-title">確認要送給主管的文字</h3>
      <label>
        送給主管前可修改的文字
        <textarea aria-label="送給主管前可修改的文字" value={editedText} onChange={(event) => setEditedText(event.target.value)} disabled={disabled} />
      </label>
      {result.rawText !== result.text && <details><summary>查看原始辨識結果</summary><p>{result.rawText}</p></details>}
      <div className="voice-preview-actions">
        <button type="button" disabled={disabled || !trimmed} onClick={() => onConfirm(trimmed)}>送給主管</button>
        <button type="button" disabled={disabled} onClick={onRetry}>重新錄音</button>
        <button type="button" disabled={disabled} onClick={onCancel}>取消</button>
      </div>
    </section>
  );
}
