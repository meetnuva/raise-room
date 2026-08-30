# 架構

Raise Room 是單一 Node 24、Vite 與 React 的本機 Preview 專案。開發與 production server 都只監聽 loopback，沒有 hosted multi-tenant 宣告。

```text
Browser UI
├─ Local: scenario draft, settings test memory, transcript memory, Whisper worker, MediaPipe worker
├─ Same-origin: /api/manager/status + /api/manager/reply
└─ Optional Presenter: Publishable Key + target
        │
Loopback Node server ── Secret Key ──> Perxona Chatbot
```

## 排程練習的頁面與資源 owner

`App` 是唯一的頁面狀態 owner。它在文件載入時計算一次嚴格下一個整點的 `ScheduledPracticeMeeting`，保存的長度只接受 5、10、20 分鐘；設定儲存時只重算結束時間，不移動既有開始時間。首頁停留到結束後才建立下一場，lobby、meeting 與 report 不會在背景換場。

```text
App
├─ MeetHome / PracticeSettingsDialog
└─ PracticeSession（只在 lobby 與 meeting 存在）
   ├─ PrejoinLobby
   └─ MeetingRoom → CoachingReport（離開 PracticeSession 後）
```

- `App → PracticeSession → PrejoinLobby／MeetingRoom` 是裝置與模型的所有權鏈。`PracticeSession` 持有一份 `usePracticeMedia` stream 及一份 `useLocalVoice` ASR runtime，並在 lobby 到 meeting 間傳遞同一份 controller；它不跨越 report、首頁或 unmount。
- `PrejoinLobby` 不在 mount 時碰觸裝置。只有明確 permission 動作才向 browser 請求 combined camera／microphone stream；同一 stream 會掛到 meeting 的新 video element，避免第二次 `getUserMedia` 或中斷 tracks。裝置選擇保留在 `App` 的 memory，不持久化。
- Lobby 的 Presenter 檢查只做 SDK preflight／設定連線驗證；不 mount 真正 stage DOM，也不得把「連線已驗證」描述成角色已呈現。`MeetingRoom` 才 mount Presenter，並以可用設定或明確 fallback 顯示主管。
- `MeetingRoom` 以 meeting duration 建立倒數與比例事件；會議資訊側欄擁有逐字稿、壓力事件與視覺觀察的閱讀／控制入口。完成或提前離開時 handoff transcript 與 aggregate visual signals 給 `CoachingReport`；再練一次回 lobby，返回首頁結束本局。

## 資料流與 fallback

- 情境草稿與本局逐字稿由 browser memory／本機草稿處理；重新整理不會保留逐字稿。
- Settings → allowlisted model preset → one Whisper Worker → memory-only 20 秒 test → Taiwan Traditional / text match UI。這條分支不會呼叫 Perxona、Node server 或逐字稿。
- Meeting → one Whisper Worker → memory-only 30 秒 ASR → editable preview → confirmed edited text + source/duration/preset metadata → transcript → optional manager reply。raw ASR text 與音訊不會送往 Node server。
- Whisper 與 MediaPipe 只在使用者明確操作後載入；音訊、影格及 landmark 不會送往 Node server。切換 preset、離開語音設定／會議、釋放模型或 unmount 都會 terminate owned Worker。
- 共享 session track 可在使用者已明確允許後跨 lobby／meeting 保持 enabled。`MediaRecorder` 僅在明確的「開始說話」回合建立，停止後釋放 recorder 與暫存音訊但保留非 owned 的共享 track；離開到 report、返回首頁或 unmount 時，`PracticeSession` dispose tracks 與 ASR runtime。
- browser 只會以同源 API 取得動態主管狀態或回覆。未設定完整 server 環境時，UI 顯示本機腳本 fallback。
- Optional Presenter 只在完整 Publishable Key 與 target 已設定、且使用者明確啟動時載入。Secret Key 不會進入 browser。

## Meet 式互動層與響應式界線

- `HomeChrome`、`ActionMenu`、`Tooltip` 與 `IconButton` 只持有暫時的 UI state；每個選單項目都路由到真實設定、說明、隱私或會議資訊內容。不可用的 action 會以 disabled 與原因揭露，而不是顯示假控制。
- `PracticeSettingsDialog` 使用原生 `<dialog>`、可存取 roving tabs、Escape 與 focus return；Save／Cancel 仍由既有 allowlisted settings owner 處理。CSS 在桌面保留 208px tab rail，在較窄畫面改為可水平捲動的 tabs，並保留固定 footer。
- `MeetingRoom` 的核心六控制固定在 56px 底部列；逐字稿、事件、語音、視覺、裝置與會議資訊都由 `MeetingSidePanel` 呈現。桌面以 360px side panel 推縮舞台，768–1023px 以 320px overlay，手機以 scrim 與 `min(calc(100vw - 24px), 360px)` overlay；這些 UI layers 不寫入逐字稿、報告或外部服務。
- CSS root 定義產品使用的 surface、text、focus、danger、control、scrim 與 motion token，且 reduced-motion media query 會保留最終狀態並將動畫／transition 降至近乎瞬時。

自動化驗證可檢查此互動契約與 CSS 靜態條件，但不取代實機 viewport、focus、z-index 或 20 分鐘 media／ASR acceptance；後者必須由瀏覽器 readback 另行完成。

詳見 [資料與隱私邊界](privacy-boundary.md)、[Perxona 整合邊界](perxona-integration.md) 與 [架構決策](decisions)。
