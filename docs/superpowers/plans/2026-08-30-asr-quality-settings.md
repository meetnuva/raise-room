# Raise Room High-Quality ASR Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把固定 `whisper-tiny` 升級為可設定的高品質／平衡／快速本機 ASR，新增設定頁麥克風吻合度測試與正式會議送出前編輯，同時維持 local-first、明確權限與 Worker 生命週期。

**Architecture:** 模型 catalog、文字比對、正體轉換與 localStorage 各自為純邏輯模組；Worker 只接受 allowlisted preset；`useLocalVoice` 負責裝置與 Worker lifecycle；`VoiceSettings` 負責模型 A/B 測試；`LocalVoiceControl` 負責正式會議轉錄預覽。模型權重仍由 Hugging Face 首次下載並由 browser cache 重用，不進 Git 或 build。

**Tech Stack:** React 19.2.8、TypeScript 7.0.2、Vite 8.2.2、Vitest 4.1.11、Transformers.js 4.2.0、`opencc-js@1.4.1`、Web Worker、MediaRecorder、WebGPU/WASM。

**Approved Design:** `docs/superpowers/specs/2026-08-30-asr-quality-settings-design.md` at commit `685aa55`。

## Global Constraints

- Default preset is `quality`; do not auto-download any model.
- Preset IDs are exactly `quality | balanced | fast`.
- Quality model is exactly `onnx-community/whisper-large-v3-turbo`, WebGPU-only, encoder `fp16`, decoder `q4`, approximate download 1535 MB.
- Balanced model is exactly `onnx-community/whisper-small`, WebGPU encoder `fp16` + decoder `q4`, approximate download 390 MB; WASM `q8` allowed with warning.
- Fast model is exactly `onnx-community/whisper-tiny`, WebGPU encoder `fp32` + decoder `q4`, approximate download 114 MB; WASM `q8` allowed.
- Worker never accepts arbitrary model IDs or URLs.
- Settings recording maximum is 20 seconds; meeting inference still uses only the last 30 seconds.
- Microphone tracks stop before inference.
- Settings audio/reference/transcript/score never reaches Perxona, server, transcript or localStorage.
- Meeting transcript is editable before submit; only edited text reaches manager/transcript.
- Chinese uses OpenCC `cn → tw`; English/Japanese are not converted.
- Label is `文字吻合度`; never `信心分數`, `能力分數`, or psychological inference.
- One ASR Worker/model at a time. Switching preset, leaving Settings/Meeting, explicit release and unmount terminate it.
- No OpenAI/cloud transcription in this phase.
- Preserve ignored `.env.local`, Perxona credentials, Presenter targets, server API and visual algorithms.
- Every behavior change follows RED → expected failure → GREEN → focused/full verification → atomic commit.

---

### Task 1: Model catalog and persisted voice setting

**Files:**
- Create: `src/domain/asr-models.ts`
- Create: `src/domain/asr-models.test.ts`
- Create: `src/lib/voice-settings.ts`
- Create: `src/lib/voice-settings.test.ts`

**Interfaces:**

```ts
export type AsrModelPresetId = "quality" | "balanced" | "fast";
export interface AsrModelPreset { /* approved spec fields */ }
export const defaultAsrModelPresetId: AsrModelPresetId = "quality";
export const asrModelPresets: Readonly<Record<AsrModelPresetId, AsrModelPreset>>;
export function isAsrModelPresetId(value: unknown): value is AsrModelPresetId;
export function isPresetAvailable(id: AsrModelPresetId, hasWebGpu: boolean): boolean;

export const voiceSettingsStorageKey = "raise-room-voice-settings-v1";
export function readVoiceSettings(storage: Pick<Storage,"getItem">): { modelPreset: AsrModelPresetId };
export function writeVoiceSettings(storage: Pick<Storage,"setItem">, settings: {modelPreset: AsrModelPresetId}): void;
```

- [ ] **Step 1: Write catalog RED tests**

