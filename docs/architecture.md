# 架構

Raise Room 是單一 Node 24、Vite 與 React 的本機 Preview 專案。開發與 production server 都只監聽 loopback，沒有 hosted multi-tenant 宣告。

```text
Browser UI
├─ Local: scenario draft, transcript memory, Whisper worker, MediaPipe worker
├─ Same-origin: /api/manager/status + /api/manager/reply
└─ Optional Presenter: Publishable Key + target
        │
Loopback Node server ── Secret Key ──> Perxona Chatbot
```

## 資料流與 fallback

- 情境草稿與本局逐字稿由 browser memory／本機草稿處理；重新整理不會保留逐字稿。
- Whisper 與 MediaPipe 只在使用者明確操作後載入；音訊、影格及 landmark 不會送往 Node server。
- browser 只會以同源 API 取得動態主管狀態或回覆。未設定完整 server 環境時，UI 顯示本機腳本 fallback。
- Optional Presenter 只在完整 Publishable Key 與 target 已設定、且使用者明確啟動時載入。Secret Key 不會進入 browser。

詳見 [資料與隱私邊界](privacy-boundary.md)、[Perxona 整合邊界](perxona-integration.md) 與 [架構決策](decisions)。
