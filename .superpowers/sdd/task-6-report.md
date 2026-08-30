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

## Review 修正（第二輪）

- Toast 的 dismiss callback 改以 ref 保存，timer 僅依 toast `id`、`tone` 與 `durationMs` 建立；meeting clock 每秒 re-render 不會重設四秒期限。
- `send-error` 不會在重試開始時移除；只有成功收到主管回覆或使用者按下通知關閉時才會消失。測試包含第二次尚在等待與其後失敗的狀態。
- 自己 tile 的裝置入口現在打開 drawer 的裝置頁，使用既有 `DeviceSettingsPanel` 讀取及選擇裝置。選擇只保留在 App 記憶體，明確告知會於下一次 permission request 才套用，沒有重啟或替換現有 stream，也不寫入 localStorage。
- Participant menu 將實際 ActionMenu trigger 交給 panel action；關閉 manager info 或 self devices drawer 時焦點會回到相對應 tile trigger。
- overlay transition 改用既有 `--motion-standard`，並以 source assertion 防止未知 motion token 回歸。

### 第二輪驗證

- RED：新增時鐘、pending retry、App 裝置選擇、tile trigger focus 與 CSS token 測試後，所有五項 finding 均可重現失敗。
- Focused：Task 6、DeviceSettingsPanel、App 與 Task 5 整合共 59 項測試通過。
- 完整：`npm test` 59 個測試檔、305 個測試全部通過。
- `npm run build` 與 `git diff --check` 通過；僅有 Vite 既有 bundle size 建議警告。