```ts
test("uses high quality as the non-downloading default", () => {
  expect(defaultAsrModelPresetId).toBe("quality");
  expect(asrModelPresets.quality).toMatchObject({
    modelId: "onnx-community/whisper-large-v3-turbo",
    approximateDownloadMb: 1535,
    webgpuRequired: true,
  });
});

test("disables only quality when WebGPU is missing", () => {
  expect(isPresetAvailable("quality", false)).toBe(false);
  expect(isPresetAvailable("balanced", false)).toBe(true);
  expect(isPresetAvailable("fast", false)).toBe(true);
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/domain/asr-models.test.ts --reporter=verbose`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement immutable catalog and allowlist**

Use literal `as const` data. Labels and descriptions:

- quality: `高品質` / `最準確，首次約 1.5 GB`
- balanced: `平衡` / `品質與速度平衡，首次約 390 MB`
- fast: `快速` / `速度優先，首次約 114 MB`

No model value comes from storage or URL.

- [ ] **Step 4: Write storage RED tests**

Cover missing, malformed JSON, unknown preset and valid quality/balanced/fast. Unknown/malformed returns `{modelPreset:"quality"}`. `writeVoiceSettings` serializes only `modelPreset`.

- [ ] **Step 5: Implement storage and verify GREEN**

```bash
npm test -- src/domain/asr-models.test.ts src/lib/voice-settings.test.ts --reporter=verbose
```

- [ ] **Step 6: Commit**

```bash
git add src/domain/asr-models.ts src/domain/asr-models.test.ts src/lib/voice-settings.ts src/lib/voice-settings.test.ts
git commit -m "feat: define local ASR model presets"
```

---

### Task 2: Traditional Chinese normalization and match metric

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/traditional-chinese.ts`
- Create: `src/lib/traditional-chinese.test.ts`
- Create: `src/domain/transcript-accuracy.ts`
- Create: `src/domain/transcript-accuracy.test.ts`

**Interfaces:**

```ts
export function toTaiwanTraditional(text: string): string;
export function normalizeTranscriptText(text: string, language: VoiceLanguage): string;
export interface TranscriptDiffPart { type: "equal"|"insert"|"delete"|"replace"; expected: string; actual: string; }
export function compareTranscript(reference: string, actual: string, language: VoiceLanguage): {
  normalizedReference: string;
  normalizedActual: string;
  distance: number;
  matchRatio: number | null;
  parts: TranscriptDiffPart[];
};
```

- [ ] **Step 1: Add pinned dependency**

Run: `npm install --save-exact opencc-js@1.4.1`

Verify exact version and confirm `npm audit --omit=dev --json` adds no unreviewed advisory.

- [ ] **Step 2: Write OpenCC RED tests**

```ts
expect(toTaiwanTraditional("交付时间和两个续约客户")).toBe("交付時間和兩個續約客戶");
expect(toTaiwanTraditional("客户投诉下降百分之三十")).toContain("客戶投訴下降百分之三十");
```

- [ ] **Step 3: Implement browser ESM wrapper**

Use `OpenCC.Converter({ from: "cn", to: "tw" })`. Prefer `opencc-js/cn2t` if its exported API passes typecheck/tests; otherwise use official root ESM and record bundle delta in Task 7. Never fetch dictionaries at runtime.

- [ ] **Step 4: Write match metric RED tests**

Cover zh simplified vs traditional, punctuation/whitespace, English case, Japanese preservation, substitution/insertion/deletion, empty reference and Unicode code points.

- [ ] **Step 5: Implement normalization, Levenshtein and backtrace**

Use NFKC and Unicode property regexes. Do not add a diff dependency. Clamp ratio to `[0,1]`.

- [ ] **Step 6: Verify and commit**

```bash
npm test -- src/lib/traditional-chinese.test.ts src/domain/transcript-accuracy.test.ts --reporter=verbose
npm run build
git add package.json package-lock.json src/lib/traditional-chinese.ts src/lib/traditional-chinese.test.ts src/domain/transcript-accuracy.ts src/domain/transcript-accuracy.test.ts
git commit -m "feat: compare Taiwan Traditional transcripts"
```

---

### Task 3: Preset-aware ASR Worker boundary

**Files:**
- Modify: `src/lib/local-asr.ts`
- Modify: `src/lib/local-asr.test.ts`
- Create: `src/lib/asr-runtime-config.ts`
- Create: `src/lib/asr-runtime-config.test.ts`
- Modify: `src/workers/whisper.worker.ts`
- Create: `src/workers/whisper.worker.test.ts` only if import can be isolated without fake globals.

**Interfaces:**

```ts
type AsrWorkerRequest =
  | { type:"load"; preset:AsrModelPresetId }
  | { type:"transcribe"; requestId:string; preset:AsrModelPresetId; audio:Float32Array; language:VoiceLanguage }
  | { type:"close" };

