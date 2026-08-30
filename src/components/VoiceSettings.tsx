import { useCallback, useEffect, useRef, useState } from "react";
import { asrModelPresets, isPresetAvailable, type AsrModelPresetId } from "../domain/asr-models";
import { compareTranscript } from "../domain/transcript-accuracy";
import { useLocalVoice, type VoiceTranscriptResult } from "../hooks/use-local-voice";
import { hasWebGpuSupport } from "../lib/asr-runtime-config";
import type { VoiceLanguage } from "../lib/local-asr";
import { TranscriptComparison } from "./TranscriptComparison";

const defaultReference: Record<VoiceLanguage, string> = {
  zh: "除了交付時間，我也讓客訴下降百分之三十，並帶來兩個續約客戶。",
  en: "I improved delivery and reduced customer complaints by thirty percent.",
  ja: "納期を守り、顧客からの苦情を三十パーセント減らしました。",
};

type VoiceController = ReturnType<typeof useLocalVoice>;
type TestResult = VoiceTranscriptResult & ReturnType<typeof compareTranscript> & { reference: string };

type VoiceSettingsProps = {
  savedPreset: AsrModelPresetId;
  onSave(preset: AsrModelPresetId): void;
  onBack(): void;
  hasWebGpu?: boolean;
  voice?: VoiceController;
};

type ViewProps = {
  onSave?: (preset: AsrModelPresetId) => void;
  onBack?: () => void;
  hasWebGpu: boolean;
  voice: VoiceController;
  selectedPreset: AsrModelPresetId;
  setSelectedPreset(next: AsrModelPresetId): void;
};

