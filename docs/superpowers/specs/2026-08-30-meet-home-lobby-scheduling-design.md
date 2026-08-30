# Raise Room Meet 式首頁、排程與會前準備室設計

狀態：使用者已確認設計方向
日期：2026-08-30

## 1. 背景與實測依據

Raise Room 目前以情境設定表單作為第一個畫面，填完後直接進入 3D 主管談判室。功能已能完成本機語音、鏡頭、Perxona Chatbot、3D Presenter 與會後報告，但缺少真實線上會議的心理節奏：看見即將開始的會議、提早進入、檢查裝置、準備好後才正式加入。

本設計以 2026-08-30 在已登入 Chrome 中實際觀察的 Google Meet 桌面版為互動研究基礎。實際走查涵蓋：

- 會議首頁與日期列。
- 通話頁。
- 音訊、視訊、一般、通話記錄與會議記錄設定。
- 新會議選單與預先建立會議資訊。
- 會前準備畫面。
- 正式會議室與底部控制列。
- 參與者、聊天室、會議工具與主辦人控制側欄。
- 版面配置選單。
- 會後離開畫面。

Raise Room 只借鏡資訊架構、空間比例、狀態節奏與操作模式，不使用 Google 名稱、標誌、圖像、會議代碼格式、原始素材或逐字複製的介面文字。產品識別固定使用藍色 nuva logo 與 Raise Room 名稱。

## 2. 已確認的產品決策

1. 首頁取代目前的情境設定入口。
2. 首頁左上角使用官方藍色 nuva logo，不使用 Google Meet 品牌。
3. 每次文件載入或重新整理，都建立「嚴格下一個整點」的主管 1:1。
4. 例如 17:05 重新整理，下一場固定為 18:00；不保留 17:00 場次。
5. 使用者可選擇 5、10 或 20 分鐘，首頁結束時間必須與選擇一致。
6. 點擊首頁會議卡後，先進入會前準備室，不直接進入談判。
7. 會前準備室左側為大型本機鏡頭預覽，右側為會議資訊與加入操作。
8. 右側加入按鈕下固定顯示「可以提早開始談判」。
9. 使用者不必等到排定時間，可以立即進入談判。
10. 正式談判倒數與設定的 5、10 或 20 分鐘完全一致。
11. 首頁右上角的設定集中管理裝置、語音模型、主管角色、主管個性與會議時間。
12. 主管角色至少提供男性與女性呈現選項；選項控制 3D avatar 與 voice preset，不推論角色的性格或能力。
13. 五個壓力事件依談判長度按相同比例觸發。

## 3. 目標

- 讓使用者在談判前感受到「會議即將開始」的壓力與期待。
- 建立首頁、會前準備、正式談判與會後報告四段清楚流程。
- 讓鏡頭、麥克風、語音模型與 3D 主管都能在加入前被確認。
- 把目前的大型情境表單重組成 Meet 式設定對話框。
- 維持現有本機優先、明確權限與敏感資料不離開裝置的邊界。
- 保留既有 Perxona、ASR、視覺觀察、逐字稿與報告功能。

## 4. 非目標

- 不串接 Google Calendar、Google Meet API 或真實公司行事曆。
- 不建立多人視訊服務、WebRTC 房間或真實電話撥入。
- 不實作 Google 帳號、聯絡人搜尋、Workspace 管理或外掛市集。
- 不複製 Google 商標、圖像、聲音、會議代碼或受保護素材。
- 不加入雲端錄影、雲端音訊保存或雲端情緒分析。
- 不讓設定頁自動要求鏡頭或麥克風權限。
- 不在正式談判中切換主管角色、語音模型或談判長度。

## 5. 頁面與狀態地圖

`AppState` 調整為：

```ts
type AppState =
  | { view: "home"; meeting: ScheduledPracticeMeeting }
  | { view: "settings"; meeting: ScheduledPracticeMeeting }
  | { view: "lobby"; meeting: ScheduledPracticeMeeting; scenario: Scenario }
  | { view: "meeting"; meeting: ScheduledPracticeMeeting; scenario: Scenario }
  | {
      view: "report";
      meeting: ScheduledPracticeMeeting;
      scenario: Scenario;
      transcript: TranscriptTurn[];
      visualSignals?: VisualSignals;
    };
```

