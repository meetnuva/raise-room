# Task 8｜會前準備室實作紀錄

## RED → GREEN

- RED：`npm test -- src/components/PrejoinLobby.test.tsx --reporter=verbose` 如預期失敗，原因是 `./PrejoinLobby` 尚未存在（1 個 failed suite，尚未執行測試案例）。
- GREEN：`npm test -- src/components/PrejoinLobby.test.tsx src/components/LocalCameraTile.test.tsx src/lib/perxona-presenter.test.ts --reporter=verbose` 通過 3 個 test files、13 個 tests。

## 副作用矩陣

| 時機 | 媒體 | ASR 模型 | Presenter SDK／avatar |
| --- | --- | --- | --- |
| Lobby mount | 不呼叫 `media.request` | 不呼叫 `voice.loadModel` | 不呼叫 preloader、不 mount／initialize／resume audio |
| `允許鏡頭與麥克風` | 只呼叫既有 `media.request` | 無 | 無 |
| 麥克風／鏡頭圓形控制 | 只呼叫既有 toggle | 無 | 無 |
| 載入／取消 ASR | 無 | 只呼叫既有 `loadModel`／`releaseModel` | 無 |
| `檢查 3D 主管` | 無 | 無 | 只呼叫 allowlisted `loadPresenterEngine(url)`；不建立 avatar client |

## Presenter 證據

- 有設定時，明確點擊後才呼叫可注入 preloader，並以設定中的 allowlisted `presenterUrl` 載入；成功顯示 `連線已驗證`。
- 失敗顯示 `3D 主管連線暫時無法驗證`；未設定時按鈕 disabled，狀態為 `尚未設定 3D 主管`。
- Presenter library regression test 確認單獨 preload 後沒有 `sv-presenter` element，因此 lobby 不會 mount 或 initialize avatar。

## 驗證與差異

- Focused test：3 files、13 tests 全數通過。
- `npm run build` 通過（Vite 僅保留既有的大型 chunk 警告，沒有 build error）。
- `git diff --check` 通過。
- 差異只限 Task 8 的 Lobby、LocalCameraTile 外部 stream 預覽、Presenter preload regression test，以及 `.prejoin-*` scoped CSS；未碰 App、MeetingRoom、設定、domain、hooks、config、文件或 credentials。

## 自我審查

- Primary CTA 始終 enabled，沒有以目前時間作為進入 gate；文案精確為 `立即進入會議室` 與 `可以提早開始談判`。
- LocalCameraTile 對外部 stream 僅指派 `video.srcObject`，video 維持 `muted`／`playsInline`，卸載不停止外部 track。
- `scenario` 只供顯示已注入的談判情境主管名稱；未創建任何新的 controller 或 worker。

## 顧慮

- Task 8 是獨立 Lobby；Task 9 仍需把它接入 App 的既有排程／controller lifecycle，才能進行整體瀏覽器 E2E。

## Commit

實作提交 SHA：`268f728da4cd82e0b88804973066e0951075fe4f`。本報告作為同一原子提交的一部分，最終 SHA 於交付紀錄提供。
