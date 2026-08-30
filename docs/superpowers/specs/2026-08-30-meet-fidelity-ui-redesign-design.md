# Raise Room 高擬真 Meet 互動重設計規格

日期：2026-08-30
狀態：使用者已核准方案 1，核准後直接規劃與實作到底
範圍：Raise Room 首頁、設定、會前準備室、正式談判室與必要的共用互動元件

## 1. 目標

把 Raise Room 從「具備 Meet 式流程的功能原型」提升為「操作節奏、資訊密度、控制位置、狀態回饋與動效都接近真實 Google Meet 的 nuva 產品」。保留 nuva 標誌、Raise Room 名稱、薪資談判用途與 local-first 邊界；不複製 Google 商標、帳號系統、Workspace 功能或無關的多人會議能力。

完成後，使用者不應再遇到以下問題：

- 會議控制只是長文字按鈕，無法一眼辨識麥克風、鏡頭、資訊與離開。
- 按鈕看得到卻沒有作用，或只能靠文字猜測開啟／關閉狀態。
- 設定視窗突然出現，沒有 Meet 式淡入、分頁圖示、選中導引與一致層級。
- Hover、Pressed、Focus、Tooltip、Popover、Drawer 沒有統一回饋。
- 點擊主管或自己沒有任何人物層級互動。
- 行動版開啟資訊面板後把舞台與控制列推離畫面。

## 2. 設計原則

1. **高擬真互動，nuva 品牌**：借鏡 Meet 的版面與互動語彙，不偽裝成 Google 產品。
2. **所有可見控制都有效**：按鈕必須執行實際動作、開啟實際內容、切換可觀察狀態，或在能力不可用時呈現 disabled 與原因；禁止假按鈕。
3. **舞台優先**：正式談判的主管舞台與底部核心控制永遠比技術狀態、逐字稿和設定更重要。
4. **狀態不只靠文字**：icon、顏色、`aria-pressed`／`aria-expanded`、tooltip 與可見狀態要一致。
5. **動效只解釋狀態變化**：使用 opacity、transform、顏色與陰影；不動畫化 layout width／height，不加入裝飾性炫技。
6. **功能與隱私不倒退**：不得破壞既有排程、local media、ASR、Presenter、壓力事件、報告與資料邊界。

## 3. 視覺系統

### 3.1 字體與層級

- 字體：`ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`。
- Page title：`28px / 36px / 600`。
- Section title：`20px / 28px / 600`。
- Panel title：`16px / 24px / 600`。
- Body：`14px / 20px / 400`。
- Meta：`12px / 16px / 500`。
- Button label：`14px / 20px / 600`。
- 所有會議時間與倒數使用 tabular numbers。

### 3.2 Token

CSS root 必須定義並由本次觸及的 UI 使用：

- `--surface-canvas`
- `--surface-raised`
- `--surface-subtle`
- `--surface-inverse`
- `--text-primary`
- `--text-secondary`
- `--text-inverse`
- `--border-subtle`
- `--accent`
- `--accent-hover`
- `--focus-light`
- `--focus-dark`
- `--danger`
- `--danger-hover`
- `--control-idle`
- `--control-hover`
- `--scrim`
- `--motion-standard: 160ms cubic-bezier(.2, 0, 0, 1)`
- `--motion-dialog: 180ms cubic-bezier(.2, 0, 0, 1)`

淺色頁面與深色會議室各自保持同一中性色系；nuva 藍只用於主 CTA、選取、焦點與明確狀態。

### 3.3 Icon 系統

- 建立本地 React SVG icon 元件，不依賴外部 runtime font 或 CDN。
- 統一 `20px` 視覺尺寸、`24×24` viewBox 與一致 stroke／fill 語彙。
- 至少包含：設定、說明、更多、帳號、會議、紀錄、麥克風開／關、鏡頭開／關、字幕、事件、資訊、關閉、電話離開、返回、釘選、放大、裝置、勾選、警告、載入。
- 裝飾 icon 使用 `aria-hidden`；icon-only button 必須有 `aria-label` 與 tooltip。

## 4. 共用互動元件

### 4.1 IconButton

