# Terra Execution Spec — Raise Room Local Voice + Real Meeting Clock

## OBJECTIVE

完成不需新 Perxona Key 的 Phase 3：會議真正依單調時間源運行 10 分鐘並自動觸發事件；使用者可明確選擇下載本機 Whisper 模型、按下開始／停止說話，音訊只在瀏覽器內解碼與轉錄，轉錄文字沿用既有 deterministic manager flow；報告新增可追溯的語速與填充詞「觀察值」，不產生心理／人格分數。

可觀察成果：在支援的 Chromium 瀏覽器中，使用者能選繁中／英文／日文，載入本機模型，逐回合用麥克風對談；每次停止後釋放 mic tracks、取得文字、寫入 append-only transcript，manager 回覆照常由 Perxona stage（若啟用）朗讀。沒有 WebGPU 時可用 WASM fallback；沒有 Worker／MediaRecorder／AudioContext 時保留文字輸入。

## AUTHORITATIVE SOURCES

- Hugging Face 官方 realtime Whisper WebGPU example：<https://github.com/huggingface/transformers.js-examples/tree/main/realtime-whisper-webgpu>
- 官方 worker source：<https://github.com/huggingface/transformers.js-examples/blob/main/realtime-whisper-webgpu/src/worker.js>
- Transformers.js pipeline docs：<https://huggingface.co/docs/transformers.js/pipelines>
- 模型：`onnx-community/whisper-tiny`（multilingual）。
- MediaRecorder data lifecycle：<https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/dataavailable_event>
- getUserMedia permission：<https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia>
- React effect cleanup：<https://react.dev/reference/react/useEffect>

採用官方核心：Web Worker、16kHz audio、最多 30 秒、Whisper processor／model、WebGPU 優先。不同處：Raise Room 不在 mount 時要求麥克風、不自動下載模型、每個語音 turn 結束即釋放 tracks、worker output 必須通過 boundary validation。

## FILES AND OWNERSHIP

Terra 只擁有：

- 修改 `package.json`
- 修改 `package-lock.json`
- 修改 `README.md`
- 修改 `docs/privacy-boundary.md`
- 修改 `src/domain/meeting.ts`
- 修改 `src/domain/meeting.test.ts`
- 新增 `src/domain/delivery.ts`
- 新增 `src/domain/delivery.test.ts`
- 修改 `src/domain/report.ts`
- 修改 `src/domain/report.test.ts`
- 新增 `src/lib/local-asr.ts`
- 新增 `src/lib/local-asr.test.ts`
- 新增 `src/workers/whisper.worker.ts`
- 新增 `src/hooks/use-local-voice.ts`
- 新增 `src/hooks/use-local-voice.test.tsx`
- 新增 `src/hooks/use-meeting-clock.ts`
- 新增 `src/hooks/use-meeting-clock.test.tsx`
- 新增 `src/components/LocalVoiceControl.tsx`
- 新增 `src/components/LocalVoiceControl.test.tsx`
- 修改 `src/components/MeetingRoom.tsx`
- 修改 `src/components/MeetingRoom.test.tsx`
- 修改 `src/components/CoachingReport.tsx`
- 修改 `src/components/CoachingReport.test.tsx`
- 修改 `src/App.test.tsx`（只做完整 flow regression）
- 修改 `src/styles.css`

不修改 App implementation、Scenario、Perxona Presenter／Camera、ScenarioWorkshop、env files 或 Phase 1/2 plans。你不是唯一在 codebase 工作的人；保留 concurrent edits，不擴張 ownership。

## INTERFACES

### Transcript metadata — additive only

在 `meeting.ts` 新增：

```ts
export interface TurnDelivery {
  source: "text" | "voice";
  durationSeconds?: number;
}

export interface TranscriptTurn {
  speaker: "manager" | "user";
  text: string;
  elapsedSeconds: number;
  delivery?: TurnDelivery;
}

export function appendUserTurn(
  state: MeetingState,
  text: string,
  delivery?: TurnDelivery,
): MeetingState;
```

