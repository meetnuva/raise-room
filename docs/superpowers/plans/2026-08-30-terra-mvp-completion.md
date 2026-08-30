# Terra Execution Spec — Raise Room MVP Completion

## OBJECTIVE

完成 Raise Room 第一階段 MVP 的可用閉環：使用者設定年度調薪情境，進入本機模擬會議，輸入對話，結束後保留逐字稿並看到每項建議都能指回證據的教練報告；同時建立預設停用的 Perxona 設定邊界與開源／local-first 文件。

可觀察成果：`ScenarioWorkshop → MeetingRoom → CoachingReport → 再練一次` 在瀏覽器內可完整操作，沒有 API key 也能運作；所有測試與 production build 通過。

## FILES AND OWNERSHIP

Terra 只擁有：

- 修改 `src/App.tsx`
- 修改 `src/App.test.tsx`
- 修改 `src/components/MeetingRoom.tsx`
- 修改 `src/components/MeetingRoom.test.tsx`
- 新增 `src/components/CoachingReport.tsx`
- 新增 `src/components/CoachingReport.test.tsx`
- 新增 `src/domain/report.ts`
- 新增 `src/domain/report.test.ts`
- 新增 `src/lib/perxona-config.ts`
- 新增 `src/lib/perxona-config.test.ts`
- 修改 `src/styles.css`
- 修改 `README.md`
- 新增 `.env.example`
- 新增 `docs/privacy-boundary.md`
- 新增 `docs/perxona-integration.md`

不要修改 `scenario.ts`、`meeting.ts` 或其他未列出的檔案。若現有介面不足，先透過上述擁有檔案的 adapter／prop 解決；真的無法解決時回報 blocked，不要自行擴張。

你不是唯一在 codebase 工作的人。保留所有既有提交與使用者改動，不還原無關變更，適應目前 HEAD。

## INTERFACES

### Meeting finish handoff

現況 `MeetingRoom` 的 `onFinish?: () => void` 會丟失逐字稿。改成：

```ts
onFinish?: (transcript: TranscriptTurn[]) => void;
```

按下「結束並看報告」時，傳出當下 append-only transcript。`App` 必須保存 `{ scenario, transcript }` 作為 report session，不可把資料寫到網路或雲端。

### Report domain

在 `src/domain/report.ts` 提供：

```ts
export interface Evidence {
  kind: "transcript" | "missing";
  atSeconds: number;
  text: string;
}

export interface Recommendation {
  id: string;
  title: string;
  summary: string;
  evidence: Evidence;
  retryPrompt: string;
}

export interface NegotiationMapItem {
  id: "request" | "achievement" | "recovery" | "next-step";
  label: string;
  complete: boolean;
}

export interface CoachingReport {
  strengths: Recommendation[];
  practiceTargets: Recommendation[];
  negotiationMap: NegotiationMapItem[];
}

export function createCoachingReport(
  scenario: Scenario,
  transcript: TranscriptTurn[],
): CoachingReport;

export function formatTimestamp(elapsedSeconds: number): string;
```

所有 Recommendation 必須有 Evidence。缺少行為也要用 `kind: "missing"`、`atSeconds` 指向最後一個使用者 turn（沒有 user turn 時為 0），並以 `text` 清楚寫「逐字稿中尚未出現……」，不能偽造引文。

### Deterministic coaching rules

只用明確逐字稿與 scenario facts：

1. **request**：任一 user turn 包含 `scenario.compensation.requestedMonthlySalary` 的純數字或含千分位字串；當 requested salary 為 0 時，改以同時出現 `希望|期待|調整` 與數字視為提出具體請求。
2. **achievement**：任一 user turn 含數字、百分比或明確量化詞（例如 `提升 20%`、`縮短 3 天`）。
3. **recovery**：manager turn 含 `預算|凍結|無法|不能|沒有空間`，且後面存在 user turn，即完成拒絕後回應。
4. **next-step**：user turn 含 `下一步|何時|什麼時候|回覆|確認|再約|追蹤`。不得以單獨的「時間」判定，因為「把交付時間縮短 3 天」是成果證據，不是後續承諾。

完成項目進入 `strengths`；未完成項目進入 `practiceTargets`。不得產生「自信、誠實、人格或真實情緒」分數。

### CoachingReport UI

