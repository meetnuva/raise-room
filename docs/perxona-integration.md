# Perxona 整合邊界

Phase 2 可選擇載入 Perxona `<sv-presenter>`。只有完整的 Publishable Key、Avatar ID、Scene ID、Voice ID 設定存在時，才會在使用者按下「啟動 3D 主管」後載入官方 CDN 模組。

## 設定界線

- `.env.example` 僅含公開 URL 與空白的 Publishable Key／target ID 欄位。
- 初始化固定依官方順序：使用者點擊後先 `resumeAudioPlayback()`，再以 Publishable Key 與 `{ avatarId, sceneId, voiceId }` 呼叫 `initializeWithConnectKey()`。
- Publishable Key 必須設定正確的 domain restriction；不完整或被拒絕時不重試，保留文字 fallback。
- Secret Key 必須只存在伺服器端；不得放入前端環境變數、文件、測試、Git 或使用者裝置可讀取的設定檔。

## 日後啟用前的關卡

任何後續整合都必須維持 Raise Room 的 domain restriction：不得把私人練習改成雇主評分、招募篩選、謊言偵測或心理判定。接上 Presenter 前，也必須先完成角色顯示、對嘴、表情、場景、聲音與動作的驗收關卡，並再次明示所有第三方資料流。
