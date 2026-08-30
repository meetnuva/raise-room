import { useLocalVoice, type VoiceTranscriptResult } from "../hooks/use-local-voice";

export function LocalVoiceControl({ voice: suppliedVoice, onTranscript, disabled = false }: { voice?: ReturnType<typeof useLocalVoice>; onTranscript(result: VoiceTranscriptResult): void; disabled?: boolean }) {
  const localVoice = useLocalVoice(); const voice = suppliedVoice ?? localVoice;
  const submit = async () => { const result = await voice.stopAndTranscribe(); if (result) onTranscript(result); };
  if (voice.status === "idle") return <div className="local-voice-control"><label>語音語言<select aria-label="語音語言" disabled={disabled} value={voice.language} onChange={(event) => voice.setLanguage(event.target.value as "zh" | "en" | "ja")}><option value="zh">繁中</option><option value="en">English</option><option value="ja">日本語</option></select></label><p>音訊不會上傳，模型檔首次由 Hugging Face 下載</p><button disabled={disabled} type="button" onClick={voice.loadModel}>載入本機語音模型</button></div>;
  if (voice.status === "loading-model") return <div className="local-voice-control" role="status"><p>{voice.progress === null ? "正在載入本機模型" : `正在下載模型 ${Math.round(voice.progress * 100)}%`}</p><p>首次會下載模型，之後由瀏覽器快取。</p></div>;
  if (voice.status === "ready") return <div className="local-voice-control"><button disabled={disabled} type="button" onClick={() => void voice.startRecording()}>開始說話</button></div>;
  if (voice.status === "recording") return <div className="local-voice-control recording"><strong>麥克風使用中</strong><button type="button" onClick={() => void submit()}>停止並轉成文字</button><button type="button" onClick={voice.cancel}>取消</button></div>;
  if (voice.status === "transcribing") return <div className="local-voice-control" role="status">正在本機轉錄{voice.partialText ? `：${voice.partialText}` : ""}</div>;
  const text = voice.status === "denied" ? "你尚未允許麥克風權限，仍可使用文字輸入。" : voice.status === "unsupported" ? "此瀏覽器不支援本機語音轉錄，仍可使用文字輸入。" : voice.errorMessage ?? "本機語音轉錄發生問題，仍可使用文字輸入。";
  return <div className="local-voice-control" role="status">{text}</div>;
}