Camera stream、ASR Worker 與裝置狀態不放進 `AppState` 的可序列化資料，而由 App 層的單一 `PracticeSessionRuntime` 持有。這個 runtime 只跨越 `lobby → meeting`，不跨越重新整理、回首頁或進入 report。

流程固定為：

```text
首頁 → 會前準備室 → 正式談判 → 會後報告
  └──────── 設定 ────────┘
```

- 首次載入進入 `home`。
- 設定關閉後返回 `home`，不直接開始會議。
- 點擊首頁會議卡進入 `lobby`。
- `lobby` 按「立即進入會議室」後才進入 `meeting`。
- 會議結束、自動倒數結束或使用者提前結束後進入 `report`。
- 報告的「重新設定」返回 `home`，不是回到大型表單。
- 報告的「再練一次」可直接回 `lobby`，沿用同一份設定。

## 6. 排程演算法

### 6.1 嚴格下一個整點

```ts
function getStrictNextHour(now: Date): Date {
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  return start;
}
```

即使 `now` 剛好是 18:00:00，也要回傳 19:00，不得把現在這個整點當成下一場。

### 6.2 會議視窗

```ts
type PracticeDurationMinutes = 5 | 10 | 20;

interface ScheduledPracticeMeeting {
  id: string;
  title: string;
  managerName: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: PracticeDurationMinutes;
}
```

- `startsAt = getStrictNextHour(now)`。
- `endsAt = startsAt + durationMinutes`。
- 使用裝置本地時區顯示日期與時間。
- `now` 必須可注入，讓測試不依賴真實系統時間。
- 每次文件載入只建立一次 meeting，SPA 內切換首頁、設定與 lobby 不得讓時間跳到下一場。
- 瀏覽器完整重新整理時重新計算；17:05 重新整理立即變成 18:00 場次。
- 使用者在首頁儲存新的談判長度時，保留下一個嚴格整點作為開始時間，重新計算結束時間。
- 若首頁保持開啟直到排定會議結束，系統自動產生下一個嚴格整點場次；已在 lobby、meeting 或 report 時不自動換場。

### 6.3 範例

| 載入時間 | 設定長度 | 首頁顯示 |
| --- | ---: | --- |
| 17:05 | 5 分鐘 | 18:00–18:05 |
| 17:05 | 10 分鐘 | 18:00–18:10 |
| 17:05 | 20 分鐘 | 18:00–18:20 |
| 18:00 | 20 分鐘 | 19:00–19:20 |

## 7. Meet 式首頁

### 7.1 全域頂欄

- 左側：官方藍色 nuva logo 與 `Raise Room` 文字。
- 中央：不提供真實會議代碼輸入；保留足夠留白，不製造無效控制。
- 右側：設定按鈕與本機使用者圓形識別。
- 設定按鈕需有可見 tooltip、鍵盤焦點與 `aria-label="設定"`。

### 7.2 左側導覽

第一版只提供有真實功能的分頁：

- `會議`：目前首頁。
- `練習紀錄`：可先顯示本機空狀態；不在本次建立完整歷史資料庫。

不放沒有功能的「通話」入口。

### 7.3 日期列

- 顯示今天日期與未來七天。
- 今天使用藍色圓形高亮。
- 日期列只建立視覺與選取狀態，不串接行事曆。
- 第一版切換其他日期顯示「這一天沒有安排練習」；回到今天恢復排定 meeting。

### 7.4 Schedule 卡

會議卡至少顯示：

- 開始與結束時間。
- `與 {managerName} 的年度調薪 1:1`。
- 公司與使用者職位。
- 狀態：`即將開始`、`進行中` 或 `已結束`。
- `提早進入準備室` 按鈕。

整張卡可點擊，鍵盤 Enter／Space 也能進入 lobby。按鈕與整卡不得造成重複 navigation。

## 8. 首頁右上角設定

設定使用置中的大尺寸 dialog，左側為垂直 tab，右側為內容。排版借鏡 Meet 的資訊架構，但使用 nuva 色彩、圓角、字體與原創文案。

### 8.1 分頁

1. `音訊`
   - 麥克風選擇。
   - 喇叭選擇。
   - 麥克風測試。
   - 不在 dialog mount 時要求權限。
