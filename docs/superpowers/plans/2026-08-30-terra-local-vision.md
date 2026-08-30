# Terra Execution Spec — Raise Room Local Visual Signals

## OBJECTIVE

完成不需新 Perxona Key、也不會自動要求攝影機權限的 Phase 4：使用者開啟既有本機鏡頭後，可明確下載／載入 MediaPipe Face Landmarker，再明確啟動本機視覺觀察；frame 只傳到同頁 Web Worker，worker 立即縮減成可觀察數值並關閉 ImageBitmap，不保存／上傳 landmark 或畫面。會議結束後報告顯示臉部可見率、置中率、距離穩定率與「鏡頭方向近似」率，全部附透明定義與限制。

可觀察成果：無視覺設定時 Phase 1–3 完整運作；Face Landmarker 模型 ready 後，使用者可開始／停止觀察；UI 顯示目前是否偵測到單一臉部與樣本數；報告只接收 aggregate counts／ratios，沒有 raw frame、landmarks、blendshapes、情緒 label 或身份資訊。

## AUTHORITATIVE SOURCES

- Google 官方 MediaPipe sample：<https://github.com/google-ai-edge/mediapipe-samples-web>
- 官方 Face Landmarker task：<https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/tasks/face-landmarker.ts>
- 官方 Worker：<https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/workers/face-landmarker.worker.ts>
- 官方 package：`@mediapipe/tasks-vision@1.0.1`（Apache-2.0）。
- 固定模型：`https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`
- Face Landmarker 提供 478 landmarks、optional blendshapes／transformation matrices；本專案只使用 landmarks，不開 blendshapes，不推論表情／情緒。

依官方 sample 使用 VIDEO running mode、單調 timestamp、ImageBitmap transfer、worker 內 `detectForVideo`、finally close bitmap、GPU failure 後 CPU fallback。不得從舊版 MediaPipe 範例或記憶猜 API。

## FILES AND OWNERSHIP

Terra 只擁有：

- 修改 `package.json`
- 修改 `package-lock.json`
- 修改 `.gitignore`
- 新增 `scripts/copy-mediapipe-assets.mjs`
- 修改 `README.md`
- 修改 `docs/privacy-boundary.md`
- 新增 `src/domain/visual.ts`
- 新增 `src/domain/visual.test.ts`
- 新增 `src/lib/local-vision.ts`
- 新增 `src/lib/local-vision.test.ts`
- 新增 `src/workers/face-landmarker.worker.ts`
- 新增 `src/hooks/use-local-vision.ts`
- 新增 `src/hooks/use-local-vision.test.tsx`
- 新增 `src/components/LocalVisualControl.tsx`
- 新增 `src/components/LocalVisualControl.test.tsx`
- 修改 `src/components/LocalCameraTile.tsx`
- 修改 `src/components/LocalCameraTile.test.tsx`
- 修改 `src/components/MeetingRoom.tsx`
- 修改 `src/components/MeetingRoom.test.tsx`
- 修改 `src/App.tsx`
- 修改 `src/App.test.tsx`
- 修改 `src/components/CoachingReport.tsx`
- 修改 `src/components/CoachingReport.test.tsx`
- 修改 `src/styles.css`

不修改 Scenario、meeting／delivery／report domain、voice／clock、Perxona Presenter 或 Sol plans。你不是唯一在 codebase 工作的人；保留 concurrent edits，不擴張 ownership。

## GENERATED ASSETS

只新增 pinned `@mediapipe/tasks-vision@1.0.1`。新增 npm script：

```json
{
  "scripts": {
    "prepare:mediapipe": "node scripts/copy-mediapipe-assets.mjs",
    "postinstall": "npm run prepare:mediapipe"
  }
}
```

copy script：

- source 固定 `node_modules/@mediapipe/tasks-vision/wasm`。
- destination 固定 `public/mediapipe/wasm`。
- 使用 Node `fs.cp` recursive；只處理固定路徑，不接受 CLI path。
- source 不存在時明確失敗。
- destination 加入 `.gitignore`，不提交 generated WASM。
- build 前本工作環境必須已執行 `npm run prepare:mediapipe`。

## INTERFACES

### Pure frame observation