- 顯示「會後教練報告」。
- 顯示四項談判地圖及完成狀態。
- 分開顯示「做得好的地方」與「最值得重練」。
- transcript evidence 的按鈕 aria name 為 `查看 MM:SS`，missing evidence 顯示 `本局未出現`，不偽裝成連結。
- 每個 practice target 顯示 `retryPrompt`。
- 提供 `再練一次`，回到同一 Scenario 的會議；另提供 `重新設定情境`，回到 ScenarioWorkshop。

### App states

使用明確 union 或等價 state：

- setup
- meeting with Scenario
- report with Scenario + TranscriptTurn[]

`再練一次` 不丟失 scenario；`重新設定情境` 返回 setup。避免多個互相矛盾的 boolean。

### Perxona config boundary

在 `src/lib/perxona-config.ts` 提供：

```ts
export type PerxonaConfig =
  | { enabled: false }
  | { enabled: true; publishableKey: string };

export function readPerxonaConfig(
  env: Record<string, string | undefined>,
): PerxonaConfig;
```

只有 `VITE_PERXONA_CONNECT_PUBLISHABLE_KEY` trim 後非空才 enabled。不要讀 Secret Key；不要在 runtime、文件、測試或 sample 中加入真實 Key。

`.env.example` 只能有：

```env
VITE_PERXONA_CONNECT_PUBLISHABLE_KEY=
```

## CONSTRAINTS

- 全部使用者介面與第一版文件使用繁體中文；英文僅限技術識別字。
- 這是私人練習工具，不是雇主評分、招募篩選、謊言偵測或心理判定。
- 不新增網路請求、雲端儲存、攝影機分析、即時語音或真正 Perxona Presenter；這些仍是後續風險增量。
- 不加入 Google Meet 名稱、Logo、圖示或品牌素材；保持自有 Raise Room 視覺。
- 不在程式碼、測試、README、文件或 `.env.example` 放真實薪資、API key、個資、原始視訊。
- 不安裝新依賴；使用現有 React／TypeScript／Vitest。
- 不修改現有 deterministic meeting domain 的事件去重邏輯。
- 維持 accessibility：表單 label、button aria name、heading hierarchy、status text 可被語意查詢。
- CSS 延續現有自有設計，報告需在窄螢幕可讀；不做無關重構。
- 遵守 TDD：每個新 domain behavior 與 UI flow 先有正確 RED，再做最小 GREEN。

## VERIFICATION

1. Report domain focused tests：

```bash
npm test -- src/domain/report.test.ts
```

成功：涵蓋四項規則、missing evidence、不偽造引文與 timestamp format；全部通過。

2. UI focused tests：

```bash
npm test -- src/components/CoachingReport.test.tsx src/components/MeetingRoom.test.tsx src/App.test.tsx
```

成功：結束會議交出 transcript、報告可看 evidence、再練一次保留 Scenario、重新設定回 setup；全部通過。

3. Perxona boundary tests：

```bash
npm test -- src/lib/perxona-config.test.ts
```

成功：missing／空白 key disabled，publishable key enabled，沒有 Secret Key 路徑。

4. 全套：

```bash
npm test -- --reporter=verbose
npm run build
git diff --check
```

成功：所有 test files／tests 通過、TypeScript 與 Vite build 成功、無 whitespace error。

5. Scope 與秘密掃描：

```bash
git status --short
git diff --name-only HEAD^
rg -n "pxc_|PERXONA_CONNECT_SECRET|Google Meet|自信度|誠實度" src README.md docs .env.example
```

成功：變更僅在 FILES AND OWNERSHIP；沒有 `pxc_`、Secret Key、Google 品牌或不允許的評分詞。若文件為說明禁用概念而出現後兩詞，需逐行說明而不是直接視為成功。

6. 文件內容：

- `README.md`：安裝、開發、測試、build、目前 MVP 能力、尚未啟用能力、local-first 說明。
- `docs/privacy-boundary.md`：原始視訊預設不離開裝置、逐字稿目前僅 React memory／local draft、未來第三方資料流必須明示、一鍵刪除要求。
- `docs/perxona-integration.md`：publishable key only、Secret Key server-only、目前 adapter 尚未接線、日後需遵守 domain restriction 與 Presenter readiness gate。

## RETURN

完成後回傳實際命令與證據；沒有證據的完成聲稱無效。

```text
IMPLEMENTATION REPORT
STATUS: complete | partial | blocked
OBJECTIVE: <one-line restatement>
CHANGES: <file-by-file summary from actual diff>
VERIFIED: <exact commands plus concrete output evidence>
JUDGMENT CALLS: <decisions the specification left open, or none>
GAPS: <unfinished work, ambiguity, or none>
```