interface LocalAsrClient {
  load(preset: AsrModelPresetId): void;
  transcribe(audio: Float32Array, language: VoiceLanguage, preset: AsrModelPresetId): Promise<string>;
  destroy(): void;
}

export function getAsrRuntimeConfig(preset: AsrModelPresetId, hasWebGpu: boolean):
  | {ok:true; modelId:string; device:"webgpu"|"wasm"; dtype:unknown}
  | {ok:false; message:string};
```

- [ ] **Step 1: Write client contract RED tests**

Prove preset in load/transcribe, transfer list preserved, destroy posts close then terminates, and pending requests reject.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/lib/local-asr.test.ts --reporter=verbose`

Expected: old load expectation fails.

- [ ] **Step 3: Implement client/request changes**

Callers pass preset IDs only, never model IDs. Keep event correlation unchanged.

- [ ] **Step 4: Write runtime config RED tests**

```ts
expect(getAsrRuntimeConfig("quality", true)).toMatchObject({
  ok:true, modelId:"onnx-community/whisper-large-v3-turbo", device:"webgpu",
  dtype:{encoder_model:"fp16",decoder_model_merged:"q4"},
});
expect(getAsrRuntimeConfig("quality", false)).toMatchObject({ok:false});
expect(getAsrRuntimeConfig("balanced", false)).toMatchObject({ok:true,device:"wasm",dtype:"q8"});
```

- [ ] **Step 5: Implement Worker runtime selection**

- Remove fixed `modelId`.
- Track `activePreset`; transcribe must match it.
- Quality without WebGPU errors and never attempts WASM.
- Balanced/fast may fall back to q8 WASM.
- Preserve warm-up, streaming and max 64 tokens.
- Close clears references where supported; Worker termination is hard cleanup.

- [ ] **Step 6: Verify and commit**

```bash
npm test -- src/lib/local-asr.test.ts src/lib/asr-runtime-config.test.ts src/workers/whisper.worker.test.ts --reporter=verbose
npm run build
git add src/lib/local-asr.ts src/lib/local-asr.test.ts src/lib/asr-runtime-config.ts src/lib/asr-runtime-config.test.ts src/workers/whisper.worker.ts src/workers/whisper.worker.test.ts
git commit -m "feat: load allowlisted Whisper presets"
```

Omit optional test file from command if it was not needed; never create an empty file.

---

### Task 4: Preset-aware local voice lifecycle

**Files:**
- Modify: `src/hooks/use-local-voice.ts`
- Modify: `src/hooks/use-local-voice.test.tsx`

**Interfaces:**

```ts
interface VoiceTranscriptResult {
  rawText: string;
  text: string;
  durationSeconds: number;
  language: VoiceLanguage;
  modelPreset: AsrModelPresetId;
}

useLocalVoice({ modelPreset, ...injections }) => {
  /* existing fields */
  device: "webgpu"|"wasm"|null;
  releaseModel(): void;
}
```

- [ ] **Step 1: Write RED lifecycle tests**

Cover explicit preset load, preset transcribe, raw + normalized zh, preset switch destroys owned client, injected ownership, explicit release/recreate, unmount and track cleanup.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/hooks/use-local-voice.test.tsx --reporter=verbose`

- [ ] **Step 3: Implement lifecycle**

Preset change while recording first cancels; UI also disables switch. Avoid duplicate StrictMode clients. `releaseModel()` stops streams/context, destroys owned client, clears progress/partial/error/device and returns idle.

- [ ] **Step 4: Preserve audio rules**

Duration starts at recorder start. Tracks stop after recorder stop event and before decode/transcribe. Final text converts only zh; raw remains memory-only.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- src/hooks/use-local-voice.test.tsx src/lib/local-asr.test.ts --reporter=verbose
git add src/hooks/use-local-voice.ts src/hooks/use-local-voice.test.tsx
git commit -m "feat: switch local voice model lifecycle"
```

---

### Task 5: Voice Settings page and microphone comparison

