# Terra Execution Spec — Raise Room Meeting Stage + Perxona Presenter

## OBJECTIVE

把目前文字型會議畫面升級為可開源、可測、可降級的真實雙人會議舞台：右上使用者 tile 可在明確點擊後啟動本機攝影機；主舞台可選擇載入 Perxona `<sv-presenter>` 主管；沒有設定或載入失敗時仍完整保留 deterministic 文字會議。所有外部能力都必須 opt-in、可見、可關閉。

可觀察成果：使用者能在深色全螢幕 Raise Room 會議 UI 中開始／停止本機鏡頭、看到 10 分鐘倒數與事件抽屜、用文字 fallback 對談、結束看報告；當完整 `VITE_PERXONA_*` 設定存在時，可在一次直接使用者點擊中解鎖音訊並初始化 3D 主管，後續主管文字交給 Presenter 朗讀。

## AUTHORITATIVE SOURCES

- Perxona 官方 sample：`/Users/linshangche/Desktop/Perxona Connect Kit/perxona-connect-kit/tools/motion-browser/src/lib/presenter.ts`
- Perxona 官方 hook：`/Users/linshangche/Desktop/Perxona Connect Kit/perxona-connect-kit/tools/motion-browser/src/hooks/use-presenter.ts`
- Perxona 官方 lifecycle：`/Users/linshangche/Desktop/Perxona Connect Kit/perxona-connect-kit/samples/express/README.md` 的 `SDK: the <sv-presenter> Web Component`。
- Perxona types：固定 `@perxona/presenter-types@0.3.0`，npm registry 宣告 Node `>=20.11.0`。
- Camera API：<https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia>。必須直接由使用者授權、只可在 secure context，可能拒絕或永遠不回應。
- Video stream assignment：<https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/srcObject>。
- React effect cleanup：<https://react.dev/reference/react/useEffect>。

若官方 source 與本規格衝突，停止並回報；不可從記憶猜 SDK。

## FILES AND OWNERSHIP

Terra 只擁有：

- 修改 `package.json`
- 修改 `package-lock.json`
- 修改 `.env.example`
- 修改 `README.md`
- 修改 `docs/perxona-integration.md`
- 修改 `docs/privacy-boundary.md`
- 修改 `src/App.tsx`（僅必要的 env config handoff）
- 修改 `src/App.test.tsx`（僅必要 flow coverage）
- 修改 `src/components/MeetingRoom.tsx`
- 修改 `src/components/MeetingRoom.test.tsx`
- 新增 `src/components/LocalCameraTile.tsx`
- 新增 `src/components/LocalCameraTile.test.tsx`
- 新增 `src/components/PerxonaManagerStage.tsx`
- 新增 `src/components/PerxonaManagerStage.test.tsx`
- 新增 `src/hooks/use-local-camera.ts`
- 新增 `src/hooks/use-local-camera.test.tsx`
- 新增 `src/hooks/use-perxona-presenter.ts`
- 新增 `src/hooks/use-perxona-presenter.test.tsx`
- 新增 `src/lib/perxona-presenter.ts`
- 新增 `src/lib/perxona-presenter.test.ts`
- 修改 `src/lib/perxona-config.ts`
- 修改 `src/lib/perxona-config.test.ts`
- 修改 `src/styles.css`

不修改 Scenario、meeting domain、report domain、ScenarioWorkshop 或 CoachingReport。你不是唯一在 codebase 工作的人；保留目前 HEAD 與所有 concurrent edits，不還原或擴張。

## INTERFACES

### Presenter runtime config

保留現有 `readPerxonaConfig` 與 `PerxonaConfig`，避免破壞 Phase 1。新增：

```ts
export interface PerxonaTarget {
  avatarId: string;
  sceneId: string;
  voiceId: string;
}

export type PresenterRuntimeConfig =
  | { enabled: false; reason: "missing-key" | "missing-target" }
  | {
      enabled: true;
      publishableKey: string;
      presenterUrl: string;
      target: PerxonaTarget;
    };

export function readPresenterRuntimeConfig(
  env: Record<string, string | undefined>,
): PresenterRuntimeConfig;
```

固定預設 Presenter URL：

```text
https://cdn.perxona.ai/asia/prod/latest/widget/entry/presenter.js
```

只有 key、avatar ID、scene ID、voice ID 全部 trim 後非空才 enabled。只缺 key → `missing-key`；有 key 但 target 任一缺少 → `missing-target`。

### Presenter engine + client boundary

在 `src/lib/perxona-presenter.ts`：

```ts
import type {
  IPresentationWidget,
  PresentationResult,
  PresentationTarget,
} from "@perxona/presenter-types";

export type PresenterElement = HTMLElement & IPresentationWidget;

export interface PresenterClient {
  mount(container: HTMLElement): Promise<void>;
  subscribe(
    listener: (event: "ready" | "key-rejected") => void,
  ): () => void;
  initialize(connectKey: string, target: PresentationTarget): Promise<void>;
  resumeAudio(): Promise<void>;
  speak(text: string): Promise<PresentationResult | undefined>;
  interrupt(): void;
  destroy(): void;
}

export function isAllowedPresenterUrl(url: string): boolean;
export function loadPresenterEngine(url: string): Promise<void>;
export function createPresenterClient(url: string): PresenterClient;
```

