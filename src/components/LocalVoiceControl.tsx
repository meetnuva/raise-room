import { useState } from "react";
import { useLocalVoice, type VoiceTranscriptResult } from "../hooks/use-local-voice";
import type { AsrModelPresetId } from "../domain/asr-models";
import { VoiceTranscriptPreview } from "./VoiceTranscriptPreview";

type Props = {
  voice?: ReturnType<typeof useLocalVoice>;
  onTranscript(result: VoiceTranscriptResult, editedText: string): void;
  disabled?: boolean;
  modelPreset?: AsrModelPresetId;
};

type ViewProps = {
  voice: ReturnType<typeof useLocalVoice>;
  onTranscript(result: VoiceTranscriptResult, editedText: string): void;
  disabled?: boolean;
};

function getStatusText(voice: ViewProps["voice"]): string {
  if (voice.status === "denied") {
    return "你尚未允許麥克風權限，仍可使用文字輸入。";
  }

  if (voice.status === "unsupported") {
    return "此瀏覽器不支援本機語音轉錄，仍可使用文字輸入。";
  }

  return voice.errorMessage ?? "本機語音轉錄發生問題，仍可使用文字輸入。";
}

function LocalVoiceControlView({ voice, onTranscript, disabled = false }: ViewProps) {
  const [pendingResult, setPendingResult] = useState<VoiceTranscriptResult | null>(null);
  const submit = async () => {
    const result = await voice.stopAndTranscribe();
    if (result) setPendingResult(result);
  };

  if (pendingResult) {
    return <VoiceTranscriptPreview
      result={pendingResult}
      disabled={disabled}
      onConfirm={(editedText) => { onTranscript(pendingResult, editedText); setPendingResult(null); }}
      onRetry={() => { setPendingResult(null); voice.cancel(); }}
      onCancel={() => { setPendingResult(null); voice.cancel(); }}
    />;
  }

  if (voice.status === "idle") {
    return (
      <div className="local-voice-control">
        <label>
          語音語言
          <select
            aria-label="語音語言"
            disabled={disabled}
            value={voice.language}
            onChange={(event) => voice.setLanguage(event.target.value as "zh" | "en" | "ja")}
          >
            <option value="zh">繁中</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </label>
        <p>音訊不會上傳，模型檔首次由 Hugging Face 下載</p>
        <button disabled={disabled} type="button" onClick={voice.loadModel}>
          載入本機語音模型
        </button>
      </div>
    );
  }

  if (voice.status === "loading-model") {
    const loadingText = voice.progress === null
      ? "正在載入本機模型"
      : `正在下載模型 ${Math.round(voice.progress * 100)}%`;

    return (
      <div className="local-voice-control" role="status">
        <p>{loadingText}</p>
        <p>首次會下載模型，之後由瀏覽器快取。</p>
      </div>
    );
  }

  if (voice.status === "ready") {
    return (
      <div className="local-voice-control">
        <button disabled={disabled} type="button" onClick={() => void voice.startRecording()}>
          開始說話
        </button>
      </div>
    );
  }

  if (voice.status === "recording") {
    return (
      <div className="local-voice-control recording">
        <strong>麥克風使用中</strong>
        <button type="button" onClick={() => void submit()}>
          停止並轉成文字
        </button>
        <button type="button" onClick={voice.cancel}>取消</button>
      </div>
    );
  }

  if (voice.status === "transcribing") {
    return (
      <div className="local-voice-control" role="status">
        正在本機轉錄{voice.partialText ? `：${voice.partialText}` : ""}
      </div>
    );
  }

  return (
    <div className="local-voice-control" role="status">
      {getStatusText(voice)}
    </div>
  );
}

function OwnedLocalVoiceControl(props: Omit<Props, "voice">) {
  const voice = useLocalVoice({ modelPreset: props.modelPreset });
  return <LocalVoiceControlView {...props} voice={voice} />;
}

export function LocalVoiceControl(props: Props) {
  if (props.voice) {
    return <LocalVoiceControlView {...props} voice={props.voice} />;
  }

  return <OwnedLocalVoiceControl {...props} />;
}