2. `視訊`
   - 攝影機選擇。
   - 使用者明確按下預覽後才要求權限。
   - 本機畫面不送出裝置。
3. `語音模型`
   - 高品質、平衡、快速。
   - 繁中、英文、日文。
   - 既有 20 秒文字吻合度測試。
   - 模型載入進度、取消與釋放。
4. `主管角色`
   - 主管姓名。
   - 角色呈現：男性主管／女性主管。
   - 可用 3D avatar 與 voice preset。
   - 選項沒有 Perxona runtime 設定時清楚標示 unavailable，不默默顯示錯誤角色。
5. `主管個性`
   - 預算防守、證據要求、耐心、直接程度、親和程度、權威感。
   - 隱藏立場。
   - 補充角色指令。
6. `會議`
   - 5、10、20 分鐘單選。
   - 公司、職位、年資、現薪、期待薪資、最低可接受結果。
   - 成果、會議原因。
   - 五個壓力事件的名稱與指令。
   - 事件實際時間只顯示 derived preview，不由使用者輸入固定分鐘。
7. `隱私`
   - 本機處理邊界。
   - 清除本機設定與草稿。
   - 原始鏡頭與麥克風音訊不送給 Perxona。

### 8.2 儲存規則

- 對話框提供 `取消` 與 `儲存設定`。
- 取消不得改變已保存設定。
- 儲存時驗證所有 allowlist 與數字範圍。
- 語音模型測試結果、音訊、鏡頭畫面與權限狀態不持久化。
- 會議中不允許開啟會改變本局角色或時間的設定。

## 9. 主管男性／女性角色

使用者選的是 `managerPresentation`，不是生理性別推論：

```ts
type ManagerPresentation = "male" | "female";
```

- 每個選項對應 allowlisted Presenter avatar target 與 voice target。
- ID 來自環境設定或安全的 public runtime config，不寫死在文件、測試、Git history 或 localStorage。
- Secret key 永遠只在 server。
- 若只配置一個角色，另一個選項 disabled 並顯示「此角色尚未設定」。
- 場景可共用；角色名稱、人格與指令仍由 Scenario 控制。
- 切換呈現選項不得自動改變主管姓名、個性、立場或 system prompt。

## 10. 會前準備室

### 10.1 版面

桌面版採約 70／30 雙欄：

- 左側：大型 16:9 本機鏡頭預覽。
- 右側：會議名稱、主管姓名、時間、狀態、加入按鈕與提前開始提示。

行動版改為上下排列，鏡頭預覽在上、加入資訊在下。

### 10.2 權限與裝置

- 進入 lobby 時不自動要求權限。
- 左側先顯示深色 placeholder 與 `允許鏡頭與麥克風`。
- 使用者點擊後才呼叫 `getUserMedia({ audio: true, video: true })`。
- 取得權限後立即顯示鏡頭預覽。
- 畫面底部提供圓形麥克風、鏡頭與裝置設定按鈕。
- 關閉鏡頭仍保留麥克風；關閉麥克風仍保留鏡頭。
- 權限拒絕時顯示明確 fallback，使用者仍可使用文字輸入進入談判。
- Camera／microphone tracks 由 App 層的 `PracticeSessionRuntime` 持有，不由 lobby 元件自己擁有。
- `lobby → meeting` 時把同一份 stream 掛到新的 video element，不停止或重新要求權限，避免畫面閃斷。
- Lobby 只維持已授權的 audio track，不在背景錄音；只有使用者在 meeting 按下「開始說話」後才建立 MediaRecorder。
- Meeting 的 MediaRecorder 使用 runtime 既有的 audio track，不再呼叫第二次 `getUserMedia`；結束單回合錄音時停止 recorder，但保留使用者仍啟用的 session track，供下一回合使用。
- 麥克風 toggle 以 `track.enabled` 控制；禁用時不得開始錄音。使用者未在 lobby 授權時，meeting 的第一次「開始說話」可再次明確要求 audio permission。
- 返回首頁、取消本局、進入 report、完整 reload 或 runtime dispose 時，才停止所有 tracks。
- Lobby 與 Meeting 不可各自建立第二份重疊 stream。

### 10.3 模型與主管準備狀態

右側加入資訊顯示：