既有呼叫不傳 delivery 時保持原行為。Voice turn 必須傳 `{source:"voice", durationSeconds}`；text fallback 傳 `{source:"text"}`。Manager turn 不加 delivery。

### Delivery signals

在 `delivery.ts`：

```ts
export interface DeliverySignals {
  voiceTurnCount: number;
  totalVoiceDurationSeconds: number;
  charactersPerMinute: number | null;
  fillerWordCount: number;
  fillerWords: Array<{ word: string; count: number }>;
}

export function createDeliverySignals(
  transcript: TranscriptTurn[],
): DeliverySignals;
```

只統計 user voice turns。duration 必須 finite、>0 才加入分母；中文以去除空白後 Unicode 字元數計，英文／日文同樣只做「字元／分鐘」並在 UI 說明不是語言間可比較分數。填充詞固定且透明：`嗯`、`呃`、`就是`、`然後`、`那個`；回傳每詞 count 與總數。沒有有效 voice duration → `charactersPerMinute:null`。

在 `CoachingReport` 新增：

```ts
deliverySignals: DeliverySignals;
```

`createCoachingReport` 使用 `createDeliverySignals`；既有四項 recommendation 完全不變。

### Worker protocol

在 `local-asr.ts`：

```ts
export type VoiceLanguage = "zh" | "en" | "ja";

export type AsrWorkerRequest =
  | { type: "load" }
  | { type: "transcribe"; requestId: string; audio: Float32Array; language: VoiceLanguage };

export type AsrWorkerEvent =
  | { type: "loading"; progress: number | null; message: string }
  | { type: "ready"; device: "webgpu" | "wasm" }
  | { type: "transcribing"; requestId: string }
  | { type: "partial"; requestId: string; text: string }
  | { type: "complete"; requestId: string; text: string }
  | { type: "error"; requestId?: string; message: string };

export interface WorkerPort {
  postMessage(message: AsrWorkerRequest, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  terminate(): void;
}

export interface LocalAsrClient {
  subscribe(listener: (event: AsrWorkerEvent) => void): () => void;
  load(): void;
  transcribe(audio: Float32Array, language: VoiceLanguage): Promise<string>;
  destroy(): void;
}

export function parseAsrWorkerEvent(value: unknown): AsrWorkerEvent | null;
export function createLocalAsrClient(
  workerFactory?: () => WorkerPort,
): LocalAsrClient;
```

`parseAsrWorkerEvent` 僅接受列出的 type、string、finite progress 0..1、合法 device；非法第三方／worker message 忽略，不 throw、不渲染。

`transcribe` 產生 unique requestId、transfer `audio.buffer`、只 resolve 相同 requestId complete；相同 requestId error reject。destroy reject 所有 pending、移除 listener、terminate。

### Whisper worker

`whisper.worker.ts` 以 `@huggingface/transformers@4.2.0`：

- model id：`onnx-community/whisper-tiny`
- tokenizer + processor + `WhisperForConditionalGeneration`
- WebGPU：encoder fp32、decoder merged q4。
- WASM fallback：使用套件可接受的 q8／q4 組合；若官方 API 不支援指定組合，採套件預設 dtype 並在 report 寫明。
- lazy singleton；只有收到 load 才下載／warm up。
- audio 上限 `16000 * 30` samples，超過取最後 30 秒。
- generation `max_new_tokens:64`、傳 language、skip special tokens。
- progress callback 只轉成 allowlisted loading fields，不把任意 object 傳到 UI。
- 每次 generate 用 try/finally 清 processing；忙碌時回 error，不靜默丟掉。
- worker 不呼叫 Raise Room backend，不上傳 audio；模型檔由 Hugging Face Hub 首次下載並由 browser cache。

### Local voice hook

