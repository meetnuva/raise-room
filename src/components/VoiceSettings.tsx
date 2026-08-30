import { useEffect, useRef, useState } from "react";
import { asrModelPresets, isPresetAvailable, type AsrModelPresetId } from "../domain/asr-models";
import { compareTranscript } from "../domain/transcript-accuracy";
import { useLocalVoice, type VoiceTranscriptResult } from "../hooks/use-local-voice";
import type { VoiceLanguage } from "../lib/local-asr";
import { TranscriptComparison } from "./TranscriptComparison";

const defaultReference: Record<VoiceLanguage, string> = {
  zh: "除了交付時間，我也讓客訴下降百分之三十，並帶來兩個續約客戶。",
  en: "I improved delivery and reduced customer complaints by thirty percent.",
  ja: "納期を守り、顧客からの苦情を三十パーセント減らしました。",
};

type TestResult = VoiceTranscriptResult & ReturnType<typeof compareTranscript>;

export function VoiceSettings({
  savedPreset,
  onSave,
  onBack,
  hasWebGpu = typeof navigator !== "undefined" && "gpu" in navigator,
}: {
  savedPreset: AsrModelPresetId;
  onSave(preset: AsrModelPresetId): void;
  onBack(): void;
  hasWebGpu?: boolean;
}) {
  const [selectedPreset, setSelectedPreset] = useState(savedPreset);
  const voice = useLocalVoice({ modelPreset: selectedPreset });
  const [language, setLanguage] = useState<VoiceLanguage>("zh");
  const [referenceText, setReferenceText] = useState(defaultReference.zh);
  const [referenceEdited, setReferenceEdited] = useState(false);
  const [resultsByPreset, setResultsByPreset] = useState<Partial<Record<AsrModelPresetId, TestResult>>>({});
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    voice.releaseModel();
  }, [voice.releaseModel]);

  useEffect(() => {
    if (voice.status !== "recording" || timer.current !== null) return;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void stopTest();
    }, 20_000);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
  });

  const selectLanguage = (next: VoiceLanguage) => {
    setLanguage(next);
    if (!referenceEdited) setReferenceText(defaultReference[next]);
  };

  const stopTest = async () => {
    const result = await voice.stopAndTranscribe();
    if (!result) return;
    setResultsByPreset((current) => ({
      ...current,
      [selectedPreset]: { ...result, ...compareTranscript(referenceText, result.text, result.language) },
    }));
  };

  const model = asrModelPresets[selectedPreset];
  const result = resultsByPreset[selectedPreset];
  const unavailable = !isPresetAvailable(selectedPreset, hasWebGpu);

  return (
    <section className="voice-settings" aria-labelledby="voice-settings-title">
      <div className="section-heading">
        <p className="eyebrow">全程本機</p>
        <h2 id="voice-settings-title">語音模型與麥克風測試</h2>
        <p>測試音訊與文字不會送給 Perxona，也不會加入會議逐字稿。</p>
      </div>
      <fieldset className="asr-model-cards">
        <legend>選擇本機語音模型</legend>
        {(Object.keys(asrModelPresets) as AsrModelPresetId[]).map((id) => {
          const preset = asrModelPresets[id];
          const available = isPresetAvailable(id, hasWebGpu);
          return (
            <label className={id === selectedPreset ? "asr-model-card selected" : "asr-model-card"} key={id}>
              <input
                type="radio"
                name="asr-model"
                value={id}
                checked={id === selectedPreset}
                disabled={!available || voice.status === "recording" || voice.status === "transcribing"}
                onChange={() => setSelectedPreset(id)}
              />
              <strong>{preset.label}</strong>
              <span>{preset.approximateDownloadMb >= 1000 ? "1.5 GB" : `${preset.approximateDownloadMb} MB`}</span>
              <span>{preset.description}</span>
              <span>全程本機</span>
              {!available && <span>需要 WebGPU</span>}
            </label>
          );
        })}
      </fieldset>
      {!hasWebGpu && <p role="status">此裝置不支援 WebGPU，高品質模型無法使用。</p>}
      <section className="microphone-test" aria-labelledby="microphone-test-title">
        <h3 id="microphone-test-title">麥克風精準度測試</h3>
        <label>
          語音語言
          <select aria-label="測試語音語言" value={language} onChange={(event) => selectLanguage(event.target.value as VoiceLanguage)}>
            <option value="zh">繁中</option><option value="en">English</option><option value="ja">日本語</option>
          </select>
        </label>
        <label>
          參考句
          <textarea value={referenceText} onChange={(event) => { setReferenceEdited(true); setReferenceText(event.target.value); }} />
        </label>
        <div aria-live="polite">
          {voice.status === "idle" && <button disabled={unavailable} type="button" onClick={voice.loadModel}>載入並測試</button>}
          {voice.status === "loading-model" && <p>正在載入 {model.label} 模型</p>}
          {voice.status === "ready" && <button type="button" onClick={() => void voice.startRecording()}>開始測試</button>}
          {voice.status === "recording" && <button type="button" onClick={() => void stopTest()}>停止測試（最多 20 秒）</button>}
          {voice.status === "transcribing" && <p>正在本機轉錄</p>}
          {voice.errorMessage && <p role="alert">{voice.errorMessage}</p>}
        </div>
        {result && <>
          {result.rawText !== result.text && <details><summary>查看原始辨識結果</summary><p>{result.rawText}</p></details>}
          <TranscriptComparison reference={referenceText} actual={result.text} language={language} />
        </>}
      </section>
      <p>文字吻合度只比較兩段文字，不代表說話能力或口音好壞。</p>
      <p>高品質模型第一次需下載約 1.5 GB。</p>
      <div className="voice-settings-actions">
        <button type="button" onClick={voice.releaseModel}>釋放語音模型</button>
        <button type="button" onClick={() => onSave(selectedPreset)}>使用這個模型</button>
        <button type="button" onClick={onBack}>返回情境設定</button>
      </div>
    </section>
  );
}