- 麥克風：未授權／可用／已關閉。
- 鏡頭：未授權／可用／已關閉。
- 語音模型：未載入／載入中／可用／錯誤。
- 3D 主管：未啟動／載入中／可用／fallback。

使用者可在 lobby 明確載入語音模型與 3D 主管。不得自動下載 1.5 GB 高品質模型。

- ASR client／Worker 由 `PracticeSessionRuntime` 持有；lobby 載入完成後，meeting 必須直接沿用同一個 ready Worker，不得重新下載、重新暖機或建立第二個 Worker。
- Lobby 可預載 Presenter SDK、驗證 avatar／voice／scene config，正式的 Presenter stage DOM 在 meeting mount；若 SDK 無法跨畫面重用，UI 必須把 lobby 狀態標成「連線已驗證」，不得假稱角色已完成呈現。
- 離開本局或進入 report 時 dispose Worker 與 Presenter runtime。

### 10.4 加入區

- 標題：`與 {managerName} 的年度調薪 1:1`。
- 時間：依設定顯示，例如 `18:00–18:20`。
- 參與者狀態：`主管會在談判開始後加入`。
- Primary CTA：`立即進入會議室`。
- CTA 下固定備註：`可以提早開始談判`。
- 點擊 CTA 不受排定時間限制。

## 11. 正式談判室

- 沿用既有 Perxona 3D Presenter、使用者鏡頭、本機視覺觀察、語音轉錄、可編輯預覽、逐字稿與 report handoff。
- 接收 `PracticeSessionRuntime` 已授權的 camera／microphone stream 與已載入 ASR client，避免重新取得裝置或載入模型。
- 會議名稱改用 scheduled meeting title。
- 倒數由 `durationMinutes * 60` 決定，不再固定 10 分鐘。
- 會議中顯示原本排定時間與實際已開始時間，但不因提早加入而縮短倒數。
- 提早開始代表立即開始完整 5／10／20 分鐘談判。
- meeting 期間禁止切換談判長度、主管角色與語音模型。
- 結束按鈕使用 `離開並查看報告`，保留明顯的紅色退出語意。

## 12. 壓力事件比例

五個事件使用固定比例，而不是固定分鐘：

```ts
const pressureEventRatios = [0.1, 0.3, 0.5, 0.7, 0.9] as const;
const offsetSeconds = Math.round(durationSeconds * ratio);
```

| 談判長度 | 事件時間 |
| --- | --- |
| 5 分鐘 | 0:30、1:30、2:30、3:30、4:30 |
| 10 分鐘 | 1:00、3:00、5:00、7:00、9:00 |
| 20 分鐘 | 2:00、6:00、10:00、14:00、18:00 |

- 事件順序與內容保留。
- 設定中的事件只編輯名稱與指令，觸發時間顯示為 derived preview。
- legacy draft 若只有 `minute`，依事件 index 遷移至上述 ratio；保留 label、instruction 與 id。
- 同一事件每局只觸發一次。

## 13. 本機資料與遷移

保留既有 storage keys，避免一次大規模資料遷移：

- `raise-room-scenario-draft`：Scenario 與主管個性。
- `raise-room-voice-settings-v1`：ASR preset。
- 新增 `raise-room-meeting-settings-v1`：

```json
{
  "durationMinutes": 20,
  "managerPresentation": "male"
}
```

讀取規則：

- 長度只接受 5、10、20；缺少或錯誤回到 20。
- 角色呈現只接受 male、female；缺少或錯誤回到已配置的第一個角色。
- 不保存 schedule timestamps；每次 reload 依目前時間重算。
- 不保存 lobby 權限、MediaStream、模型載入狀態或測試結果。
- legacy Scenario 的事件時間依 index 補上 ratio，不刪除使用者文字。

## 14. 元件與模組邊界

預計新增：

- `src/domain/practice-schedule.ts`：下一整點、會議視窗、狀態與格式化。
- `src/domain/practice-settings.ts`：duration、manager presentation、validation。
- `src/lib/practice-settings-storage.ts`：localStorage boundary 與 migration。
- `src/components/MeetHome.tsx`：首頁 shell、日期列與 schedule card。
- `src/components/PracticeSettings.tsx`：Meet 式設定 dialog 與 tabs。
- `src/components/PrejoinLobby.tsx`：大型鏡頭預覽、裝置控制與加入區。
- `src/components/NuvaBrand.tsx`：官方藍色 nuva logo 與產品名稱。
- `src/runtime/PracticeSessionRuntime.tsx`：跨 lobby／meeting 的 camera、microphone、ASR 與 Presenter preload ownership。