- 尺寸：一般 `40×40px`，會議控制 `48×48px`。
- 支援 default、hover、pressed、selected、disabled、danger。
- Hover 只改背景／顏色／陰影；Pressed 使用顏色與最多 `scale(.98)`，不得造成 layout 位移。
- `focus-visible`：淺底 `2px solid var(--focus-light)`，深底 `2px solid var(--focus-dark)`，offset `2px`。
- 支援 `aria-pressed`、`aria-expanded` 與 tooltip。

### 4.2 Tooltip

- Desktop pointer hover 或 keyboard focus 後 `500ms` 顯示。
- 深色 surface、白字、`12px`、最大寬 `240px`。
- 離開、blur 或按下後關閉；觸控裝置不依賴 Hover 才能理解控制。

### 4.3 Popover／Menu

- 由觸發按鈕錨定，`role=menu` 與鍵盤方向鍵／Escape 支援。
- `160ms` opacity + `translateY(-4px → 0)`。
- 點擊外部或 Escape 關閉，焦點回觸發按鈕。
- 每個 menu item 都有實際作用；不可出現假 Google Apps、假分享或假帳號功能。

### 4.4 Drawer／Side panel

- Desktop `>=1024px`：右側 `360px`，允許 `320–400px`，推縮舞台但不影響固定控制列。
- Tablet `768–1023px`：`320px` 覆蓋右側。
- Mobile `<768px`：右側滑入，寬 `min(calc(100vw - 24px), 360px)`，全高、帶 scrim。
- `180ms` opacity + `translateX(16px → 0)`。
- 控制列高於 scrim；關閉後焦點回 opener。

### 4.5 Reduced motion

`prefers-reduced-motion: reduce` 時保留最終狀態，但把所有 transition／animation 降至近乎瞬時。

## 5. 首頁

### 5.1 Header

- 左側保留官方藍色 nuva logo、divider 與 Raise Room。
- 右側依序為說明、設定、更多、目前本機使用者。
- 說明開啟「Raise Room 使用說明」popover，提供流程、隱私與鍵盤操作摘要。
- 設定開啟設定 dialog。
- 更多開啟 menu，至少提供「檢查裝置」「查看本機資料與隱私」「關於 Raise Room」，分別導向對應設定 tab 或資訊內容。
- 使用者按鈕開啟本機身份 popover，顯示「資料只存在這台裝置」與清楚可用的「隱私設定」入口。

### 5.2 Navigation

- Desktop rail `80px`，會議與練習紀錄都使用 `20px` icon + 短標籤，最小點擊高 `48px`。
- Active 使用淡藍 surface、藍 icon／文字與清楚 indicator。
- Hover、Pressed、Focus 都可見。

### 5.3 Date strip 與 schedule

- 日期格 `64×72px`；今天以 `32px` 圓形日期標記，selected 額外有淡藍底。
- Schedule card 最小高 `112px`、內距 `20px`；時間欄約 `96px`、內容彈性、CTA 固定最右。
- 整張卡可點擊進 lobby；內部 CTA 同樣可操作，但避免雙重觸發。
- Hover 有淡色 surface／陰影變化，Pressed 有明確回饋。

## 6. 設定 dialog

### 6.1 出現與離場

- 使用既有原生 `<dialog>`、Escape、focus trap 與 roving tabs。
- Backdrop `180ms` fade in。
- Dialog `opacity 0 → 1`、`translateY(8px → 0)`、`scale(.99 → 1)`；關閉先播放反向動畫再完成狀態關閉。
- 不動畫 width 或 height。

### 6.2 Desktop／mobile 版面

- Desktop：寬 `960px`、最大高 `720px`，header/footer 各 `64px`，左 rail `208px`。
- 七個 tab 每列 `44px`、左側 `20px` icon、`14px/20px/500`。
- Selected 使用 `#e8f0fe` 等價 token、藍字與 `2px` selection indicator。
- Mobile：tab rail 水平捲動；點擊或鍵盤切換後 selected tab 自動 `scrollIntoView({block:"nearest", inline:"center"})`。
- Footer Cancel／Save 固定可見；danger flow 不放在 footer。

### 6.3 分頁內容

- 音訊：麥克風選擇、重新掃描、明確測試入口與狀態。
- 視訊：攝影機選擇、preview 與明確 permission 動作。
- 語音模型：保留三模型、WebGPU 邊界與測試；重新排版成單一選取列表＋細節，不使用三張通用卡。
- 主管角色：男／女性可用性、姓名與情境；不可將未設定女性 fallback 到男性。
- 主管個性、會議、隱私維持現有資料模型。
- 隱私頁最末設 danger zone；確認清除時預設焦點在取消，確認按鈕使用 danger 樣式。

