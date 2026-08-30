# Raise Room 高品質語音模型與設定測試設計

狀態：使用者已確認設計方向  
日期：2026-08-30

## 1. 問題與實測證據

目前 Raise Room 固定使用 `onnx-community/whisper-tiny`。真實 Chrome 測試證明麥克風、本機解碼、Web Worker、Perxona Chatbot 與 3D Presenter 的鏈路可用，但辨識品質不足：

- 非受控長錄音曾只辨識成無關短詞。
- 受控短句保留了核心語意、百分比與客戶數，但出現繁簡混用與近音詞錯誤。
- 錯誤文字會立即送給主管，使用者沒有修改機會。
- 現有報告的錄音秒數包含使用者等待與操作時間，不等於純語音活動時間。

問題不是麥克風權限或 Perxona 回覆，而是 tiny 模型、繁中正體化與送出前校正流程不足。

## 2. 目標

1. 以 `whisper-large-v3-turbo` 作為新使用者預設的高品質本機模型。
2. 在獨立「語音設定」頁提供高品質、平衡、快速三種模型。
3. 讓使用者在設定頁用同一句參考文字測試麥克風與各模型。
4. 顯示透明的「文字吻合度」與差異，不顯示模型信心或使用者能力分數。
5. 繁中測試與正式逐字稿都轉成臺灣正體字。
6. 正式會議的語音轉錄先進入可編輯預覽，再由使用者送給主管。
7. 音訊、參考文字、測試結果與轉錄內容不離開裝置、不持久化。
8. 同一時間只允許一個語音模型 Worker，切換與離開頁面時確實終止。

## 3. 非目標

- 不加入預設雲端轉錄或 OpenAI API Key。
- 不把測試文字送給 Perxona Chatbot。
- 不用吻合度評分使用者的口音、能力、自信、誠實或情緒。
- 不做聲紋辨識、說話者身份辨識或錄音保存。
- 不支援任意 Hugging Face model URL；只使用程式碼 allowlist。
- 不在會議進行中切換模型。

## 4. 模型目錄

模型設定以純資料模組集中管理：

```ts
export type AsrModelPresetId = "quality" | "balanced" | "fast";

export interface AsrModelPreset {
  id: AsrModelPresetId;
  label: string;
  modelId: string;
  approximateDownloadMb: number;
  webgpuRequired: boolean;
  webgpuDtype: {
    encoder_model: "fp16" | "fp32";
    decoder_model_merged: "q4";
  };
  wasmDtype?: "q8";
}
```

### 高品質（預設）

- ID：`quality`
- Model：`onnx-community/whisper-large-v3-turbo`
- WebGPU：必要；沒有時選項 disabled 並解釋原因。
- dtype：encoder `fp16`、decoder `q4`。
- 估計下載：約 1.5 GB；UI 必須在下載前顯示。
- 不提供 WASM fallback，避免在不適合的裝置載入數 GB 權重。

### 平衡

- ID：`balanced`
- Model：`onnx-community/whisper-small`
- WebGPU 優先：encoder `fp16`、decoder `q4`，約 390 MB。
- 無 WebGPU 時可使用 `q8` WASM，但 UI 必須標示「可能很慢」。

### 快速

- ID：`fast`
- Model：`onnx-community/whisper-tiny`
- WebGPU：encoder `fp32`、decoder `q4`，約 114 MB。
- 無 WebGPU時沿用 `q8` WASM。

模型權重不打進 repository 或 application bundle；第一次由 Hugging Face 下載，之後由 browser cache 重用。

## 5. 語音設定頁

`AppState` 新增 `settings` view。Setup 頁提供「語音設定」入口；會議中不提供模型切換，避免中途破壞錄音狀態。

設定頁由三區構成：

### 模型選擇

每個 model card 顯示：

- 高品質／平衡／快速名稱。
- 下載大小。
- 速度與記憶體文字說明。
- `全程本機` 標示。
- WebGPU 支援狀態。
- 已選取／已載入／載入中狀態。

高品質為預設選取，但不自動下載。使用者按「載入並測試」或在正式會議按「載入本機語音模型」後才下載。

### 麥克風精準度測試

1. 選擇語言：繁中、English、日本語。
2. 顯示可編輯參考句；繁中預設：

   `除了交付時間，我也讓客訴下降百分之三十，並帶來兩個續約客戶。`