預計修改：

- `src/App.tsx`：新 state machine 與頁面 handoff。
- `src/components/ScenarioWorkshop.tsx`：拆為設定內容；不再作首頁。
- `src/components/MeetingRoom.tsx`：動態 duration、meeting title 與排定時間。
- `src/domain/scenario.ts`：事件 ratio 或 offsetSeconds migration。
- `src/domain/meeting.ts`：以 seconds 觸發事件。
- `src/styles.css`：首頁、dialog、lobby、responsive 與 focus states。
- Presenter runtime config：增加 allowlisted male／female presentation mapping。

元件不可直接讀取 secret、模型 URL 或任意 Presenter target ID。

`PracticeSessionRuntime` 是唯一可以跨 lobby／meeting 持有裝置與模型資源的 owner。UI 元件只能呼叫明確的 load、enable、disable、attach、detach 與 dispose 介面。

## 15. 錯誤與 fallback

- 現在時間無效：使用裝置目前時間重試；仍失敗則顯示不可排程錯誤，不建立假時間。
- duration storage 無效：回到 20 分鐘。
- 主管角色未配置：該角色 disabled；若已保存的選項失效，回到第一個可用角色並提示。
- camera／mic 權限拒絕：保留 lobby，顯示 browser permission 說明與文字輸入 fallback。
- 高品質模型不可用：顯示原有 WebGPU 說明，允許改選平衡或快速。
- Presenter 失敗：顯示本機 deterministic manager fallback，不阻止進場。
- 使用者在設定中輸入無效薪資：保持 dialog 開啟，聚焦第一個錯誤欄位。
- 使用者從 lobby 返回首頁或取消本局：dispose runtime、停止 tracks 與 worker。
- 使用者從 lobby 進入 meeting：保留同一個 runtime，不停止或重新建立 tracks／worker。
- 使用者重新整理：回首頁並產生下一個嚴格整點 meeting，不恢復未完成逐字稿。

## 16. 隱私與安全

- 首頁與設定不自動要求 camera／mic。
- 原始鏡頭畫面不送給 server 或 Perxona。
- 原始麥克風音訊不送給 Perxona；只有使用者確認後的文字會送給主管。
- Lobby 不持久化音訊、影格、裝置 ID、權限結果或模型測試結果。
- Secret key 只存在 server `.env.local`。
- Public Presenter／avatar／voice target ID 不寫入文件或使用者逐字稿。
- 設定文字視為不可信輸入，沿用 React output escaping 與 server request validation。
- 不把測試產生的 Meet 代碼、電話、PIN、帳號或真實會議資料放入 repo 或文件。

## 17. 視覺與品牌

- 左上角必須使用官方藍色 nuva logo；不得自行重畫近似商標。
- 若 repo 沒有官方 asset，實作前從使用者既有 nuva project asset 中尋找並確認來源，不以 AI 生成替代。
- 主色使用 nuva 藍，CTA 可使用較淺藍色 surface；不使用 Google 綠黃紅藍組合。
- 首頁以白色、低陰影、細邊界與寬留白呈現。
- Lobby 與 Meeting 使用深色視訊舞台，控制列保持高對比。
- 不追求 pixel-copy Google；追求一致的閱讀順序、密度、控制位置與狀態回饋。

## 18. 響應式與可存取性

- 驗收寬度：320、375、768、1024、1440。
- 首頁在手機隱藏文字側欄，只保留可存取的 icon navigation。
- 日期列可水平捲動，不造成整頁 overflow。
- Lobby 手機版改為單欄，加入 CTA 保持可見。
- Settings 手機版將左側 tab 改為水平可捲動 tablist。
- Dialog 有 focus trap、Escape 關閉與關閉後 focus return。
- Schedule card、camera／mic、加入、退出與設定全部有可見 focus ring。
- 狀態不能只用顏色表達，需同時顯示文字或 icon。
- 標題階層維持一個 h1，頁面區段依序 h2、h3。
- 動態 countdown、模型載入與權限錯誤使用適當 live region，不每秒干擾螢幕閱讀器。