```ts
export type VoiceStatus =
  | "idle"
  | "loading-model"
  | "ready"
  | "requesting-microphone"
  | "recording"
  | "transcribing"
  | "unsupported"
  | "denied"
  | "error";

export interface VoiceTranscriptResult {
  text: string;
  durationSeconds: number;
  language: VoiceLanguage;
}

export function useLocalVoice(input?: {
  asrClient?: LocalAsrClient;
  mediaDevices?: Pick<MediaDevices, "getUserMedia">;
  mediaRecorderFactory?: (stream: MediaStream) => MediaRecorder;
  audioContextFactory?: () => AudioContext;
  now?: () => number;
}): {
  status: VoiceStatus;
  progress: number | null;
  partialText: string;
  errorMessage: string | null;
  language: VoiceLanguage;
  setLanguage(language: VoiceLanguage): void;
  loadModel(): void;
  startRecording(): Promise<void>;
  stopAndTranscribe(): Promise<VoiceTranscriptResult | null>;
  cancel(): void;
};
```

規則：

- mount 不建立 worker 以外的 external side effect；若 default client 建立 Worker 可以，但不 load model、不請 mic。
- `loadModel` 是直接按鈕行為，顯示「首次會下載模型，之後由瀏覽器快取」。
- start 只在 ready；`getUserMedia({audio:true,video:false})`；NotAllowedError → denied。
- MediaRecorder 收集非空 chunks；stop 後等待 final dataavailable、合成 Blob、AudioContext sampleRate 16000 decode、取 channel 0／最後 30 秒。
- duration 使用 injected monotonic `now()` 差值，不用 timeslice／chunk 數估計。
- 在送 worker 前即停止所有 mic tracks；轉錄完成清 Blob/chunks/AudioContext。
- unmount/cancel 停 recorder、tracks、close context、destroy client；late async completion 不 setState。
- text trim 後空字串回 null 並顯示可重試狀態，不送空 turn。

### Voice UI

`LocalVoiceControl` props：

```ts
{
  voice?: ReturnType<typeof useLocalVoice>;
  onTranscript(result: VoiceTranscriptResult): void;
}
```

預設使用 hook，測試可 inject。UI：

- idle：語言 select（繁中／English／日本語）＋「載入本機語音模型」。
- loading：progress bar（null 時 indeterminate text），說明只下載模型。
- ready：「開始說話」。
- recording：明確紅色文字「麥克風使用中」＋「停止並轉成文字」。
- transcribing：顯示 partial text／「正在本機轉錄」。
- denied／unsupported／error：繁中狀態＋保留文字輸入，不自動重試。
- 不能宣稱「完全離線」直到模型已快取；文案使用「音訊不會上傳，模型檔首次由 Hugging Face 下載」。

### Real meeting clock

```ts
export function useMeetingClock(input: {
  durationSeconds: number;
  onTick(elapsedSeconds: number): void;
  onComplete(): void;
  now?: () => number;
  intervalMs?: number;
}): { elapsedSeconds: number };
```

- mount 記錄 monotonic start；250ms interval 每次用 `(now-start)/1000` floor，不以 tick 次數累加。
- elapsed clamp 0..duration；onTick 只在整秒變更時呼叫。
- complete 精確一次；cleanup clear interval。
- MeetingRoom 使用 onTick → functional `advanceMeeting(current, elapsed)`；onComplete → `onFinish` 最新 transcript，一次。
- 開發「跳到第 3 分鐘」仍保留，但清楚 class/data attribute `development-only`；production 可以保留目前行為，不作完成證據。

### Meeting integration

抽出單一 `submitUserMessage(text, delivery)`，文字與 voice 共用，避免兩套 manager flow。需防止並行 send：一個 manager reply pending 時 disable text submit／voice start，避免 transcript reorder。

`LocalVoiceControl.onTranscript`：

```ts
submitUserMessage(result.text, {
  source: "voice",
  durationSeconds: result.durationSeconds,
});
```

文字 fallback：`{source:"text"}`。

底部麥克風 disabled placeholder 改為 LocalVoiceControl 的 compact trigger／status；camera control 保留唯一一個。

### Report UI

新增「可觀察表達訊號」區：

