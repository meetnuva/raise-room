# Raise Room

Raise Room 是以本機優先為原則的私人薪資檢討練習空間。你可以設定情境、進行文字模擬會議，並在結束後查看能回到逐字稿的教練建議。

> 狀態：公開的 [Raise Room GitHub repository](https://github.com/meetnuva/raise-room)。main remote SHA 已 readback，GitHub CI 已成功；local-first fallback 仍是未設定或暫時失敗時的明確替代路徑。

查看 [架構](docs/architecture.md)、[貢獻指南](CONTRIBUTING.md)、[安全性政策](SECURITY.md)、[變更紀錄](CHANGELOG.md) 與 [MIT License](LICENSE)。

## 安裝

```bash
npm install
cp .env.example .env.local
```

## 開發

```bash
npm run dev
```

開發 server 固定只監聽 `127.0.0.1`，不支援 `--host` 或跨網路存取。未建立或未設定 Perxona Chatbot 時，會議仍可完整使用本機腳本 fallback，並明確顯示來源。

## 測試與建置

```bash
npm test
npm run build
npm run start
```

需要 Node `>=24.13.1`。`npm run start` 會從 `dist` 提供 production build，仍只監聽 loopback。

## 目前 MVP 能力

- 在瀏覽器內設定薪資檢討情境與本機草稿，並以首頁、會前準備室、正式談判、會後報告四段流程進行練習。
- 透過文字或明確啟動的本機語音輸入進行模擬會議，保留本局逐字稿；已設定的 Perxona Chatbot 可作為動態主管，否則使用明確標示的本機腳本 fallback。
- 依逐字稿中的具體請求、量化成果、拒絕後回應與下一步，產生附證據連結的會後教練報告；可從報告再練一次（回到會前準備室）或返回首頁。

## 排程與會前準備

- 每次完整載入或重新整理都建立「嚴格下一個整點」的練習：17:05 會排到 18:00；即使恰為 18:00:00，也會排到 19:00。SPA 內切換首頁、設定與準備室不會重算；只有完整重新整理，或首頁停留到原排程結束後才會建立下一場。
- 可在設定中儲存 5、10 或 20 分鐘。開始時間維持下一個嚴格整點，結束時間、談判倒數與五個壓力事件同步更新；事件依 10%、30%、50%、70%、90% 的比例觸發。
- 點擊首頁卡片會進入會前準備室，而不是直接開始。可在排定時間前按「立即進入會議室」；這會開始完整設定長度，右側會固定說明「可以提早開始談判」。
- 設定對話框有七個分頁：音訊、視訊、語音模型、主管角色、主管個性、會議與隱私。取消不會寫入草稿；只有儲存才會變更首頁會議時間。男性／女性是可選的主管呈現，只有各自完整的 allowlisted Presenter 設定才可使用，絕不把未設定的女性選項改接男性角色。
- 選取的麥克風與鏡頭裝置只存在目前 React session，不寫入 localStorage。lobby 預設不請求權限；使用者直接按「允許鏡頭與麥克風」後才要求 combined permission，拒絕時仍可進入文字輸入 fallback。

正式談判保留大型主管舞台、使用者本機預覽與可開關的會議資訊側欄；側欄集中逐字稿、壓力事件與本機視覺觀察。離開談判後進入報告，報告的「再練一次」回到 lobby，「返回首頁」結束本局。

## 不提供的能力

- 雲端儲存、雇主評分、招募篩選、謊言偵測或心理判定。

## Local-first

會議逐字稿只保留在目前的 React memory；關閉或重新整理頁面後不會保留。情境草稿只存在此瀏覽器的本機草稿。Perxona 動態主管啟用時，browser 只會同源呼叫本機 server；Secret Key 只在 Node process environment。詳見 [資料與隱私邊界](docs/privacy-boundary.md)、[Perxona 整合邊界](docs/perxona-integration.md) 與 [Chatbot setup contract](docs/perxona-chatbot-setup.md)。

## Phase 3：可設定的本機語音

設定頁預設選取「高品質」`onnx-community/whisper-large-v3-turbo`，但不會自動下載；必須按「載入並測試」或會議中的「載入本機語音模型」。高品質首次約 1.5 GB，且必須使用 WebGPU；裝置不支援時會明確 disabled，絕不暗中切換。平衡 `whisper-small`（約 390 MB）與快速 `whisper-tiny`（約 114 MB）優先使用 WebGPU，實際初始化失敗才可改用較慢的 q8 WASM。

設定頁可用繁中、English 或日本語的參考句做最長 20 秒麥克風測試，顯示正體化文字、差異與「文字吻合度」。這是兩段文字的比對，不是口音、能力或信心評分。模型選擇只保存 preset ID；測試音訊、參考句、結果和分數都只存在當前 memory，絕不送給 Perxona。

會議錄音最多分析最後 30 秒；只有在使用者按「開始說話」的單一回合才建立 `MediaRecorder`。若已在 lobby 明確允許裝置，錄音會使用同一份仍啟用的麥克風 track，不再要求第二次 `getUserMedia`；停止回合只停止 recorder，不會停止 session track。辨識結果會先進入可編輯預覽，只有確認「送給主管」後，修改過的文字才會加入逐字稿並傳給動態主管。報告只讀取已確認逐字稿的可觀察 metadata；字元／分鐘不可跨語言比較。真實裝置 ASR、Presenter 與完整 20 分鐘談判仍待最終 Chrome acceptance。

## Phase 4：可選本機視覺觀察

先直接開啟本機鏡頭，再點擊「載入本機視覺模型」與「開始本機視覺觀察」。模型檔首次從 Google MediaPipe 固定網址下載；MediaPipe WASM loader 與 binary 則從 pinned `@mediapipe/tasks-vision@1.0.1` 以 Vite build asset 載入。這不是完全離線宣告，真實 camera permission 仍須在 browser 內即時同意。

觀察預設每秒 5 次，且同時只處理一張影格。影格只會傳入同頁 Web Worker，worker 會立刻縮減成一筆可觀察數值並關閉 ImageBitmap；不保存或上傳影格與 landmarks。報告只保留本局 aggregate counts／ratios：臉部可見率、置中率、距離穩定率，以及鏡頭方向近似率。

- 置中：臉部中心 X 為 0.35–0.65、Y 為 0.25–0.65。
- 距離穩定：臉部 bounds 面積比例為 0.08–0.45。
- 鏡頭方向近似：478 個點齊備時，以雙眼 iris 相對眼角的平均水平偏移判定，偏移不超過 0.35。

iris 幾何近似不等於眼神接觸；所有數值都不能作 HR、雇主或招募用途，亦不是情緒、誠實、自信或能力分數。

## Phase 2：可選鏡頭與 Perxona Presenter

會議中的「開啟我的鏡頭」只會在你直接點擊後請求權限，影像只在本機 `<video>` 預覽。`getUserMedia` 必須在安全內容（HTTPS 或 localhost）中使用；`http://lvh.me` 不足以同時驗證鏡頭權限。

若要使用 3D 主管，請由 `.env.example` 複製設定，填入 Publishable Key、共用 Scene，以及男／女主管各自的 Avatar、Voice ID。男主管的新變數未填時才會使用舊的 Avatar／Voice 變數；女主管不會使用男主管或舊變數。角色設定不完整時會被停用，不會改用另一個角色。會議主管仍會使用已設定的 Perxona 動態主管，或在未設定／暫時失敗時顯示本機腳本 fallback。Secret Key 不可放入任何 `VITE_` 前端變數。

Presenter 可在 lobby 先載入 SDK 並驗證連線；真正的 Presenter stage 只在 meeting mount。這不代表真實裝置上的 Presenter、對嘴、表情、獨立動作、聲學音訊品質、鏡頭／麥克風／視覺 permission E2E 或完整 20 分鐘 session 已驗收；以上仍待最終 Chrome acceptance。