`isAllowedPresenterUrl` 只接受 `https:`、hostname 精確 `cdn.perxona.ai`、pathname 以 `.js` 結尾。任何 query 可拒絕以保持簡單。URL 不合法時 `loadPresenterEngine` 必須在插入 script 前 reject。

script 只載入一次；load/error 後 promise 狀態可預測。`mount` 等 engine load 後建立單一 `<sv-presenter>`，寬高 100%，append 到 container，監聽：

- `PRESENTER_STATUS` 的 `Ready`
- `CONNECT_KEY_REJECTED`

`destroy` 移除 element 與監聽器，不可留下重複 canvas。`speak` 必須 trim 空白；空字串不呼叫 `present`。非成功 PresentationResult 由 hook 轉成可見錯誤。

`subscribe` 是 hook 與第三方 custom events 之間的唯一橋樑：`PRESENTER_STATUS` 只在 detail.status 精確等於 `Ready` 時發送 `ready`；`CONNECT_KEY_REJECTED` 發送 `key-rejected`。unsubscribe 與 destroy 都必須移除 listener。

### React presenter hook

```ts
export type PresenterStatus =
  | "disabled"
  | "loading"
  | "mounted"
  | "initializing"
  | "ready"
  | "key-rejected"
  | "error";

export function usePerxonaPresenter(input: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  config: PresenterRuntimeConfig;
  clientFactory?: (url: string) => PresenterClient;
}): {
  status: PresenterStatus;
  errorMessage: string | null;
  launch(): Promise<void>;
  speak(text: string): Promise<void>;
  interrupt(): void;
};
```

disabled 不載 script、不讀 key。mount／destroy 由 effect cleanup 管理。`launch` 必須只由「啟動 3D 主管」按鈕呼叫，順序為 `resumeAudio()` → `initialize(key,target)`；這是 Perxona autoplay 的官方要求。`speak` 只在 ready 執行。

### Local camera hook

```ts
export type CameraStatus =
  | "idle"
  | "requesting"
  | "active"
  | "denied"
  | "unavailable"
  | "error";

export function useLocalCamera(input?: {
  mediaDevices?: Pick<MediaDevices, "getUserMedia">;
}): {
  status: CameraStatus;
  stream: MediaStream | null;
  errorMessage: string | null;
  start(): Promise<void>;
  stop(): void;
};
```

`start` 由「開啟我的鏡頭」直接點擊觸發：

```ts
getUserMedia({
  audio: false,
  video: {
    facingMode: "user",
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
});
```

沒有 `navigator.mediaDevices` → unavailable；`NotAllowedError` → denied；其餘 → error。`stop` 與 unmount cleanup 必須對所有 tracks 呼叫 `stop()`，並清掉 stream。不得讀取、抽樣、上傳或保存 frame。

### Stage components

`LocalCameraTile`：

- idle 顯示使用者 initials／「鏡頭尚未開啟」與按鈕。
- active 將 `video.srcObject = stream`、`autoPlay`、`muted`、`playsInline`，顯示「關閉鏡頭」。
- denied／unavailable／error 使用繁中可理解狀態，不自動重試。
- 不在 mount 時要求權限。

`PerxonaManagerStage`：

- disabled 顯示既有主管 placeholder 與「尚未設定 Perxona」。
- loading／initializing 顯示明確狀態。
- mounted 顯示「啟動 3D 主管」按鈕。
- ready 顯示 `3D 主管已就緒` 與「停止發話」。
- key-rejected／error 顯示繁中錯誤，不循環 retry。
- 接受 `latestManagerText: string | null`；只在 ready 且文字變更時 speak，一段文字只說一次。
- 測試可注入 fake `PresenterClient`，不得真的載網路 script。

### MeetingRoom integration

- 保留所有既有 props 與 `onFinish(transcript)`。
- 新增 optional prop：

```ts
presenterConfig?: PresenterRuntimeConfig;
```

省略時使用 `{ enabled:false, reason:"missing-key" }`，確保既有 tests／open-source clone 無設定仍運作。

- 主 stage 為 PerxonaManagerStage；右上／次要 tile 為 LocalCameraTile。
- manager reply append 後，`latestManagerText` 交給 presenter stage。
- 視覺必須保留逐字稿與事件，但桌面用可收合 side panel；窄螢幕依序排列。
- 控制列：camera toggle、文字 fallback、跳到第 3 分鐘（標記為開發工具）、結束會議。

## VISUAL SYSTEM

建立 Raise Room 自有會議語言，不複製 Google：