function VoiceSettingsView({
  onSave,
  onBack,
  hasWebGpu,
  voice,
  selectedPreset,
  setSelectedPreset,
}: ViewProps) {
  const [language, setLanguage] = useState<VoiceLanguage>("zh");
  const [referenceText, setReferenceText] = useState(defaultReference.zh);
  const [referenceEdited, setReferenceEdited] = useState(false);
  const [resultsByPreset, setResultsByPreset] = useState<Partial<Record<AsrModelPresetId, TestResult>>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(20);
  const stopInProgress = useRef(false);
  const stopAndTranscribe = voice.stopAndTranscribe;
  const stopTest = useCallback(async () => {
    if (stopInProgress.current) return;
    stopInProgress.current = true;
    const result = await stopAndTranscribe();
    if (result) {
      setResultsByPreset((current) => ({
        ...current,
        [selectedPreset]: {
          ...result,
          ...compareTranscript(referenceText, result.text, result.language),
          reference: referenceText,
        },
      }));
    }
    stopInProgress.current = false;
  }, [referenceText, selectedPreset, stopAndTranscribe]);

  useEffect(() => {
    if (voice.status !== "recording") return;
    const startedAt = performance.now();
    setRemainingSeconds(20);
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil(20 - (performance.now() - startedAt) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0) {
        window.clearInterval(interval);
        void stopTest();
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [stopTest, voice.status]);
  useEffect(() => () => voice.releaseModel(), [voice.releaseModel]);

  const selectLanguage = (next: VoiceLanguage) => {
    setLanguage(next);
    if (!referenceEdited) setReferenceText(defaultReference[next]);
  };
  const selectPreset = (next: AsrModelPresetId) => {
    if (next === selectedPreset || voice.status === "recording" || voice.status === "transcribing") return;
    voice.releaseModel();
    setSelectedPreset(next);
  };
  const model = asrModelPresets[selectedPreset];
  const result = resultsByPreset[selectedPreset];
  const unavailable = !isPresetAvailable(selectedPreset, hasWebGpu);
  const testInProgress = voice.status === "recording" || voice.status === "transcribing";
  return (
    <section className="voice-settings" aria-labelledby="voice-settings-title">
      <div className="section-heading">
        <p className="eyebrow">全程本機</p>
        <h2 id="voice-settings-title">語音模型與麥克風測試</h2>
        <p>測試音訊與文字不會送給 Perxona，也不會加入會議逐字稿。</p>
      </div>
      <fieldset className="asr-model-list">
        <legend>選擇本機語音模型</legend>
        <div className="asr-model-options">
          {(Object.keys(asrModelPresets) as AsrModelPresetId[]).map((id) => {
            const preset = asrModelPresets[id];
            const available = isPresetAvailable(id, hasWebGpu);
            return (
              <label className={id === selectedPreset ? "asr-model-option selected" : "asr-model-option"} key={id}>
                <input
                  checked={id === selectedPreset}
                  disabled={!available || testInProgress}
                  name="asr-model"
                  onChange={() => selectPreset(id)}
                  type="radio"
                  value={id}
                />
                <strong>{preset.label}</strong>
                <span>{preset.approximateDownloadMb >= 1000 ? "1.5 GB" : `${preset.approximateDownloadMb} MB`}</span>
                <span>全程本機</span>
                {!available && <span>需要 WebGPU</span>}
              </label>
            );
          })}
        </div>
        <aside className="voice-model-detail" data-testid="voice-model-detail">
          <strong>{model.label}</strong>
          <span>{model.description}</span>
          {!isPresetAvailable(selectedPreset, hasWebGpu) && <span>需要 WebGPU</span>}
        </aside>
      </fieldset>
      {!hasWebGpu && <p role="status">此裝置不支援 WebGPU，高品質模型無法使用。</p>}
      {!hasWebGpu && <p aria-label="WASM 可能很慢" role="status">平衡與快速模型將使用 WASM，可能很慢。</p>}
      <section className="microphone-test" aria-labelledby="microphone-test-title">
        <h3 id="microphone-test-title">麥克風精準度測試</h3>
        <label>
          語音語言
          <select aria-label="測試語音語言" disabled={testInProgress} value={language} onChange={(event) => selectLanguage(event.target.value as VoiceLanguage)}>
            <option value="zh">繁中</option><option value="en">English</option><option value="ja">日本語</option>
          </select>
        </label>
        <label>
          參考句
          <textarea disabled={testInProgress} maxLength={500} value={referenceText} onChange={(event) => { setReferenceEdited(true); setReferenceText(event.target.value); }} />
        </label>
        <div aria-live="polite">
          {voice.status === "idle" && <button disabled={unavailable} type="button" onClick={voice.loadModel}>載入並測試</button>}
          {voice.status === "loading-model" && <>
            <p>正在載入 {model.label} 模型</p>
            {voice.loadingMessage && <p>{voice.loadingMessage}</p>}
            {voice.progress !== null && <p>{Math.round(voice.progress * 100)}%</p>}
            <button type="button" onClick={voice.releaseModel}>取消載入</button>
          </>}
          {voice.status === "ready" && <button type="button" onClick={() => { setRemainingSeconds(20); void voice.startRecording(); }}>開始測試</button>}
          {voice.status === "recording" && <><p>測試剩餘 {remainingSeconds} 秒</p><button type="button" onClick={() => void stopTest()}>停止測試</button></>}
          {voice.status === "transcribing" && <p>正在本機轉錄</p>}
          {voice.errorMessage && <p role="alert">{voice.errorMessage}</p>}
        </div>
        {result && <>
          {result.rawText !== result.text && <details><summary>查看原始辨識結果</summary><p>{result.rawText}</p></details>}
          <TranscriptComparison reference={result.reference} actual={result.text} language={result.language} />
        </>}
      </section>
      <p>文字吻合度只比較兩段文字，不代表說話能力或口音好壞。</p>
      <p>高品質模型第一次需下載約 1.5 GB。</p>
      {onSave && onBack && <div className="voice-settings-actions">
        <button type="button" onClick={voice.releaseModel}>釋放語音模型</button>
        <button type="button" disabled={unavailable} onClick={() => onSave(selectedPreset)}>使用這個模型</button>
        <button type="button" onClick={onBack}>返回情境設定</button>
      </div>}
    </section>
  );
}

function OwnedVoiceSettingsPanel({
  selectedPreset,
  onSelectedPresetChange,
  hasWebGpu,
}: Omit<VoiceSettingsPanelProps, "voice">) {
  const voice = useLocalVoice({ modelPreset: selectedPreset });
  return <VoiceSettingsView hasWebGpu={hasWebGpu} voice={voice} selectedPreset={selectedPreset} setSelectedPreset={onSelectedPresetChange} />;
}

export type VoiceSettingsPanelProps = {
  selectedPreset: AsrModelPresetId;
  onSelectedPresetChange(id: AsrModelPresetId): void;
  hasWebGpu: boolean;
  voice?: VoiceController;
};

export function VoiceSettingsPanel({ voice, ...props }: VoiceSettingsPanelProps) {
  if (!voice) return <OwnedVoiceSettingsPanel {...props} />;
  return <VoiceSettingsView {...props} voice={voice} setSelectedPreset={props.onSelectedPresetChange} />;
}

function OwnedVoiceSettings(props: Omit<VoiceSettingsProps, "voice" | "hasWebGpu"> & { hasWebGpu: boolean }) {
  const [selectedPreset, setSelectedPreset] = useState(props.savedPreset);
  const voice = useLocalVoice({ modelPreset: selectedPreset });
  return (
    <VoiceSettingsView
      onSave={props.onSave}
      onBack={props.onBack}
      selectedPreset={selectedPreset}
      setSelectedPreset={setSelectedPreset}
      hasWebGpu={props.hasWebGpu}
      voice={voice}
    />
  );
}

function InjectedVoiceSettings(props: VoiceSettingsProps & { voice: VoiceController; hasWebGpu: boolean }) {
  const [selectedPreset, setSelectedPreset] = useState(props.savedPreset);
  return (
    <VoiceSettingsView
      onBack={props.onBack}
      onSave={props.onSave}
      hasWebGpu={props.hasWebGpu}
      selectedPreset={selectedPreset}
      setSelectedPreset={setSelectedPreset}
      voice={props.voice}
    />
  );
}

export function VoiceSettings({ hasWebGpu = typeof navigator !== "undefined" && hasWebGpuSupport(navigator.gpu), ...props }: VoiceSettingsProps) {
  if (props.voice) {
    return <InjectedVoiceSettings {...props} hasWebGpu={hasWebGpu} voice={props.voice} />;
  }

  return <OwnedVoiceSettings {...props} hasWebGpu={hasWebGpu} />;
}