## 19. 測試策略

### 19.1 Pure domain tests

- 17:05 + 5／10／20 分鐘得到 18:00–18:05／10／20。
- 18:00:00 仍得到 19:00。
- 跨日與跨月，例如 23:30 得到隔日 00:00。
- duration allowlist 與 invalid fallback。
- 壓力事件 ratios 對三種長度的 exact offsets。
- Schedule status：upcoming／active／ended。
- Legacy event migration 保留文字並補 ratio。

### 19.2 Component tests

- 首頁顯示藍色 nuva 品牌、下一場時間與 schedule card。
- 點卡片進 lobby，不直接進 meeting。
- Settings dialog 有七個 tabs，取消不寫入、儲存才寫入。
- duration 改變後首頁 end time 對齊。
- male／female unavailable 狀態清楚。
- Lobby mount 不要求權限；明確操作後才呼叫 getUserMedia。
- Lobby 顯示大型 preview、裝置狀態、加入 CTA 與「可以提早開始談判」。
- 提早加入能開始完整 duration，不以距離排定時間縮短。
- Lobby 返回首頁時停止 tracks 與 worker；進入 meeting 時無縫沿用同一 runtime。
- Lobby 已載入 quality Worker 後進 meeting，不產生第二個 Worker、不重新顯示下載或暖機。
- MeetingRoom 接收動態 duration 與壓力事件 offsets。
- Report retry 回 lobby；reset 回 home。

### 19.3 真實 Chrome 驗收

- 重新整理於非整點，首頁顯示下一個整點。
- 改選 5／10／20 後首頁時間立即正確。
- Settings dialog 視覺、tab、鍵盤與 focus 正常。
- Lobby 第一次權限、允許、拒絕與再次嘗試流程。
- Camera preview、mic、ASR model 與 Presenter 狀態可見。
- 提早加入後完整完成 5、10、20 分鐘各一局 development-clock 驗收；至少一局使用真實時間。
- 五個壓力事件在三種 duration 的正確秒數觸發。
- Perxona 回覆、3D 發話、逐字稿、視覺 signals 與 report handoff 不回歸。
- 320、375、768、1024、1440 無橫向 overflow。
- Console 無新增 error／warning。
- Network 中 camera frame、mic audio、測試文字不 outbound；只有確認後的談判文字可送至 manager API。

## 20. 驗收條件

- 首頁取代原本大型設定表單。
- 左上角為官方藍色 nuva logo。
- 每次 reload 產生嚴格下一整點 meeting。
- 5、10、20 分鐘與首頁 end time、meeting countdown、event offsets 全部一致。
- Schedule card 可隨時提早進 lobby。
- Lobby 是左大畫面、右加入資訊的 Meet 式準備畫面。
- Camera／mic 只在使用者明確操作後要求。
- 右側顯示 `可以提早開始談判`。
- Settings 集中管理音訊、視訊、模型、主管角色、主管個性、會議與隱私。
- 男性／女性主管選項不會默默對應到錯誤 Presenter。
- 正式談判完整執行設定 duration。
- 壓力事件按 10%、30%、50%、70%、90% 觸發。
- 現有本機 ASR、繁中轉換、送出前編輯、Perxona、Presenter、camera analysis 與 report 全部通過 regression。
- 文件、Git 與公開輸出不包含 credential、帳號、真實 Meet 代碼、電話或 PIN。

## 21. 考慮過的方案

### 方案 A：只新增首頁與 lobby

- 優點：改動較小。
- 缺點：設定仍分散、主管角色與 duration 無法形成一致資料流，也無法達到使用者要求的完整 Meet 感。
- 結論：拒絕。

### 方案 B：高還原流程、nuva 品牌、保留既有引擎

- 優點：建立真實會議節奏，同時重用已驗證的本機與 Perxona 功能；不造成商標混淆。
- 缺點：需要新的 app state、設定 dialog、schedule domain、lobby 與資料遷移。
- 結論：採用。

### 方案 C：完整複製 Meet 所有功能

- 優點：表面最接近 Meet。
- 缺點：包含多人、電話、錄影、Workspace、外掛等與薪資談判無關的系統，成本與隱私風險過高。
- 結論：拒絕。