在 `src/domain/visual.ts`：

```ts
export interface LandmarkPoint {
  x: number;
  y: number;
}

export interface VisualFrameObservation {
  timestampMs: number;
  hasFace: boolean;
  faceCenterX: number | null;
  faceCenterY: number | null;
  faceAreaRatio: number | null;
  irisHorizontalOffset: number | null;
}

export interface VisualAggregate {
  sampleCount: number;
  faceVisibleCount: number;
  centeredCount: number;
  stableDistanceCount: number;
  cameraDirectionCount: number;
  cameraDirectionEligibleCount: number;
}

export interface VisualSignals {
  sampleCount: number;
  faceVisibleRatio: number | null;
  centeredRatio: number | null;
  stableDistanceRatio: number | null;
  cameraDirectionEstimateRatio: number | null;
}

export function extractVisualObservation(
  timestampMs: number,
  landmarks: LandmarkPoint[] | undefined,
): VisualFrameObservation;

export function createVisualAggregate(): VisualAggregate;
export function addVisualObservation(
  aggregate: VisualAggregate,
  observation: VisualFrameObservation,
): VisualAggregate;
export function toVisualSignals(aggregate: VisualAggregate): VisualSignals;
```

演算法透明固定：

- landmarks 不存在／少於基本 face points → hasFace false，其餘 null。
- bounds 用所有 finite x/y；center = bounds midpoint；area = width*height。
- centered：hasFace 且 centerX 0.35..0.65、centerY 0.25..0.65。
- stable distance：hasFace 且 area 0.08..0.45。
- iris：只有 >=478 points；左／右 iris 分別 indices 468–472、473–477；對應 eye corners 33/133 與 362/263。每眼算 iris mean 在兩 corner X 範圍的位置，再以 `abs(position-0.5)*2` 得 0..1 offset；兩眼平均。
- camera direction estimate：iris offset <=0.35。這只是 frame geometry 近似，不是 eye contact。
- sampleCount 每 observation +1；face ratios 分母 sampleCount；center／distance 分子只有 face frame 但分母仍 sampleCount（反映離開畫面）；camera direction 分母只用 iris eligible frames。
- 沒有分母 → null；所有 ratio clamp 0..1。

不得輸出身份 embedding、gender、age、emotion、expression class、confidence/personality。

### Worker protocol

在 `src/lib/local-vision.ts`：

```ts
export type VisionWorkerRequest =
  | { type: "load" }
  | { type: "analyze"; requestId: string; timestampMs: number; bitmap: ImageBitmap }
  | { type: "close" };

export type VisionWorkerEvent =
  | { type: "loading"; progress: number | null; message: string }
  | { type: "ready"; delegate: "GPU" | "CPU" }
  | { type: "observation"; requestId: string; observation: VisualFrameObservation }
  | { type: "error"; requestId?: string; message: string };

export interface VisionWorkerPort {
  postMessage(message: VisionWorkerRequest, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  terminate(): void;
}

export interface LocalVisionClient {
  subscribe(listener: (event: VisionWorkerEvent) => void): () => void;
  load(): void;
  analyze(bitmap: ImageBitmap, timestampMs: number): Promise<VisualFrameObservation>;
  destroy(): void;
}

export function parseVisionWorkerEvent(value: unknown): VisionWorkerEvent | null;
export function createLocalVisionClient(
  workerFactory?: () => VisionWorkerPort,
): LocalVisionClient;
```

validation：type allowlist、requestId string、delegate enum、progress normalized 0..1、observation 每欄 finite／null、ratio fields合理範圍。malformed ignored。analyze transfer bitmap；complete/error correlation；destroy reject pending、post close、remove listener、terminate。

### Face Landmarker worker

`src/workers/face-landmarker.worker.ts`：