3. 按「開始測試」後才要求麥克風權限。
4. 錄音上限 20 秒，顯示 elapsed countdown；可提前停止。
5. 停止後立刻關閉所有 microphone tracks。
6. 音訊只在 browser memory 解碼為 16 kHz mono samples。
7. Worker 轉錄後顯示原始結果與正體化結果。
8. 顯示參考句、辨識句、文字差異與「文字吻合度」。
9. 可按「重測」或切換模型，用同一句話比較。
10. 按「使用這個模型」只保存 preset ID，不保存音訊、參考句、轉錄或分數。

### 隱私與限制

固定顯示：

- 測試音訊與文字不會送給 Perxona。
- 測試結果不會加入會議逐字稿。
- 文字吻合度只比較兩段文字，不代表說話能力或口音好壞。
- 高品質模型第一次需下載約 1.5 GB。

## 6. 文字吻合度

名稱固定使用「文字吻合度」，不使用「信心分數」或「語音能力分數」。

### 正規化

```ts
normalizeForComparison(text, language)
```

步驟：

1. Unicode NFKC。
2. 繁中模式先以 OpenCC `cn → tw` 轉成臺灣正體。
3. 英文轉小寫；日文保留原字形。
4. 移除 Unicode whitespace 與 punctuation。
5. 保留數字、英文字母、CJK 與假名。
6. 以 Unicode code points，而不是 UTF-16 code units 比較。

### 計算

- 使用 Levenshtein distance。
- 分母：`max(reference code points, 1)`。
- `文字吻合度 = max(0, 1 - distance / denominator) × 100`。
- 四捨五入到整數百分比。
- 參考句為空時不計算，顯示「請先輸入參考句」。

差異 UI 至少標示缺字、增字與替換字；不需引入大型 diff library，使用同一個動態規劃結果回溯即可。

## 7. 臺灣正體轉換

新增 pinned `opencc-js@1.4.1`，只在 `language === "zh"` 使用 `cn → tw`。使用 browser-compatible ESM，優先選擇最小可用 entry，並以 build size readback 決定 full 或 cn2t preset；不得從 CDN 動態載入字典。

轉換位置：

- Settings 測試：Worker complete 後、計算吻合度前。
- 正式會議：Worker complete 後、顯示可編輯預覽前。
- 不轉換英文或日文。
- 保留 raw text 只在當前 React memory，讓使用者展開查看；不持久化。

## 8. 正式會議的送出前預覽

現有 `LocalVoiceControl` 不再直接呼叫 `onTranscript()`。

新流程：

1. 本機轉錄完成。
2. 顯示 editable textarea，預填正體化文字。
3. 顯示「送給主管」「重新錄音」「取消」。
4. 只有按「送給主管」才 append user turn 並呼叫 `/api/manager/reply`。
5. edited text 進逐字稿；raw ASR text 不進逐字稿。
6. delivery metadata 保留 model preset、language、recording duration；不得包含音訊。

使用者可以修正專有詞，例如客訴、續約與公司名稱，再送給主管。

## 9. 設定儲存

localStorage key：`raise-room-voice-settings-v1`。

只保存：

```json
{ "modelPreset": "quality" }
```

讀取時只接受三個 allowlisted ID；缺少、無效或舊資料回到 `quality`。不保存模型 URL、參考句、測試文字、分數或權限狀態。

## 10. Worker 與記憶體生命週期

Worker request contract 增加 preset：

```ts
{ type: "load", preset: AsrModelPresetId }
{ type: "transcribe", requestId, preset, audio, language }
{ type: "close" }
```

規則：

- Worker 只接受 allowlist preset，不能接受任意 model URL。
- 同一 Worker runtime 只載入一個 preset。
- 切換 preset：先停止錄音、destroy 舊 client／Worker，再建立新 Worker。
- Settings 離開頁面、Meeting 結束或元件 unmount：terminate Worker。
- microphone track 必須在推論開始前停止。
- 單回合仍只分析最後 30 秒。
- UI 提供「釋放語音模型」按鈕，明確 terminate Worker。

Transformers.js 4.2.0 有公開 WebGPU 長音訊記憶體成長報告。因現有 app 使用不同的非 timestamped 手動 generation path，不能直接宣稱同一 bug 必然發生，也不能忽略風險。驗收必須加入至少 10 次、每次 20 秒的同一頁 soak test：

- 無 crash／invalid buffer／頁面 reload。
- 每次結束都停止 mic tracks。
- 若 Chrome GPU memory 持續無界成長，quality 模式不得標成正式 ready；需改用 worker-per-turn、本機 native companion 或暫時限制回合數，並在 UI 揭露。

## 11. 錯誤與 fallback