- 深墨色 meeting canvas；neutral slate surface，不使用紫色 AI gradient。
- 上方資訊列只保留會議名稱、主管姓名、倒數與 `本機練習` 狀態。
- 主管 3D stage 佔桌面 70–75%；使用者 tile 固定在右側欄上方。
- 右側欄下方為事件 rail；逐字稿以底部／可收合 panel 呈現。
- 控制列固定底部、圓形控制按鈕只用在 media controls；主要 danger action「結束會議」保留文字。
- CSS 使用現有 tokens／新增 semantic tokens，4px spacing scale；不做過量圓角、陰影與 stock card grid。
- 320、768、1024、1440 寬度可用；meeting stage 不橫向 overflow。
- 所有狀態不能只靠顏色，需文字＋圖形符號。

## CONSTRAINTS

- 全部使用者文案繁中；技術識別字可英文。
- 不新增 Google 品牌、Logo、圖示、字串。
- 不新增 Chatbot、LLM、STT、MediaPipe 或視覺判分；此階段只有 camera local preview 與 Presenter 說 deterministic manager text。
- 不把 raw camera frame、stream、逐字稿、key 傳給 Raise Room 自有後端；本階段沒有後端。
- Publishable Key 只從 Vite env 讀；Secret Key 不得有任何前端路徑。
- 真實 `.env.local` 不提交；`.env.example` 只有空值與公開 URL。
- 只新增 `@perxona/presenter-types@0.3.0`，不得新增 UI／state／camera 第三方依賴。
- 所有第三方 output／event detail 視為 untrusted；只讀需要的 status 字串。
- 不破壞 Phase 1 deterministic fallback、逐字稿、report 與 local draft。
- 每個 behavior 先 RED 再 GREEN；視覺 CSS 需 browser runtime 驗收。

## ENVIRONMENT TEMPLATE

`.env.example`：

```env
VITE_PERXONA_API_BASE_URL=https://console.perxona.ai/asia
VITE_PRESENTER_URL=https://cdn.perxona.ai/asia/prod/latest/widget/entry/presenter.js
VITE_PERXONA_CONNECT_PUBLISHABLE_KEY=
VITE_PERXONA_AVATAR_ID=
VITE_PERXONA_SCENE_ID=
VITE_PERXONA_VOICE_ID=
```

`App` 呼叫 `readPresenterRuntimeConfig(import.meta.env)`，只把結果傳入 MeetingRoom；不要在 component 直接散讀 env。

## VERIFICATION

### Config + URL boundary

```bash
npm test -- src/lib/perxona-config.test.ts src/lib/perxona-presenter.test.ts
```

成功：缺 key／缺 target disabled、完整設定 enabled、只接受官方 CDN JS、script once、client destroy；無真網路。

### Camera

```bash
npm test -- src/hooks/use-local-camera.test.tsx src/components/LocalCameraTile.test.tsx
```

成功：不自動請求、start constraints 精確、active video、stop／unmount track cleanup、denied／unavailable 可見。

### Presenter

```bash
npm test -- src/hooks/use-perxona-presenter.test.tsx src/components/PerxonaManagerStage.test.tsx
```

成功：disabled 無副作用、launch 順序 resume→initialize、Ready 後一段只 speak 一次、error／key rejected 可見、destroy cleanup。

### Meeting regression

```bash
npm test -- src/components/MeetingRoom.test.tsx src/App.test.tsx
```

成功：原有 event／async／transcript handoff／report flow 全通過，新 stage 在 missing config 下可降級。

### Full

```bash
npm test -- --reporter=verbose
npm run build
git diff --check
git status --short
```

成功：全部通過、build 無錯、只有 ownership files 變更、無未提交 product change。

### Security scan

```bash
rg -n "pxc_|PERXONA_CONNECT_SECRET|Google Meet|fetch\(|XMLHttpRequest|WebSocket" src README.md docs .env.example
```

成功：無真 Key、Secret、Google 品牌或 Raise Room 自有網路呼叫。官方 Presenter script element 不算 `fetch`，但必須通過 allowlist。

## DOCUMENTATION

- README 增加 Phase 2：可選本機鏡頭、可選 Perxona Presenter、如何用 `npm run dev -- --host`。
- 明確說明 `getUserMedia` 需 secure context；`http://lvh.me` 不足以同時驗證 camera。
- `docs/perxona-integration.md` 記錄官方初始化順序、publishable/secret boundary、target IDs 與 domain restriction。
- `docs/privacy-boundary.md` 記錄 camera stream 只指派給本機 `<video>`、stop/unmount 釋放 tracks、沒有 frame analysis。

## RETURN

寫完整報告到 `.superpowers/terra-stage-report.md`，並回傳：

```text
IMPLEMENTATION REPORT
STATUS: complete | partial | blocked
OBJECTIVE: <one line>
CHANGES: <actual file-by-file summary>
VERIFIED: <exact commands and concrete evidence>
JUDGMENT CALLS: <explicit decisions or none>
GAPS: <remaining gaps or none>
```