- import `FaceLandmarker`, `FilesetResolver` from `@mediapipe/tasks-vision`。
- wasm base 固定 `/mediapipe/wasm`。
- model URL 固定上述 Google model；不可接受 message 傳 URL。
- load model ArrayBuffer with fetch；progress 依 content-length normalized，無 length → null。
- `FaceLandmarker.createFromOptions`：runningMode VIDEO、numFaces 1、thresholds 0.5、`outputFaceBlendshapes:false`、`outputFacialTransformationMatrixes:false`。
- 先 GPU delegate；失敗 close partial instance，再 CPU fallback；ready 回實際 delegate。
- analyze：一次只處理一張；timestamp 必須 finite 且單調遞增，不足則 last+1；`detectForVideo(bitmap,timestamp)`；只取第一張臉 landmarks，立刻呼叫 `extractVisualObservation`；worker event 只送 observation。
- bitmap 在所有 success/error/busy 路徑 finally close。
- close：FaceLandmarker.close、清引用。
- Worker inbound 也驗證 type／requestId／timestamp／bitmap-like；不合法 bitmap 若可 close 仍 close。

### Local vision hook

```ts
export type VisionStatus =
  | "idle"
  | "loading-model"
  | "ready"
  | "observing"
  | "unsupported"
  | "error";

export function useLocalVision(input: {
  videoElement: HTMLVideoElement | null;
  client?: LocalVisionClient;
  clientFactory?: () => LocalVisionClient;
  createBitmap?: (source: HTMLVideoElement) => Promise<ImageBitmap>;
  now?: () => number;
  sampleIntervalMs?: number;
}): {
  status: VisionStatus;
  progress: number | null;
  lastObservation: VisualFrameObservation | null;
  signals: VisualSignals;
  errorMessage: string | null;
  loadModel(): void;
  startObserving(): void;
  stopObserving(): void;
  resetSignals(): void;
  getSignals(): VisualSignals;
};
```

規則：

- mount 不 load model、不讀 frame。
- default client 可建立 Worker 但 StrictMode cleanup 必須重建；injected client caller-owned，不 destroy。
- loadModel 明確按鈕；loading/ready/error validated。
- start 只在 ready 且 videoElement、srcObject、readyState>=2；否則繁中 error。
- observation loop 5fps default（200ms）；若上一 frame pending 不建立新 bitmap。
- 每 frame `createBitmap(video)`，client analyze；observation immediately aggregate，state 只留 lastObservation + aggregate/signals，不存 array。
- stop clear timer/RAF、status ready，不清 signals；reset 才清。
- unmount stop、destroy owned client；late result 不 setState；若 bitmap 建立後已 stop，必須 close bitmap。

### UI + camera handoff

`LocalCameraTile` 新增 optional：

```ts
onVideoElement?(element: HTMLVideoElement | null): void;
```

用 callback ref 回報 active video；inactive/unmount 回 null。不要傳 raw frame 或 stream 到 App。

`LocalVisualControl` props：

```ts
{
  vision?: ReturnType<typeof useLocalVision>;
  cameraActive: boolean;
}
```

像 VoiceControl 分 pure view／owned wrapper，injected 不建 default Worker。UI：

- idle：說明「模型檔首次下載；畫面不會上傳」＋「載入本機視覺模型」。
- loading：progress。
- ready：camera inactive → disabled「請先開啟鏡頭」；active →「開始本機視覺觀察」。
- observing：「視覺觀察中」＋偵測狀態＋樣本數＋「停止觀察」。
- error／unsupported：繁中 fallback，不自動重試。
- 固定 disclaimer：「只看畫面幾何，不判斷情緒、誠實或自信」。

### Meeting outcome handoff — backward compatible

MeetingRoom：

- state `cameraVideoElement` 由 LocalCameraTile callback ref。
- `const vision = useLocalVision({videoElement})`；LocalVisualControl receive vision + camera active。
- control 放 camera tile/事件 sidebar 下方，不擠壓底部 voice controls。
- `onFinish` 保持第一參數 transcript，新增 optional 第二參數：

```ts
onFinish?: (
  transcript: TranscriptTurn[],
  visualSignals?: VisualSignals,
) => void;
```

- manual／auto finish 共同 helper：sampleCount>0 才傳第二參數；否則只以一個 argument 呼叫，保留既有 tests/consumer observable behavior。
- finish 前 stopObserving；只傳 aggregate signals。

App report state 新增 optional visualSignals；onFinish 接第二參數；CoachingReport 新增 optional prop。`再練一次` 新 session 不沿用舊 signals。

### Report UI

