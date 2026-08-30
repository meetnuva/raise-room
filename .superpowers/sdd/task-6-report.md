# Task 6 驗證報告：participant tile actions 與 meeting toasts

## 範圍與實作

- 新增 `ParticipantMenu`：主管僅能釘選、查看主管角色、開啟會議資訊；自己僅能放大／還原、釘選、開啟裝置設定。未加入靜音對方、移除參與者或共同主持等不存在的操作。
- `MeetingRoom` 持有 `StageFocus`，以 CSS 改變舞台位置；主管 Presenter 與本機 `<video>` 一直維持在 DOM 中，切換自己放大後可還原。
- 主管與本機 tile 都有 hover／focus overlay，釘選會反映在可見標籤。
- 新增可關閉 `ToastRegion`：一般通知在 4000ms 後消失，錯誤保留為 `role="alert"`，直到使用者關閉或後續成功回覆清除。
- 主管引擎來源與 manager notice 改為四秒通知；Presenter 錯誤由可關閉的 persistent alert 呈現。

## TDD 證據

- RED：新增元件尚不存在時，ParticipantMenu 與 ToastRegion 測試無法解析；既有 tile／room 測試亦因缺少釘選、menu、stage focus 與 toast 行為失敗。
- GREEN：focused suite 通過 5 個檔案、40 個測試。

## 最終驗證

- `npm test`：59 個測試檔、299 個測試全部通過。
- `npm run build`：通過。Vite 僅報既有大型 bundle 建議警告，沒有建置錯誤。
- `git diff --check`：通過。

## 自我審查

- 沒有修改 domain、storage、media ownership 或 Perxona runtime；舞台切換沒有條件掛載 Presenter／stream。
- 既有 Task 5 控制列、資訊 drawer、更多選單的 owner 與 focus-return 邏輯維持不變。
- 本 task 僅修改分配元件、對應測試與 Task 6 CSS。