## 7. 會前準備室

- 左側 16:9 preview、右側約 30% join panel 的主架構保留。
- Preview 的麥克風與鏡頭控制浮在左下，距邊 `16px`、gap `8px`、每枚 `48px`。
- 關閉狀態使用紅色、斜線 icon、`aria-pressed=false` 與正確 label。
- 第三枚更多按鈕打開裝置 menu；可開啟設定到音訊或視訊 tab。
- Permission 尚未授權時，preview 中央顯示單一明確動作；不得 mount 時自動請求。
- Preview 下方 readiness summary 只保留鏡頭、麥克風、3D 主管、語音模型四列，每列有 status icon 與 ready／optional／needs action。
- 右側只保留 kicker、meeting title、time、單句情境、主要加入 CTA、`可以提早開始談判` 與返回。
- 有未完成 optional 項目仍可加入，顯示「你仍可進入，未完成項目可在會議中開啟」。

## 8. 正式談判室

### 8.1 Header 與舞台

- Header 壓至約 `56px`；左側顯示 meeting title，右側顯示剩餘時間與資訊入口。
- 常態「本機模擬會議」與主管引擎狀態不占舞台上方垂直空間，移入資訊面板或短暫 toast。
- 主管維持 16:9 主舞台，使用者鏡頭浮在右下。
- 主管與自己 tile 都具備 Hover overlay：名稱、裝置狀態與更多按鈕。

### 8.2 人物點擊

- 點主管 tile：開啟人物 popover，可「釘選主管」「查看主管角色」「開啟會議資訊」。釘選會以可見 selected icon 與 stage label 反映。
- 點自己 tile：可「放大自己／還原」「釘選自己」「開啟裝置設定」。放大自己只交換舞台視覺，不改資料與音訊來源。
- 不提供假靜音對方、移除參與者、共同主持或其他不存在能力。

### 8.3 底部控制列

- 固定在視窗底部中央，高 `56px`、gap `8px`、深色 surface、圓角 `28px`。
- 順序：麥克風、鏡頭、逐字稿、壓力事件、更多、離開。
- 每枚 `48×48px`；Tooltip 延遲 `500ms`。
- 麥克風／鏡頭關閉狀態為紅色；離開永遠為 danger 圓形按鈕。
- 逐字稿與事件按鈕開啟同一 side panel 的對應 tab。
- 更多 menu 提供「語音模型」「視覺觀察」「裝置設定」「會議資訊」，各自開啟真實 panel/tab。
- `LocalVoiceControl` 的模型選擇、長狀態與可編輯逐字稿預覽移到 side panel；核心控制列不能換行。

### 8.4 通知

- 主管引擎狀態與 manager notice 使用右下 toast，最大寬 `360px`、預設 `4s`，可關閉。
- 錯誤維持 `role=alert`，固定在控制列上方直到解除。

## 9. 功能與資料流

- 現有 `App → PracticeSession → PrejoinLobby／MeetingRoom` owner 不變。
- MediaStream 與 ASR runtime 必須持續由 lobby 交接至 meeting，不得因 UI 重做二次取得。
- 設定 dialog 仍只在 Save 寫入 allowlisted localStorage；Cancel 不寫入。
- Header menu、人物 popover、side panel 與 tooltip 僅保存當前 React UI state。
- 新增 UI state 不可寫入逐字稿、報告或送到 Perxona。

## 10. 響應式驗收

必須實測：`375×812`、`768×1024`、`1280×800`、`1440×900`、`1920×1080`。

- 無水平 overflow。
- 設定 selected tab 可見。
- Lobby preview 與 CTA 不互相遮擋。
- Meeting 控制列固定可達。
- Drawer 不把舞台推離工作區。
- User tile 不蓋住 Presenter 重要內容或底部控制。

## 11. 動態與互動驗收

- 設定 dialog 可觀察到 backdrop fade 與 dialog fade/translate/scale。
- 所有 icon button 有 default、hover、pressed、focus、disabled、selected／danger 適用狀態。
- Tooltip `500ms` 後出現，focus 也可觸發。
- Popover／Menu／Drawer 支援 Escape、外部關閉與焦點返回。
- 點主管與點自己都有真實、可觀察且可逆的結果。
- Header 的說明、設定、更多、使用者控制都能開啟實際內容。
- 所有可見按鈕都有測試覆蓋或真實瀏覽器 readback。