新增「可觀察視覺訊號」：

- no signals／sampleCount=0：「本局未啟用視覺觀察」。
- 樣本數。
- 臉部可見率、置中率、距離穩定率、鏡頭方向近似率；null →「資料不足」。
- percent 顯示 round whole percentage。
- 固定說明：`鏡頭方向只是 iris 幾何近似，不等於眼神接觸；所有數值都不是情緒、誠實、自信或能力分數。`

不能把 ratio 納入優缺點 recommendation 或總分。

## CONSTRAINTS

- 全部 UI／文件繁中；技術 ID 可英文。
- 不啟用 face blendshapes／transformation matrices，不做表情／情緒分類。
- 不做 face recognition、identity、age、gender、biometrics storage。
- frame／ImageBitmap／landmarks 不離開 browser、不寫 disk／localStorage／report；只有 aggregate counts/ratios 進 App state。
- 模型／WASM 首次從 Google/npm package 來源載入；清楚揭露，不能寫完全離線。
- 只新增 `@mediapipe/tasks-vision@1.0.1`；不加其他 vision/UI/state 依賴。
- tests 不下載模型、不開 camera、不建真 worker；全部 injection。
- 保留 Phase 1–3 text、voice、timer、camera、Presenter、report 行為。
- TDD；protocol validation、bitmap close、single in-flight、StrictMode、aggregate no-array、finish no-signal one-arg compatibility 必須測。

## VERIFICATION

### Pure domain

```bash
npm test -- src/domain/visual.test.ts
```

涵蓋：no face、bounds／center／area、iris offset、aggregate ratios/null、malformed non-finite points。

### Worker client boundary

```bash
npm test -- src/lib/local-vision.test.ts
```

涵蓋：malformed event、progress、load、request correlation／transfer、error、destroy pending／terminate。

### Hook/UI

```bash
npm test -- src/hooks/use-local-vision.test.tsx src/components/LocalVisualControl.test.tsx src/components/LocalCameraTile.test.tsx
```

涵蓋：no auto load/frame、StrictMode owned recreation、injected no default worker、camera not ready error、5fps single in-flight、late bitmap close、aggregate no raw array、stop/reset、UI states/disclaimer。

### App/Meeting/Report

```bash
npm test -- src/components/MeetingRoom.test.tsx src/App.test.tsx src/components/CoachingReport.test.tsx
```

涵蓋：no-signal onFinish one argument、signals second arg、App handoff/reset、report percentages/no-data/disclaimer、Phase 1–3 regression。

### Generated assets/build

```bash
npm run prepare:mediapipe
test -f public/mediapipe/wasm/vision_wasm_internal.wasm || test -n "$(find public/mediapipe/wasm -type f -maxdepth 1 -print -quit)"
npm test -- --reporter=verbose
npm run build
git diff --check
git status --short
```

成功：generated WASM 存在但 git ignored；all tests/build green；Vite face worker emitted。

### Security scan

```bash
rg -n "outputFaceBlendshapes:\s*true|outputFacialTransformationMatrixes:\s*true|emotion|honesty|confidence|face recognition|localStorage.*(frame|landmark|visual)|pxc_|PERXONA_CONNECT_SECRET" src README.md docs/privacy-boundary.md
```

成功：無禁用功能／心理判定／儲存／key。Disclaimers 若含禁用概念需逐行確認為否定文案。

## DOCUMENTATION

README／privacy：

- 視覺模型與 WASM 首次載入來源。
- 只有點擊後分析；先開 camera，再 load/start observation。
- 5fps、單 frame in-flight、raw frame/landmarks immediately discarded。
- 四項 signals 的透明門檻。
- iris 幾何不是 eye contact；數值不可作 HR／雇主／招募用途。
- 真實 camera permission 仍需使用者在 browser 即時同意。

## RETURN

完整 ignored report 寫 `.superpowers/terra-vision-report.md`，回傳：

```text
IMPLEMENTATION REPORT
STATUS: complete | partial | blocked
OBJECTIVE: one line
CHANGES: actual file-by-file summary
VERIFIED: exact commands + concrete evidence
JUDGMENT CALLS: explicit decisions or none
GAPS: remaining gaps or none
```
