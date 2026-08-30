# Perxona 整合邊界

Phase 2 可選擇載入 Perxona `<sv-presenter>`。只有完整的 Publishable Key、Avatar ID、Scene ID、Voice ID 設定存在時，才會在使用者按下「啟動 3D 主管」後載入官方 CDN 模組。

## 設定界線

- `.env.example` 僅含公開 URL 與空白的 Publishable Key／target ID 欄位。
- 初始化固定依官方順序：使用者點擊後先 `resumeAudioPlayback()`，再以 Publishable Key 與 `{ avatarId, sceneId, voiceId }` 呼叫 `initializeWithConnectKey()`。
- Publishable Key 必須設定正確的 domain restriction；不完整或被拒絕時不重試，保留文字 fallback。
- Secret Key 必須只存在伺服器端；不得放入前端環境變數、文件、測試、Git 或使用者裝置可讀取的設定檔。

## 已驗收的本機整合

- `nuva-raise-room-secret`（Secret、unrestricted）與 `nuva-raise-room-local`（Publishable、僅 `raise-room.localhost`）已建立，均在 2026-11-28 到期；所有值與 IDs 僅在 ignored `.env.local`。
- 暫時的 built-in male-finance avatar、office/training scene 與可用中文的 confident male voice 已達 Presenter `Ready`，只顯示一個 avatar。
- 一個真實 Chatbot 回合已進入逐字稿並由 Presenter 發話；驗收時沒有 error logs。
- React StrictMode 的 destroy-before-engine-load race 已修正；驗收 DOM 只保留一個 `sv-presenter`。

這個範圍不包含 custom VRoid、對嘴、表情、獨立動作、聲學音訊品質、麥克風／鏡頭／視覺 permission E2E 或完整 device-enabled 十分鐘 session；它們仍待獨立驗收。

## 動態主管（Phase 5）

- browser 只會呼叫同源的 `POST /api/manager/reply`；本機 Node server 固定監聽 `127.0.0.1`，不設定 CORS，也不接受外部 host。
- server 以 `PERXONA_CONNECT_SECRET_KEY` 對官方 Chatbot chat endpoint 使用 `X-Connect-Key`；Secret Key 不會回傳、記錄或編入 Vite bundle。
- 只有 `PERXONA_API_BASE_URL`、`PERXONA_CONNECT_SECRET_KEY`、`PERXONA_CHATBOT_ID` 都存在，`GET /api/manager/status` 才會回 `configured: true`。缺少任何一個時，UI 使用明確標示的本機腳本 fallback。
- 送往 Perxona 的資料是這一局的情境設定、目前逐字稿與已發生的壓力事件；不會送出 camera stream、影格、麥克風音訊或語音 metadata。server 不記錄 request body、逐字稿或 upstream response。
- 專用 Chatbot 是一次性人工 setup，詳見 [perxona-chatbot-setup.md](perxona-chatbot-setup.md)。程式不會建立、更新或 PATCH 共用 Chatbot。

## 待驗收關卡

任何後續整合都必須維持 Raise Room 的 domain restriction：不得把私人練習改成雇主評分、招募篩選、謊言偵測或心理判定。驗收 custom VRoid 與其他未完成能力前，必須再次明示所有第三方資料流。

## 疑難排解

Presenter 外部 SDK 若出現 i18next warning，屬非阻斷 warning；在已驗收流程中未伴隨 error log。若同時出現 `CONNECT_KEY_REJECTED`、其他 console error 或 UI 異常，仍須視為阻斷問題重新檢查設定與流程。