- 沒有 WebGPU：quality disabled；提供 balanced／fast，不 silent fallback。
- 模型下載失敗：顯示 model name、可重試與改選模型；不自動換模型。
- 模型切換時正在錄音：禁止切換，先停止或取消錄音。
- 權限拒絕：維持設定頁並顯示 browser permission 說明，不自動重試。
- 轉錄為空：不建立吻合度、不送給主管，可重錄。
- OpenCC 轉換失敗：顯示 raw transcript，阻止自動送出，但仍允許使用者手動編輯。
- 模型造成記憶體錯誤：terminate Worker，顯示建議選 balanced／fast。

## 12. 元件與模組邊界

新增：

- `src/domain/asr-models.ts`：preset catalog、allowlist、availability。
- `src/domain/transcript-accuracy.ts`：normalization、Levenshtein、diff、match ratio。
- `src/lib/voice-settings.ts`：localStorage validation。
- `src/lib/traditional-chinese.ts`：OpenCC wrapper。
- `src/components/VoiceSettings.tsx`：設定頁與 accuracy test orchestration。
- `src/components/VoiceTranscriptPreview.tsx`：正式會議 editable preview。

修改：

- `src/App.tsx`：settings view、persisted preset handoff。
- `src/lib/local-asr.ts`：worker message contract。
- `src/workers/whisper.worker.ts`：preset allowlist、runtime selection。
- `src/hooks/use-local-voice.ts`：preset、20 秒 settings test、preview result。
- `src/components/LocalVoiceControl.tsx`：meeting preview/confirm flow。
- `src/domain/meeting.ts`：delivery metadata 增加 model preset，但不改 report scoring。

每個模組只有一項責任；Settings test 不依賴 Perxona client，Meeting preview 不負責 model loading。

## 13. 測試策略

### Pure tests

- preset catalog default、allowlist、WebGPU availability。
- invalid localStorage migration。
- OpenCC 简体→臺灣正體。
- Unicode normalization、CER、empty text、中文／英文／日文。
- diff substitutions／insertions／deletions。

### Worker/client tests

- load request 必須帶 allowlisted preset。
- quality 使用 large-v3-turbo + WebGPU dtype。
- quality 無 WebGPU 時回明確 error，不 fallback。
- model switch destroys previous Worker。
- close rejects pending work and terminates Worker。

### UI tests

- Settings 只有使用者點擊才下載模型／要求 mic。
- 20 秒上限、自動停止、tracks cleanup。
- 測試 transcript 不呼叫 Perxona／不進 meeting。
- 「使用這個模型」只保存 preset ID。
- Meeting ASR 不自動送出；edited preview 才送。

### 真實 browser acceptance

使用同一位使用者、同一支麥克風、同一句繁中參考句，依序測 tiny、small、large-v3-turbo，記錄：

- 首次下載時間與 cache 後載入時間。
- 轉錄時間。
- 文字吻合度與差異。
- raw／正體化文字。
- mic track cleanup。
- external requests 只限模型下載來源；測試音訊不 outbound。
- large-v3-turbo 必須能在目標 M1 Pro／16 GB Chrome 完成至少一次測試。

結果不預設 large 一定勝出；若同句實測未改善，就不能只因模型名稱較大而保留預設。

## 14. 驗收條件

- 新使用者預設選到 high-quality，但沒有自動下載。
- Settings 可切換三個模型並持久化選擇。
- quality 在 WebGPU 裝置可載入並完成測試。
- 無 WebGPU 時 quality 清楚 disabled。
- Settings 測試可顯示參考句、raw、正體化、diff 與文字吻合度。
- 正式會議語音必須先預覽／編輯再送主管。
- 測試音訊與文字不會送到 server／Perxona。
- 轉錄後 microphone tracks 全部停止。
- 切換、離開與釋放模型時 Worker 終止。
- 全量 tests、build、release gate 與 10-turn soak test 通過。

## 15. 官方來源

- Hugging Face Transformers.js 官方 WebGPU Whisper example：<https://github.com/huggingface/transformers.js-examples/blob/main/realtime-whisper-webgpu/src/worker.js>
- Transformers.js WebGPU guide：<https://github.com/huggingface/transformers.js/blob/main/packages/transformers/docs/source/guides/webgpu.md>
- `whisper-large-v3-turbo` Transformers.js model：<https://huggingface.co/onnx-community/whisper-large-v3-turbo>
- Transformers.js 4.2.0 WebGPU memory issue：<https://github.com/huggingface/transformers.js/issues/1739>
- opencc-js 1.4.1 browser API：<https://github.com/nk2028/opencc-js>
- OpenAI cloud alternative（本設計不啟用）：<https://developers.openai.com/api/docs/models/gpt-4o-transcribe>
