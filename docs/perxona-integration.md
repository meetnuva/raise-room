# Perxona 整合邊界

第一階段 MVP 尚未接線 Perxona adapter，也不會載入 Presenter、發送網路請求或使用任何 API 金鑰。

## 設定界線

- `.env.example` 只提供 `VITE_PERXONA_CONNECT_PUBLISHABLE_KEY` 的空白欄位。
- Publishable key 只能用於日後允許的用戶端設定；目前讀取設定不會啟用任何整合。
- Secret Key 必須只存在伺服器端；不得放入前端環境變數、文件、測試、Git 或使用者裝置可讀取的設定檔。

## 日後啟用前的關卡

任何後續整合都必須維持 Raise Room 的 domain restriction：不得把私人練習改成雇主評分、招募篩選、謊言偵測或心理判定。接上 Presenter 前，也必須先完成角色顯示、對嘴、表情、場景、聲音與動作的驗收關卡，並再次明示所有第三方資料流。
