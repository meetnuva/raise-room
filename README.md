# Raise Room

Raise Room 是以本機優先為原則的私人薪資檢討練習空間。你可以設定情境、進行文字模擬會議，並在結束後查看能回到逐字稿的教練建議。

## 安裝

```bash
npm install
```

## 開發

```bash
npm run dev
npm run dev -- --host
```

## 測試與建置

```bash
npm test
npm run build
```

## 目前 MVP 能力

- 在瀏覽器內設定薪資檢討情境與本機草稿。
- 透過文字輸入進行 deterministic 模擬會議，保留本局逐字稿。
- 依逐字稿中的具體請求、量化成果、拒絕後回應與下一步，產生附證據連結的會後教練報告。
- 用同一情境再練一次，或回到設定頁重新開始。

## 不提供的能力

- 雲端儲存、雇主評分、招募篩選、謊言偵測或心理判定。

## Local-first

會議逐字稿只保留在目前的 React memory；關閉或重新整理頁面後不會保留。情境草稿只存在此瀏覽器的本機草稿。詳見 [資料與隱私邊界](docs/privacy-boundary.md) 與 [Perxona 整合邊界](docs/perxona-integration.md)。

## Phase 3：可選本機語音

可自行選擇繁中、English 或日本語，並按下「載入本機語音模型」。首次 opt-in 會從 Hugging Face Hub 下載 `onnx-community/whisper-tiny`；模型大小依量化檔而異、可能需要一段時間，完成後由瀏覽器快取供後續使用。音訊不會上傳，WebGPU 優先、沒有時使用較慢的 WASM fallback。

每段錄音最多分析最後 30 秒；按下停止後會立即關閉麥克風 tracks，再在瀏覽器內轉錄。報告只讀取逐字稿中的可觀察語音 metadata；字元／分鐘不可跨語言比較。真正的 Perxona Chatbot／LLM manager 仍需要 server-only Secret Key 邊界，這個 Phase 尚未實作。

## Phase 4：可選本機視覺觀察

先直接開啟本機鏡頭，再點擊「載入本機視覺模型」與「開始本機視覺觀察」。模型檔首次從 Google MediaPipe 固定網址下載；MediaPipe WASM 則在安裝時從 pinned `@mediapipe/tasks-vision@1.0.1` 複製到本機 `public/mediapipe/wasm`。這不是完全離線宣告，真實 camera permission 仍須在 browser 內即時同意。

觀察預設每秒 5 次，且同時只處理一張影格。影格只會傳入同頁 Web Worker，worker 會立刻縮減成一筆可觀察數值並關閉 ImageBitmap；不保存或上傳影格與 landmarks。報告只保留本局 aggregate counts／ratios：臉部可見率、置中率、距離穩定率，以及鏡頭方向近似率。

- 置中：臉部中心 X 為 0.35–0.65、Y 為 0.25–0.65。
- 距離穩定：臉部 bounds 面積比例為 0.08–0.45。
- 鏡頭方向近似：478 個點齊備時，以雙眼 iris 相對眼角的平均水平偏移判定，偏移不超過 0.35。

iris 幾何近似不等於眼神接觸；所有數值都不能作 HR、雇主或招募用途，亦不是情緒、誠實、自信或能力分數。

## Phase 2：可選鏡頭與 Perxona Presenter

會議中的「開啟我的鏡頭」只會在你直接點擊後請求權限，影像只在本機 `<video>` 預覽。`getUserMedia` 必須在安全內容（HTTPS 或 localhost）中使用；`http://lvh.me` 不足以同時驗證鏡頭權限。

若要使用 3D 主管，請由 `.env.example` 複製設定，填入 Publishable Key、Avatar、Scene、Voice ID。沒有完整設定時，文字型 deterministic 主管會照常運作。不可把 Secret Key 放入前端。