- 語音回合數。
- 有效語音總秒數。
- 字元／分鐘（null →「本局沒有足夠語音資料」）。
- 填充詞總數與逐詞明細。
- 固定說明：這些是可回看的行為資料，不是自信、誠實或情緒分數；不同語言不可直接比較。

每個數值由 transcript delivery metadata 推導，不讀 raw audio。

## CONSTRAINTS

- 全部 UI／文件繁中；語言 option 名稱可原語言。
- 不使用 Web Speech API，因為它不能保證音訊留在本機。
- 不加入 LLM／Chatbot／MediaPipe／臉部情緒／謊言或自信判定。
- 不保存、上傳或寫入 localStorage 的 audio Blob／Float32Array；轉錄後立即釋放引用。
- 模型下載是唯一新增網路；程式碼／README 必須明示來源、約略大小與快取行為，不能寫「零網路」。
- 只新增 pinned `@huggingface/transformers@4.2.0`；不得新增錄音、state、UI 第三方依賴。
- tests 不建立真 Worker、不下載模型、不要求真 mic。
- 保留所有 Phase 1/2 fallback、camera、Presenter、report recommendation 與 accessibility。
- TDD RED→GREEN；worker protocol、late completion、cleanup、timer complete-once 必須測。

## VERIFICATION

### Domain

```bash
npm test -- src/domain/meeting.test.ts src/domain/delivery.test.ts src/domain/report.test.ts
```

成功：additive metadata、voice-only signals、filler count、null rate、recommendations regression 全通過。

### Worker boundary

```bash
npm test -- src/lib/local-asr.test.ts
```

成功：event parser 拒絕 malformed data、load、request correlation、transfer、error、destroy pending cleanup 全通過；不 import／執行真模型 worker。

### Voice hook/UI

```bash
npm test -- src/hooks/use-local-voice.test.tsx src/components/LocalVoiceControl.test.tsx
```

成功：no auto mic/model load、constraints、duration、track/context cleanup、denied、empty transcript、UI states、language select 全通過。

### Clock/meeting

```bash
npm test -- src/hooks/use-meeting-clock.test.tsx src/components/MeetingRoom.test.tsx src/App.test.tsx
```

成功：monotonic tick、event auto emit、complete once with latest transcript、single in-flight send、text/voice shared path、existing full app flow 通過。

### Report UI

```bash
npm test -- src/components/CoachingReport.test.tsx
```

成功：voice metrics 可見、no-data state、非心理判定說明可見。

### Full

```bash
npm test -- --reporter=verbose
npm run build
git diff --check
git status --short
```

成功：all green、Vite worker build 成功、無 product dirty files。

### Security/source scan

```bash
rg -n "SpeechRecognition|webkitSpeechRecognition|pxc_|PERXONA_CONNECT_SECRET|emotion|honesty|confidence|localStorage.*audio|fetch\(.*audio" src README.md docs/privacy-boundary.md
```

成功：無 Web Speech、Key、心理判定或 audio storage/upload。Whisper worker 只由 Transformers.js 下載 model files。

## DOCUMENTATION

README／privacy doc 必須說明：

- 首次 opt-in 下載 `onnx-community/whisper-tiny`，模型大小依套件／量化檔而異，可能較久。
- audio 不離開瀏覽器；模型檔來自 Hugging Face Hub，快取後可重用。
- WebGPU 優先、WASM fallback 可能較慢。
- 每次錄音最多分析最後 30 秒；停止後立即關閉 mic tracks。
- 支援 zh／en／ja；報告的字元／分鐘不可跨語言比較。
- 真正 Perxona Chatbot／LLM manager 仍需 server-only Secret Key boundary，尚未在此 Phase 實作。

## RETURN

完整報告寫 `.superpowers/terra-voice-report.md`（ignored，不提交），回傳：

```text
IMPLEMENTATION REPORT
STATUS: complete | partial | blocked
OBJECTIVE: one line
CHANGES: actual file-by-file summary
VERIFIED: exact commands + concrete evidence
JUDGMENT CALLS: explicit decisions or none
GAPS: remaining gaps or none
```
