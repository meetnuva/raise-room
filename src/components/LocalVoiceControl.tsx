import { useEffect, useRef, useState } from "react";
import { useLocalVoice, type VoiceTranscriptResult } from "../hooks/use-local-voice";
import type { AsrModelPresetId } from "../domain/asr-models";
import { VoiceTranscriptPreview } from "./VoiceTranscriptPreview";

type Props = {
  voice?: ReturnType<typeof useLocalVoice>;
  onTranscript(result: VoiceTranscriptResult, editedText: string): void;
  disabled?: boolean;
  modelPreset?: AsrModelPresetId;
  actionRequest?: number;
};

type ViewProps = {
  voice: ReturnType<typeof useLocalVoice>;
  onTranscript(result: VoiceTranscriptResult, editedText: string): void;
  disabled?: boolean;
  actionRequest?: number;
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

function LocalVoiceControlView({ voice, onTranscript, disabled = false, actionRequest = 0 }: ViewProps) {
  const [pendingResult, setPendingResult] = useState<VoiceTranscriptResult | null>(null);
  const handledActionRequest = useRef(0);
  const submit = async () => {
    const result = await voice.stopAndTranscribe();
    if (result) setPendingResult(result);
  };

  useEffect(() => {
    if (actionRequest === handledActionRequest.current || disabled) return;
    handledActionRequest.current = actionRequest;
    if (voice.status === "ready") {
      void voice.startRecording();
    } else if (voice.status === "recording") {
      void submit();
    } else if (voice.status === "idle") {
      voice.loadModel();
    }
  }, [actionRequest, disabled, voice]);

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
    return (
      <div className="local-voice-control" role="status">
        <p>{voice.loadingMessage ?? "正在載入本機模型"}</p>
        {voice.progress !== null && <p>{Math.round(voice.progress * 100)}%</p>}
        <p>首次會下載模型，之後由瀏覽器快取。</p>
        <button type="button" onClick={voice.releaseModel}>取消載入</button>
      </div>
    );
  }

  if (voice.status === "ready") {
    return (
      <div className="local-voice-control">
        <p>本機語音模型已就緒。使用下方麥克風開始說話。</p>
      </div>
    );
  }

  if (voice.status === "recording") {
    return (
      <div className="local-voice-control recording">
        <strong>麥克風使用中</strong>
        <p>使用下方麥克風停止並轉成文字。</p>
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
