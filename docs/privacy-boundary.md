# 資料與隱私邊界

Raise Room 是私人練習工具，不是雇主評分、招募篩選、謊言偵測或心理判定系統。

## 目前資料位置

- 原始視訊預設不會離開裝置。只有直接點擊後取得的 camera stream 會指派給本機 `<video>` 預覽；不讀取、抽樣、分析、上傳或保存 frame。
- 關閉鏡頭與元件卸載都會停止所有 MediaStream tracks，釋放裝置。
- 本機語音只有在使用者明確按下載入模型、開始說話後才會啟用。音訊不會上傳或保存；每段停止時立即關閉麥克風 tracks，僅在 browser memory 內解碼並轉錄最後 30 秒。
- `onnx-community/whisper-tiny` 模型檔首次由 Hugging Face Hub 下載，大小依套件與量化檔而異，之後由瀏覽器快取重用；這不是「零網路」宣告。WebGPU 優先，沒有 WebGPU 時可使用較慢的 WASM fallback。
- 報告只由逐字稿 delivery metadata 推導語音秒數、字元／分鐘與固定填充詞計數；字元／分鐘不可跨繁中、英文、日文比較，且不產生自信、誠實、情緒或任何心理／人格分數。
- 本局逐字稿只存在 React memory，關閉或重新整理頁面後就會消失。
- 情境設定的本機草稿只保存在目前瀏覽器，方便再次開啟設定頁時使用。
- Raise Room 沒有自有後端、雲端儲存或資料傳送。明確啟用的 Perxona Presenter 會直接與其官方服務互動，使用 Publishable Key、設定 target 與 deterministic 主管回覆文字；不會傳送 camera stream 或 frame。

## 未來整合的要求

任何未來第三方資料流都必須在傳送前清楚說明資料類型、目的、接收方與保留期間，並取得使用者明確同意。若加入持久化資料，必須同時提供一鍵刪除所有相關資料的功能。