**Files:**
- Create: `src/components/VoiceSettings.tsx`
- Create: `src/components/VoiceSettings.test.tsx`
- Create: `src/components/TranscriptComparison.tsx`
- Create: `src/components/TranscriptComparison.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**

```ts
interface VoiceSettingsProps {
  savedPreset: AsrModelPresetId;
  onSave(preset: AsrModelPresetId): void;
  onBack(): void;
}
```

- [ ] **Step 1: Write App navigation RED test**

Setup shows `語音設定`; click opens heading `語音模型與麥克風測試`; `返回情境設定` returns without mutating scenario draft.

- [ ] **Step 2: Write model card RED tests**

Assert three exact cards, quality selected by default, sizes displayed, no model/mic action on mount, and quality disabled with clear copy when WebGPU is absent. Inject availability instead of mutating global browser APIs when practical.

- [ ] **Step 3: Write microphone test RED tests**

With injected voice controller and fake timer, prove:

- click required before model load and mic request;
- recording countdown auto-stops once at 20 seconds;
- result stores `resultsByPreset[preset]` in component memory only;
- raw text, Taiwan Traditional text, diff and integer percentage render;
- switching model calls release on prior controller and keeps earlier comparison visible;
- test never calls manager responder or local server;
- `使用這個模型` calls `onSave` and storage contains preset only.

- [ ] **Step 4: Implement UI orchestration**

Suggested state:

```ts
type TestResult = VoiceTranscriptResult & ReturnType<typeof compareTranscript>;
const [selectedPreset,setSelectedPreset] = useState(savedPreset);
const [referenceText,setReferenceText] = useState(defaultReference[language]);
const [resultsByPreset,setResultsByPreset] = useState<Partial<Record<AsrModelPresetId,TestResult>>>({});
```

Language change replaces default reference only when user has not edited it. Model switch is disabled during recording/transcribing. Add aria-live for loading/recording/transcribing.

- [ ] **Step 5: Implement App persistence**

App initializes voice settings once from localStorage, adds settings view, saves via `writeVoiceSettings`, and passes saved preset into MeetingRoom. Never persist reference, test text, score or permission state.

- [ ] **Step 6: Verify and commit**

```bash
npm test -- src/components/VoiceSettings.test.tsx src/components/TranscriptComparison.test.tsx src/App.test.tsx --reporter=verbose
git add src/components/VoiceSettings.tsx src/components/VoiceSettings.test.tsx src/components/TranscriptComparison.tsx src/components/TranscriptComparison.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: test microphone accuracy in settings"
```

---

### Task 6: Meeting transcript preview before submission

**Files:**
- Create: `src/components/VoiceTranscriptPreview.tsx`
- Create: `src/components/VoiceTranscriptPreview.test.tsx`
- Modify: `src/components/LocalVoiceControl.tsx`
- Modify: `src/components/LocalVoiceControl.test.tsx`
- Modify: `src/components/MeetingRoom.tsx`
- Modify: `src/components/MeetingRoom.test.tsx`
- Modify: `src/domain/meeting.ts`
- Modify: `src/domain/meeting.test.ts`

**Interfaces:**

```ts
interface TurnDelivery {
  source: "text"|"voice";
  durationSeconds?: number;
  modelPreset?: AsrModelPresetId;
}

interface VoiceTranscriptPreviewProps {
  result: VoiceTranscriptResult;
  disabled?: boolean;
  onConfirm(editedText: string): void;
  onRetry(): void;
  onCancel(): void;
}
```

- [ ] **Step 1: Write preview RED test**

Show editable textarea prefilled with Taiwan Traditional `result.text`, collapsed raw text only when different, and `送給主管`, `重新錄音`, `取消`. Whitespace-only disables confirm; confirm trims.

- [ ] **Step 2: Write LocalVoiceControl RED test**

Stopping recording no longer calls `onTranscript`. It renders preview; only confirm sends edited result. Retry clears the pending result and returns to ready; it must not request the microphone again until the user explicitly clicks `開始說話`. Cancel clears without manager call.

- [ ] **Step 3: Update MeetingRoom RED tests**

Before confirm transcript/responder remain unchanged. After confirm edited text is appended with voice duration + preset; raw ASR never reaches transcript/report.

- [ ] **Step 4: Implement preview flow**

`LocalVoiceControl` owns pending result. `MeetingRoom` maps confirmed `result.text` to `submitUserMessage`; preview never imports Perxona code.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- src/components/VoiceTranscriptPreview.test.tsx src/components/LocalVoiceControl.test.tsx src/components/MeetingRoom.test.tsx src/domain/meeting.test.ts --reporter=verbose
git add src/components/VoiceTranscriptPreview.tsx src/components/VoiceTranscriptPreview.test.tsx src/components/LocalVoiceControl.tsx src/components/LocalVoiceControl.test.tsx src/components/MeetingRoom.tsx src/components/MeetingRoom.test.tsx src/domain/meeting.ts src/domain/meeting.test.ts
git commit -m "feat: review voice text before manager reply"
```

