# 資料與隱私邊界

Raise Room 是私人練習工具，不是雇主評分、招募篩選、謊言偵測或心理判定系統。

## 目前資料位置

- 原始視訊預設不會離開裝置。只有直接點擊後取得的 camera stream 會指派給本機 `<video>` 預覽；尚未點擊「載入本機視覺模型」與「開始本機視覺觀察」前，不讀取或抽樣影格。
- 本機視覺觀察只會在已開鏡頭且使用者明確開始後執行，每秒最多 5 次且同時只有一張影格處理中。ImageBitmap 僅傳入同頁 Web Worker，worker 即時算出臉部可見、置中、距離穩定與 iris 幾何近似的 aggregate counts／ratios，隨即關閉 ImageBitmap；不寫入磁碟、瀏覽器持久儲存、報告或網路，也不保存 landmarks。
- 視覺模型檔首次從 Google MediaPipe 固定網址下載，WASM loader 與 binary 由 pinned `@mediapipe/tasks-vision@1.0.1` 的 Vite build assets 提供；因此不能宣稱完全離線。Face Landmarker 固定關閉 blendshapes 與 transformation matrices，不做臉部辨識、年齡、性別、情緒、誠實、自信或能力推論。
- 視覺報告只顯示本局 aggregate counts／ratios：臉部可見率以所有樣本為分母；置中與距離穩定也以所有樣本為分母；鏡頭方向近似只以 iris 點完整的樣本為分母。iris 幾何近似不等於眼神接觸，所有數值不可作 HR、雇主或招募用途。
- 關閉鏡頭與元件卸載都會停止所有 MediaStream tracks，釋放裝置。
- 本機語音只有在使用者明確按下載入模型、開始說話後才會啟用。音訊不會上傳或保存；每段停止時立即關閉麥克風 tracks，僅在 browser memory 內解碼並轉錄最後 30 秒。
- `onnx-community/whisper-tiny` 模型檔首次由 Hugging Face Hub 下載，大小依套件與量化檔而異，之後由瀏覽器快取重用；這不是「零網路」宣告。WebGPU 優先，沒有 WebGPU 時可使用較慢的 WASM fallback。
- 報告只由逐字稿 delivery metadata 推導語音秒數、字元／分鐘與固定填充詞計數；字元／分鐘不可跨繁中、英文、日文比較，且不產生自信、誠實、情緒或任何心理／人格分數。
- 本局逐字稿只存在 React memory，關閉或重新整理頁面後就會消失。
- 情境設定的本機草稿只保存在目前瀏覽器，方便再次開啟設定頁時使用。
- Raise Room 沒有雲端儲存。它有一個只監聽 `127.0.0.1` 的本機 Node server；未設定動態主管時不會傳送會議資料。設定專用 Perxona Chatbot 後，這個 server 才會以 server-only Secret Key 將情境設定、目前逐字稿與已發生壓力事件送到 Perxona Chatbot，並且不記錄 request body、情境、逐字稿或 upstream response。browser 不會收到 Secret Key、Chatbot ID 或 API base URL。
- 明確啟用的 Perxona Presenter 會直接與其官方服務互動，使用 Publishable Key、設定 target 與主管回覆文字；不會傳送 camera stream 或 frame。

## 未來整合的要求

任何未來第三方資料流都必須在傳送前清楚說明資料類型、目的、接收方與保留期間，並取得使用者明確同意。若加入持久化資料，必須同時提供一鍵刪除所有相關資料的功能。