## 12. 測試與發布閘門

- 先以 component tests 覆蓋共用 icons／tooltip／menu／drawer 與每頁互動，再實作。
- 保留全部既有 254 tests；新增測試不得用單純搜尋 CSS 字串取代可觀察行為測試，但 token／media query 可用 source assertion 補強。
- 每個 Terra 任務完成後跑 focused tests、TypeScript build、`git diff --check`，並由獨立 reviewer 檢查 spec 與品質。
- 最後跑 `npm run release:check`、real Chrome screenshots、console/error、五個 viewport、完整流程與一局真實時間 20 分鐘。
- 不在 Git 追蹤瀏覽器截圖、`.env.local`、credential、account data、meeting code、完整私人逐字稿或裝置識別碼。
- 所有檢查完成前不得 push。Push 前 fetch、確認 `origin/main` 無新 commit、只做 fast-forward，絕不 force push。

## 13. 不在本次範圍

- Google 商標、Google Apps grid、Google 帳號或 Workspace 整合。
- 多人邀請、分享連結、電話撥入、錄影、螢幕分享、主持人權限。
- 新的後端、雲端保存或 UI 框架遷移。
- Custom VRoid、女性 Presenter target 的內容製作；本次只把既有可用性呈現做好。

## 14. 已確認決策

- 採方案 1：高擬真 Google Meet 互動與排版，保留 nuva 品牌。
- 規劃完成後直接執行到底，不再逐段等待人工確認。
- 使用 Terra 子代理逐任務實作；根代理以真實 Chrome 截圖與互動 readback 驗收。

## 15. Task 7 自動化與靜態證據（2026-08-30）

- `npm run release:check` 初次 RED：release-files 偵測到已被誤追蹤的 `.superpowers/sdd/task-6-report.md`。根因是 `.superpowers/` 已被 ignore，後續提交仍強制納入該內部報告。只解除該檔案追蹤、保留本機 ignored report 後，gate GREEN。
- GREEN 全量：59 個 test files／306 tests，並通過 TypeScript、Vite production build、release-files 與已審閱依賴稽核。Vite 僅輸出既有的 500 kB bundle 建議，沒有 build error。
- focused UI／accessibility suite：10 個 test files／78 tests 通過，覆蓋本地 icon、500ms tooltip 與 focus、keyboard menu／Escape／focus return、首頁所有 header action、lobby explicit permission、七 tabs、固定六控制列、drawer、participant actions 與 toast。
- 靜態 CSS 檢查：27 個 root token 定義、16 種被引用的 token、共 73 次 `var()` 使用、0 個未知 token；設計指定的 960px dialog、70/30 lobby、16:9 stage、56px 不換行控制列、桌面 360px／平板 320px／手機 `min(calc(100vw - 24px), 360px)` drawer，以及 reduced-motion 規則均存在。
- 未完成且不得以本段替代：Google Meet 唯讀比對、五尺寸 Chrome 實機矩陣、所有可見控制逐一 click/readback、console 檢查、permission deny、視覺 aggregate，及真正不中斷 20 分鐘 physical media／high-quality ASR／Presenter／edited voice turn／比例事件／自動 report。這些 acceptance 仍由 root browser owner pending。

### Final re-review evidence (2026-08-30)

- Fresh full gate: 59 test files／320 tests passed; TypeScript/Vite build、release-files 與 `git diff --check` passed. Vite only retained its existing large-chunk advisory.
- Fresh CSS token scan: 34 custom-property definitions, 19 referenced token types, 79 `var()` uses, and 0 unknown references. This re-review made `--surface-canvas`、`--accent-hover`、`--scrim` live in the touched UI rules.
- StrictMode regression coverage verifies explicit microphone/camera requests remain usable after effect replay, late camera resolution is stopped after unmount, and successful preview streams stop on real unmount. Meeting drawer keeps device selection only and does not offer a second raw media request.
- Full-surface participant triggers are sibling semantic buttons; Presenter canvas, local video, and real controls sit above the hit target while noninteractive surface clicks open the menu. Browser-level pointer hit testing remains part of root Chrome acceptance.