---

### Task 7: Responsive styling and current documentation

**Files:**
- Modify: `src/styles.css`
- Modify: `README.md`
- Modify: `docs/privacy-boundary.md`
- Modify: `docs/architecture.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add responsive styles**

- Three model cards on desktop, one column below 48rem.
- Selected/disabled/loading states have text/icon, not color alone.
- CJK comparison wraps without horizontal scroll.
- Meeting preview fits bottom controls at 1280 and 375.
- Preserve fullscreen meeting layout and visible keyboard focus.

- [ ] **Step 2: Document exact data flow**

README explains high-quality default/manual 1.5 GB download. Privacy doc states Settings audio/text/results are memory-only and never sent to Perxona. Architecture shows Settings local branch and meeting edited-text handoff. Changelog records feature. Do not claim empirical accuracy before A/B acceptance.

- [ ] **Step 3: Bundle readback**

Run build, record JS bundle delta from OpenCC, confirm model weights are absent from `dist` and Git.

- [ ] **Step 4: Verify and commit**

```bash
rg -n "TODO|TBD|信心分數|能力分數|音訊.*上傳" README.md docs src/components/VoiceSettings.tsx src/components/VoiceTranscriptPreview.tsx
npm run release:check
git add src/styles.css README.md docs/privacy-boundary.md docs/architecture.md CHANGELOG.md
git commit -m "docs: explain local ASR quality settings"
```

Inspect prohibition-copy search hits; do not demand zero blindly.

---

### Task 8: Sol acceptance and publication

**Files:**
- Modify only for defects proven by acceptance.

- [ ] **Step 1: Full verification**

```bash
npm run release:check
git diff --check
git status --short
git check-ignore -q .env.local
```

- [ ] **Step 2: Real Chrome Settings A/B**

At `raise-room.localhost`, use the same sentence/mic for fast, balanced and quality. Capture only non-sensitive metrics: download/cache load seconds, transcription seconds, raw/Traditional transcript, match ratio, mic duration/tracks stopped, model-download origins, and errors.

Quality must complete on M1 Pro/16 GB. If it does not improve the same-sentence result, stop and revisit the default with evidence.

- [ ] **Step 3: Model switching lifecycle**

Verify one Worker/model active; switching releases previous; reload persists only preset; leaving Settings terminates Worker; mount does not ask microphone permission.

- [ ] **Step 4: Meeting preview E2E**

Record, stop, edit one misrecognized term, confirm, and verify edited text reaches transcript/Perxona/Presenter while raw text does not. Cancel/retry never send.

- [ ] **Step 5: Ten-turn soak**

Run at least 10 × 20-second quality transcriptions on one Settings page. Observe Chrome GPU process memory when tooling permits plus functional indicators. Crash, invalid buffer, forced reload or unbounded growth blocks quality default acceptance.

- [ ] **Step 6: Responsive/accessibility**

1280×800 and 375×812: zero horizontal overflow, keyboard-operable controls, visible focus, aria-live statuses, no color-only diff.

- [ ] **Step 7: Review and push**

Sol reviews correctness/readability/architecture/security/performance, reruns release gate, pushes `main`, and verifies local/remote SHA plus GitHub CI. Never push `.env.local` or cached model data.

## Completion Definition

Complete only when Settings, three allowlisted presets, high-quality default, mic comparison, Taiwan Traditional conversion, editable meeting preview, Worker cleanup, same-sentence A/B, quality load, 10-turn soak, responsive QA, release check and remote CI are proven. Unit tests alone are insufficient.
