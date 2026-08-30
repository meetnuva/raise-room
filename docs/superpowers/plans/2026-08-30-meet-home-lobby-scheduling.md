# Raise Room Meet-Style Scheduled Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 Raise Room 改造成 nuva 品牌的 Meet 式練習產品，加入嚴格下一整點 schedule、5／10／20 分鐘設定、首頁設定 dialog、會前準備室，以及 lobby 到正式談判的 camera／microphone／ASR 無縫交接。

**Architecture:** 純 domain 模組負責時間、duration、壓力事件比例與 storage validation；App state 負責 home／settings／lobby／meeting／report 導覽；`PracticeSession` 是跨 lobby／meeting 的唯一 runtime owner，持有本機 media stream 與 ASR client。首頁、設定、lobby 與 meeting 都只依賴明確 props，不直接讀 secret、任意 model URL 或任意 Presenter target ID。

**Tech Stack:** React 19.2.8、TypeScript 7.0.2、Vite 8.2.2、Vitest 4.1.11、Testing Library 16.3.3、Transformers.js 4.2.0、MediaDevices／MediaStream／MediaRecorder、Perxona Presenter 0.3.0、CSS。

**Approved Design:** `docs/superpowers/specs/2026-08-30-meet-home-lobby-scheduling-design.md` at commit `7b2d3fb`。

**Execution Route:** Sol owns architecture、task boundaries、diff inspection、runtime acceptance 與 final ship decision；Terra implements one task at a time、不得 push、不得回退 concurrent edits。每個 task 完成後 Sol 讀 actual diff 並重跑該 task 的 focused verification，再進下一 task。

## Global Constraints

- Product brand is lowercase `nuva`; left header uses the official blue nuva logo, never Google branding or copied assets.
- Copy the exact logo from `/Users/linshangche/Desktop/Project/nuva-report/public/logo/blue-nuva-logo.png`; expected SHA-256 is `8b4178abf1f0d298c1c10599cde1c4bad624940774e891ac47e0ff9453723c8b`.
- Every full document reload calculates the strict next hour. At exactly 18:00, the next meeting is 19:00.
- Duration IDs are exactly `5 | 10 | 20`; default is 20.
- Home end time、meeting countdown 與 pressure-event offsets use the same selected duration.
- Pressure-event ratios are exactly `0.1 | 0.3 | 0.5 | 0.7 | 0.9`.
- Lobby mount never requests camera／microphone and never auto-downloads an ASR model.
- `lobby → meeting` retains one media stream and one ASR Worker. Returning home／report or disposing the practice session stops them.
- Lobby background never records. MediaRecorder exists only during an explicit meeting recording turn.
- Male／female presentation selects allowlisted avatar／voice configs only; it never changes manager personality.
- Preserve ignored `.env.local`、server secret、manager API、ASR allowlist、OpenCC、visual algorithms、report evidence and Presenter URL allowlist.
- Do not write API keys、target IDs、Google account data、Meet codes、phone numbers or PINs into docs、tests、fixtures、logs or commits.
- No new dependency is required.
- Every behavior change follows RED → expected failure → minimal GREEN → focused verification → atomic commit.
- Do not push until all tasks、real Chrome acceptance、release gate and root review pass.

## File Responsibility Map

- `src/domain/practice-settings.ts`: duration／manager presentation allowlists and validation.
- `src/domain/practice-schedule.ts`: strict next-hour meeting creation、status and formatting.
- `src/lib/practice-settings-storage.ts`: validated settings persistence.
- `src/lib/scenario-storage.ts`: Scenario draft migration extracted from `ScenarioWorkshop`.
- `src/runtime/use-practice-media.ts`: one camera＋microphone stream and cleanup.
- `src/components/PracticeSession.tsx`: stable lobby／meeting resource owner.
- `src/components/NuvaBrand.tsx`: official logo rendering.
- `src/components/MeetHome.tsx`: top bar、date strip、navigation and schedule card.
- `src/components/PracticeSettingsDialog.tsx`: Meet-style settings tabs and save orchestration.
- `src/components/ScenarioSettingsPanel.tsx`: controlled scenario and manager fields.
- `src/components/DeviceSettingsPanel.tsx`: explicit device enumeration.
- `src/components/PrejoinLobby.tsx`: large local preview and join column.
- `src/App.tsx`: app navigation、schedule lifecycle and persistence handoff.
- `src/domain/scenario.ts`／`src/domain/meeting.ts`: proportional event timing.
- `src/hooks/use-local-voice.ts`: optional shared audio stream.
- `src/components/MeetingRoom.tsx`: dynamic duration and injected controllers.
- `src/lib/perxona-config.ts`: allowlisted male／female Presenter catalog.
- `src/styles.css`: page shell、settings、lobby、responsive and focus system.

---

### Task 1: Practice settings and localStorage boundary

**Files:**
- Create: `src/domain/practice-settings.ts`
- Create: `src/domain/practice-settings.test.ts`
- Create: `src/lib/practice-settings-storage.ts`
- Create: `src/lib/practice-settings-storage.test.ts`

**Interfaces:**

```ts
export type PracticeDurationMinutes = 5 | 10 | 20;
export type ManagerPresentation = "male" | "female";
export interface PracticeSettings {
  durationMinutes: PracticeDurationMinutes;
  managerPresentation: ManagerPresentation;
}
export const defaultPracticeSettings: PracticeSettings;
export function isPracticeDurationMinutes(value: unknown): value is PracticeDurationMinutes;
export function isManagerPresentation(value: unknown): value is ManagerPresentation;
export function parsePracticeSettings(value: unknown): PracticeSettings;
export const practiceSettingsStorageKey = "raise-room-meeting-settings-v1";
export function readPracticeSettings(storage: Pick<Storage,"getItem">): PracticeSettings;
export function writePracticeSettings(storage: Pick<Storage,"setItem">, settings: PracticeSettings): void;
```

- [ ] **Step 1: Write RED domain tests**

```ts
test("defaults to a twenty minute male-presenting practice", () => {
  expect(defaultPracticeSettings).toEqual({ durationMinutes: 20, managerPresentation: "male" });
});

test("accepts only approved values", () => {
  expect([5, 10, 20].map(isPracticeDurationMinutes)).toEqual([true, true, true]);
  expect(isPracticeDurationMinutes(15)).toBe(false);
  expect(isManagerPresentation("male")).toBe(true);
  expect(isManagerPresentation("female")).toBe(true);
  expect(isManagerPresentation("other")).toBe(false);
});

test("repairs malformed settings and drops extra fields", () => {
  expect(parsePracticeSettings({ durationMinutes: 5, managerPresentation: "female", secret: "x" }))
    .toEqual({ durationMinutes: 5, managerPresentation: "female" });
  expect(parsePracticeSettings({ durationMinutes: 15, managerPresentation: "unknown" }))
    .toEqual(defaultPracticeSettings);
});
```

- [ ] **Step 2: Run RED**

Run: `npm test -- src/domain/practice-settings.test.ts --reporter=verbose`

Expected: FAIL because `./practice-settings` does not exist.

- [ ] **Step 3: Implement exact allowlists and parser**

```ts
export const defaultPracticeSettings: PracticeSettings = {
  durationMinutes: 20,
  managerPresentation: "male",
};

export function isPracticeDurationMinutes(value: unknown): value is PracticeDurationMinutes {
  return value === 5 || value === 10 || value === 20;
}

export function isManagerPresentation(value: unknown): value is ManagerPresentation {
  return value === "male" || value === "female";
}

export function parsePracticeSettings(value: unknown): PracticeSettings {
  if (typeof value !== "object" || value === null) return defaultPracticeSettings;
  const input = value as { durationMinutes?: unknown; managerPresentation?: unknown };
  if (!isPracticeDurationMinutes(input.durationMinutes) || !isManagerPresentation(input.managerPresentation)) {
    return defaultPracticeSettings;
  }
  return { durationMinutes: input.durationMinutes, managerPresentation: input.managerPresentation };
}
```

- [ ] **Step 4: Write RED storage tests**

Use an in-memory storage stub. Cover missing value、malformed JSON、three valid durations、unknown values and serialization of only `durationMinutes`／`managerPresentation`.

- [ ] **Step 5: Implement storage and run GREEN**

```ts
export function readPracticeSettings(storage: Pick<Storage,"getItem">): PracticeSettings {
  try {
    const stored = storage.getItem(practiceSettingsStorageKey);
    return stored ? parsePracticeSettings(JSON.parse(stored)) : defaultPracticeSettings;
  } catch {
    return defaultPracticeSettings;
  }
}

export function writePracticeSettings(storage: Pick<Storage,"setItem">, settings: PracticeSettings) {
  storage.setItem(practiceSettingsStorageKey, JSON.stringify(parsePracticeSettings(settings)));
}
```

Run: `npm test -- src/domain/practice-settings.test.ts src/lib/practice-settings-storage.test.ts --reporter=verbose`

- [ ] **Step 6: Commit**

```bash
git add src/domain/practice-settings.ts src/domain/practice-settings.test.ts src/lib/practice-settings-storage.ts src/lib/practice-settings-storage.test.ts
git commit -m "feat: persist scheduled practice settings"
```

---

### Task 2: Strict next-hour schedule domain

**Files:**
- Create: `src/domain/practice-schedule.ts`
- Create: `src/domain/practice-schedule.test.ts`

**Interfaces:**

```ts
export type PracticeScheduleStatus = "upcoming" | "active" | "ended";
export interface ScheduledPracticeMeeting {
  id: string;
  title: string;
  managerName: string;
  company: string;
  role: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: PracticeDurationMinutes;
}
export function getStrictNextHour(now: Date): Date;
export function createScheduledPracticeMeeting(input: {
  now: Date;
  durationMinutes: PracticeDurationMinutes;
  managerName: string;
  company: string;
  role: string;
}): ScheduledPracticeMeeting;
export function getPracticeScheduleStatus(meeting: ScheduledPracticeMeeting, now: Date): PracticeScheduleStatus;
export function formatPracticeTimeRange(meeting: ScheduledPracticeMeeting, locale?: string): string;
```

- [ ] **Step 1: Write RED schedule tests**

```ts
test.each([[5,"18:00–18:05"],[10,"18:00–18:10"],[20,"18:00–18:20"]] as const)(
  "schedules the strict next hour for %i minutes",
  (durationMinutes, range) => {
    const meeting = createScheduledPracticeMeeting({
      now: new Date(2026, 7, 30, 17, 5), durationMinutes,
      managerName: "王主管", company: "nuva", role: "產品營運專員",
    });
    expect(formatPracticeTimeRange(meeting, "zh-TW")).toBe(range);
  },
);

test("moves an exact hour to the following hour", () => {
  expect(getStrictNextHour(new Date(2026,7,30,18,0,0))).toEqual(new Date(2026,7,30,19,0,0));
});

test("rolls 23:30 into the next day", () => {
  expect(getStrictNextHour(new Date(2026,7,30,23,30))).toEqual(new Date(2026,7,31,0,0,0));
});
```

- [ ] **Step 2: Run RED**

Run: `npm test -- src/domain/practice-schedule.test.ts --reporter=verbose`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement deterministic local-time schedule**

```ts
export function getStrictNextHour(now: Date): Date {
  if (Number.isNaN(now.getTime())) throw new Error("無法取得目前時間。");
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

export interface CreateScheduledPracticeMeetingInput {
  now: Date;
  durationMinutes: PracticeDurationMinutes;
  managerName: string;
  company: string;
  role: string;
}

export function createScheduledPracticeMeeting(input: CreateScheduledPracticeMeetingInput) {
  const start = getStrictNextHour(input.now);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  return {
    id: `practice-${start.toISOString()}-${input.durationMinutes}`,
    title: `與${input.managerName}的年度調薪 1:1`,
    managerName: input.managerName,
    company: input.company,
    role: input.role,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    durationMinutes: input.durationMinutes,
  };
}
```

Format both endpoints with `Intl.DateTimeFormat(locale,{hour:"2-digit",minute:"2-digit",hour12:false})`. Status uses half-open interval.

- [ ] **Step 4: Add invalid-date／status tests and run GREEN**

Run: `npm test -- src/domain/practice-schedule.test.ts --reporter=verbose`

- [ ] **Step 5: Commit**

```bash
git add src/domain/practice-schedule.ts src/domain/practice-schedule.test.ts
git commit -m "feat: schedule the next whole-hour practice"
```

---

### Task 3: Proportional pressure events and scenario migration

**Files:**
- Modify: `src/domain/scenario.ts`
- Modify: `src/domain/scenario.test.ts`
- Modify: `src/domain/meeting.ts`
- Modify: `src/domain/meeting.test.ts`
- Create: `src/lib/scenario-storage.ts`
- Create: `src/lib/scenario-storage.test.ts`
- Modify: `src/components/ScenarioWorkshop.tsx`

**Interfaces:**

```ts
export const pressureEventRatios = [0.1,0.3,0.5,0.7,0.9] as const;
export type PressureEventRatio = typeof pressureEventRatios[number];
export interface ScheduledEvent {
  id: string;
  triggerRatio: PressureEventRatio;
  label: string;
  instruction: string;
}
export function getEventOffsetSeconds(event: ScheduledEvent, durationSeconds: number): number;
export function readScenarioDraft(storage: Pick<Storage,"getItem"|"removeItem">): Scenario;
export function writeScenarioDraft(storage: Pick<Storage,"setItem">, scenario: Scenario): void;
export function clearScenarioDraft(storage: Pick<Storage,"removeItem">): void;
```

- [ ] **Step 1: Write proportional timing RED tests**

```ts
test.each([
  [300,[30,90,150,210,270]],
  [600,[60,180,300,420,540]],
  [1200,[120,360,600,840,1080]],
])("derives event offsets for %i seconds", (durationSeconds, expected) => {
  expect(defaultScenario.events.map((event) => getEventOffsetSeconds(event,durationSeconds)))
    .toEqual(expected);
});
```

- [ ] **Step 2: Run RED**

Run: `npm test -- src/domain/scenario.test.ts src/domain/meeting.test.ts --reporter=verbose`

Expected: FAIL because events still expose fixed `minute` values.

- [ ] **Step 3: Replace fixed minutes and update MeetingState**

```ts
export interface MeetingState {
  scenario: Scenario;
  durationSeconds: number;
  elapsedSeconds: number;
  transcript: TranscriptTurn[];
  emittedEventIds: string[];
}

export function createMeeting(scenario: Scenario, durationSeconds: number): MeetingState {
  return { scenario, durationSeconds, elapsedSeconds: 0, transcript: [], emittedEventIds: [] };
}
```

`advanceMeeting` compares `getEventOffsetSeconds(event,state.durationSeconds) <= nextElapsedSeconds`. Remove direct `minute * 60` comparisons.

- [ ] **Step 4: Test and implement legacy storage migration**

Use a legacy fixture with `minute:1／3／5／7／9`. `readScenarioDraft` preserves id、label、instruction and assigns ratios by event index. Corrupt JSON removes only `raise-room-scenario-draft` and returns `defaultScenario`.

- [ ] **Step 5: Refactor ScenarioWorkshop storage calls**

Replace private `readDraft` and direct localStorage writes with the three storage helpers. Preserve the current UI during this task.

- [ ] **Step 6: Verify and commit**

```bash
npm test -- src/domain/scenario.test.ts src/domain/meeting.test.ts src/lib/scenario-storage.test.ts src/components/ScenarioWorkshop.test.tsx --reporter=verbose
git add src/domain/scenario.ts src/domain/scenario.test.ts src/domain/meeting.ts src/domain/meeting.test.ts src/lib/scenario-storage.ts src/lib/scenario-storage.test.ts src/components/ScenarioWorkshop.tsx
git commit -m "feat: scale pressure events to meeting length"
```

---

### Task 4: Allowlisted male／female Presenter catalog

**Files:**
- Modify: `src/lib/perxona-config.ts`
- Modify: `src/lib/perxona-config.test.ts`
- Modify: `.env.example`
- Modify: `README.md`

**Produces:**

```ts
export type PresenterCatalog = Readonly<Partial<Record<ManagerPresentation, PresenterRuntimeConfig>>>;
export function readPresenterCatalog(env: Record<string,string|undefined>): PresenterCatalog;
export function selectPresenterConfig(catalog: PresenterCatalog, presentation: ManagerPresentation): PresenterRuntimeConfig;
export function isPresenterPresentationAvailable(catalog: PresenterCatalog, presentation: ManagerPresentation): boolean;
```

- [ ] **Step 1: Write catalog RED tests**

Cover exact cases：no publishable key disables both；legacy avatar／voice plus scene enables male only；new male and female variables enable both；incomplete female stays disabled and never falls back to male；target values never appear in errors.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/lib/perxona-config.test.ts --reporter=verbose`

Expected: FAIL because catalog functions do not exist.

- [ ] **Step 3: Implement exact public env mapping**

```text
VITE_PERXONA_MALE_AVATAR_ID=
VITE_PERXONA_MALE_VOICE_ID=
VITE_PERXONA_FEMALE_AVATAR_ID=
VITE_PERXONA_FEMALE_VOICE_ID=
```

Both share existing `VITE_PERXONA_SCENE_ID`. For backward compatibility male uses existing `VITE_PERXONA_AVATAR_ID`／`VITE_PERXONA_VOICE_ID` only when new male values are empty. Female never uses legacy male values. Keep the same publishable key and allowlisted Presenter URL.

- [ ] **Step 4: Update blank env documentation and verify GREEN**

README states unavailable roles are disabled and no Secret key belongs in client variables. `.env.example` contains blank values only.

Run: `npm test -- src/lib/perxona-config.test.ts --reporter=verbose && npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/lib/perxona-config.ts src/lib/perxona-config.test.ts .env.example README.md
git commit -m "feat: configure allowlisted manager presentations"
```

---

### Task 5: Shared practice media and ASR runtime

**Files:**
- Create: `src/runtime/use-practice-media.ts`
- Create: `src/runtime/use-practice-media.test.tsx`
- Modify: `src/hooks/use-local-voice.ts`
- Modify: `src/hooks/use-local-voice.test.tsx`

**Interfaces:**

```ts
export type PracticeMediaStatus = "idle"|"requesting"|"active"|"denied"|"unavailable"|"error";
export interface PracticeMediaController {
  status: PracticeMediaStatus;
  stream: MediaStream | null;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  errorMessage: string | null;
  request(): Promise<void>;
  toggleCamera(): void;
  toggleMicrophone(): void;
  dispose(): void;
}
export function usePracticeMedia(input?: {
  mediaDevices?: Pick<MediaDevices,"getUserMedia">;
}): PracticeMediaController;
```

Extend `useLocalVoice` input without changing its return shape:

```ts
type LocalVoiceInput = {
  modelPreset?: AsrModelPresetId;
  sharedAudioStream?: MediaStream | null;
  asrClient?: LocalAsrClient;
  asrClientFactory?: () => LocalAsrClient;
  mediaDevices?: Pick<MediaDevices,"getUserMedia">;
  mediaRecorderFactory?: (stream: MediaStream) => MediaRecorder;
  audioContextFactory?: () => AudioContext;
  now?: () => number;
};
```

- [ ] **Step 1: Write media lifecycle RED tests**

```ts
test("requests one audio-video stream only after explicit action", async () => {
  const stream = fakeStreamWithAudioAndVideoTracks();
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  const { result } = renderHook(() => usePracticeMedia({ mediaDevices:{ getUserMedia } }));
  expect(getUserMedia).not.toHaveBeenCalled();
  await act(async () => result.current.request());
  expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({
    audio:true,
    video:{ facingMode:"user", width:{ideal:1280}, height:{ideal:720} },
  });
  expect(result.current.status).toBe("active");
});
```

Add local test helpers that expose audio／video tracks with `enabled` and `stop` spies. Prove toggles change only `enabled`；dispose stops each track exactly once；denial is visible；StrictMode does not retain stale streams.

- [ ] **Step 2: Run RED and implement media owner**

Run: `npm test -- src/runtime/use-practice-media.test.tsx --reporter=verbose`

Expected: FAIL because hook does not exist. Implement a ref-backed stream; `request()` returns early when active；dispose clears state and tracks.

- [ ] **Step 3: Write shared-audio RED tests for useLocalVoice**

Prove start with an enabled shared stream never calls `getUserMedia`；stopping MediaRecorder does not stop shared tracks；second turn reuses it；missing shared audio falls back to explicit audio permission；releaseModel destroys only ASR resources.

- [ ] **Step 4: Implement shared stream ownership and run GREEN**

Track whether audio was internally acquired. Only internally acquired tracks stop after a turn. Shared audio remains until `usePracticeMedia.dispose()`.

Run: `npm test -- src/runtime/use-practice-media.test.tsx src/hooks/use-local-voice.test.tsx --reporter=verbose`

- [ ] **Step 5: Verify and commit**

```bash
npm test -- src/runtime/use-practice-media.test.tsx src/hooks/use-local-voice.test.tsx --reporter=verbose
git add src/runtime/use-practice-media.ts src/runtime/use-practice-media.test.tsx src/hooks/use-local-voice.ts src/hooks/use-local-voice.test.tsx
git commit -m "feat: preserve local media across practice entry"
```

---

### Task 6: Official nuva brand and scheduled home

**Files:**
- Create: `public/brand/blue-nuva-logo.png`
- Create: `src/components/NuvaBrand.tsx`
- Create: `src/components/NuvaBrand.test.tsx`
- Create: `src/components/MeetHome.tsx`
- Create: `src/components/MeetHome.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Copy and verify official asset**

```bash
mkdir -p public/brand
cp '/Users/linshangche/Desktop/Project/nuva-report/public/logo/blue-nuva-logo.png' public/brand/blue-nuva-logo.png
shasum -a 256 public/brand/blue-nuva-logo.png
```

Expected：`8b4178abf1f0d298c1c10599cde1c4bad624940774e891ac47e0ff9453723c8b`。Mismatch stops this task；do not substitute.

- [ ] **Step 2: Write brand／home RED tests**

```tsx
test("uses the blue nuva brand and opens settings", () => {
  const onOpenSettings = vi.fn();
  render(<MeetHome meeting={meeting20} now={new Date(2026,7,30,17,5)} onOpenSettings={onOpenSettings} onEnterLobby={vi.fn()} />);
  expect(screen.getByRole("img",{name:"nuva"})).toHaveAttribute("src","/brand/blue-nuva-logo.png");
  fireEvent.click(screen.getByRole("button",{name:"設定"}));
  expect(onOpenSettings).toHaveBeenCalledOnce();
});

test("shows schedule and permits early entry", () => {
  const onEnterLobby = vi.fn();
  render(<MeetHome meeting={meeting20} now={new Date(2026,7,30,17,5)} onOpenSettings={vi.fn()} onEnterLobby={onEnterLobby} />);
  expect(screen.getByText("18:00–18:20")).toBeVisible();
  expect(screen.getByText("與王主管的年度調薪 1:1")).toBeVisible();
  fireEvent.click(screen.getByRole("button",{name:"提早進入準備室"}));
  expect(onEnterLobby).toHaveBeenCalledOnce();
});
```

Add a future-date test：selecting tomorrow shows `這一天沒有安排練習`; selecting today restores the card. Add a navigation test：`練習紀錄` shows `尚無練習紀錄` and `會議` returns to schedule. These are local UI states only and create no history storage.

- [ ] **Step 3: Run RED and implement semantic home**

Run: `npm test -- src/components/NuvaBrand.test.tsx src/components/MeetHome.test.tsx --reporter=verbose`

Expected: FAIL because components do not exist. Implement one h1、header、navigation、seven-day strip and one schedule article. Today uses `aria-current="date"`. Do not add a fake meeting-code input or nested buttons.

- [ ] **Step 4: Add focused CSS and run GREEN**

Use white surfaces、nuva blue、thin neutral borders、64px top bar、84px desktop navigation and visible focus rings. Do not alter MeetingRoom styles yet.

Run: `npm test -- src/components/NuvaBrand.test.tsx src/components/MeetHome.test.tsx --reporter=verbose && npm run build`

- [ ] **Step 5: Commit**

```bash
git add public/brand/blue-nuva-logo.png src/components/NuvaBrand.tsx src/components/NuvaBrand.test.tsx src/components/MeetHome.tsx src/components/MeetHome.test.tsx src/styles.css
git commit -m "feat: add the scheduled nuva practice home"
```

---

### Task 7: Controlled panels and Meet-style settings dialog

**Files:**
- Create: `src/components/ScenarioSettingsPanel.tsx`
- Create: `src/components/ScenarioSettingsPanel.test.tsx`
- Modify: `src/components/ScenarioWorkshop.tsx`
- Modify: `src/components/ScenarioWorkshop.test.tsx`
- Create: `src/components/PracticeSettingsDialog.tsx`
- Create: `src/components/PracticeSettingsDialog.test.tsx`
- Modify: `src/components/VoiceSettings.tsx`
- Modify: `src/components/VoiceSettings.test.tsx`
- Create: `src/components/DeviceSettingsPanel.tsx`
- Create: `src/components/DeviceSettingsPanel.test.tsx`
- Modify: `src/styles.css`

**Interface:**

```ts
export interface PracticeSettingsDraft {
  scenario: Scenario;
  practice: PracticeSettings;
  modelPreset: AsrModelPresetId;
}
export function PracticeSettingsDialog(props: {
  open:boolean;
  value:PracticeSettingsDraft;
  presenterCatalog:PresenterCatalog;
  onSave(value:PracticeSettingsDraft):void;
  onClear():void;
  onClose():void;
}): JSX.Element | null;
```

- [ ] **Step 1: Extract controlled ScenarioSettingsPanel with RED tests**

Test every current scenario field reads from `value` and calls `onChange(next)`；duration-derived event times are visible；fixed-minute inputs no longer exist. Preserve company、role、salary、manager、six personalities、hidden stance、custom instructions and five event text pairs.

- [ ] **Step 2: Run RED and implement panel／compatibility wrapper**

Run: `npm test -- src/components/ScenarioSettingsPanel.test.tsx --reporter=verbose`

Expected: FAIL because panel does not exist. Move field JSX without changing copy. `ScenarioWorkshop` temporarily owns storage and renders the controlled panel so current tests stay green.

- [ ] **Step 3: Write settings-dialog RED tests**

Prove exact tabs：`音訊`、`視訊`、`語音模型`、`主管角色`、`主管個性`、`會議`、`隱私`。Mount performs no media／device／model call. Cancel emits no save. Save returns edited duration. Unavailable female is disabled with `此角色尚未設定`. Escape closes and App integration later proves focus return. Privacy tab shows the local-only boundary. `清除本機設定與草稿` requires an explicit second confirmation before calling `onClear`; Cancel never clears.

- [ ] **Step 4: Extract controlled VoiceSettingsPanel**

```ts
export function VoiceSettingsPanel(props: {
  selectedPreset:AsrModelPresetId;
  onSelectedPresetChange(id:AsrModelPresetId):void;
  hasWebGpu:boolean;
  voice?:ReturnType<typeof useLocalVoice>;
}): JSX.Element;
```

Keep `VoiceSettings` as a compatibility wrapper. The dialog owns draft preset and writes only on global Save.

- [ ] **Step 5: Implement explicit DeviceSettingsPanel**

Show `讀取可用裝置`; only that click calls `enumerateDevices()`. Group `audioinput`、`audiooutput`、`videoinput`; keep device IDs in React memory only. Preview calls an injected action. Unsupported `setSinkId` is disclosed.

- [ ] **Step 6: Implement dialog save／focus semantics**

Use native dialog semantics、close button、Escape、selected-tab initial focus and internal draft reset on open false→true. Save validates role、manager、reason and finite salary fields；invalid input keeps dialog open and focuses the first invalid control.

- [ ] **Step 7: Verify and commit**

```bash
npm test -- src/components/ScenarioSettingsPanel.test.tsx src/components/ScenarioWorkshop.test.tsx src/components/PracticeSettingsDialog.test.tsx src/components/DeviceSettingsPanel.test.tsx src/components/VoiceSettings.test.tsx --reporter=verbose
npm run build
git add src/components/ScenarioSettingsPanel.tsx src/components/ScenarioSettingsPanel.test.tsx src/components/ScenarioWorkshop.tsx src/components/ScenarioWorkshop.test.tsx src/components/PracticeSettingsDialog.tsx src/components/PracticeSettingsDialog.test.tsx src/components/VoiceSettings.tsx src/components/VoiceSettings.test.tsx src/components/DeviceSettingsPanel.tsx src/components/DeviceSettingsPanel.test.tsx src/styles.css
git commit -m "feat: centralize Meet-style practice settings"
```

---

### Task 8: Prejoin lobby with explicit permissions

**Files:**
- Create: `src/components/PrejoinLobby.tsx`
- Create: `src/components/PrejoinLobby.test.tsx`
- Modify: `src/components/LocalCameraTile.tsx`
- Modify: `src/components/LocalCameraTile.test.tsx`
- Modify: `src/lib/perxona-presenter.ts`
- Modify: `src/lib/perxona-presenter.test.ts`
- Modify: `src/styles.css`

**Consumes:** `PracticeMediaController`、shared voice controller、meeting、Scenario and Presenter config.

- [ ] **Step 1: Write lobby RED tests**

```tsx
test("waits for permission and always permits early negotiation", () => {
  const media = fakePracticeMedia({status:"idle"});
  const onJoin = vi.fn();
  render(<PrejoinLobby meeting={meeting20} scenario={defaultScenario} media={media} voice={fakeVoice()} presenterConfig={{enabled:false,reason:"missing-target"}} onJoin={onJoin} onCancel={vi.fn()} />);
  expect(media.request).not.toHaveBeenCalled();
  expect(screen.getByText("可以提早開始談判")).toBeVisible();
  fireEvent.click(screen.getByRole("button",{name:"允許鏡頭與麥克風"}));
  expect(media.request).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button",{name:"立即進入會議室"}));
  expect(onJoin).toHaveBeenCalledOnce();
});
```

Also test 18:00–18:20、manager name、participant state、camera/mic toggles、denied fallback、ASR load/cancel and explicit Presenter `檢查 3D 主管` → `連線已驗證` vs fallback. Presenter check calls an injected preloader only after the button click；lobby mount performs no Presenter network action.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/components/PrejoinLobby.test.tsx --reporter=verbose`

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement exact lobby hierarchy**

```tsx
<section className="prejoin-lobby" aria-labelledby="prejoin-title">
  <NuvaBrand />
  <div className="prejoin-grid">
    <section className="prejoin-preview" aria-label="你的本機預覽">{preview}</section>
    <aside className="prejoin-join-panel">
      <h1 id="prejoin-title">{meeting.title}</h1>
      <p>{formatPracticeTimeRange(meeting)}</p>
      <p>主管會在談判開始後加入</p>
      <button type="button" onClick={onJoin}>立即進入會議室</button>
      <p className="early-entry-note">可以提早開始談判</p>
    </aside>
  </div>
</section>
```

Preview never owns or stops the stream. Idle shows one permission CTA. Active attaches `video.srcObject`, uses muted inline playback and three round controls：microphone、camera、settings. Status rows disclose mic、camera、ASR and Presenter states. Model loading remains explicit.

Reuse the existing `loadPresenterEngine(config.presenterUrl)` as the Presenter preloader after `檢查 3D 主管`. Success means only that the allowlisted SDK is cached and config is present, so the exact label is `連線已驗證`; do not mount、resume audio or initialize the avatar in lobby. Meeting mount reuses the module-level engine promise and performs the real Presenter initialization.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- src/components/PrejoinLobby.test.tsx src/components/LocalCameraTile.test.tsx src/lib/perxona-presenter.test.ts --reporter=verbose
npm run build
git add src/components/PrejoinLobby.tsx src/components/PrejoinLobby.test.tsx src/components/LocalCameraTile.tsx src/components/LocalCameraTile.test.tsx src/lib/perxona-presenter.ts src/lib/perxona-presenter.test.ts src/styles.css
git commit -m "feat: add the early-entry preparation lobby"
```

---

### Task 9: App navigation and persistence integration

**Files:**
- Create: `src/components/PracticeSession.tsx`
- Create: `src/components/PracticeSession.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/main.tsx` only if the clock boundary requires it.

**Interface:**

```ts
export function App({ now = () => new Date() }: { now?: () => Date } = {}): JSX.Element;
```

- [ ] **Step 1: Replace setup-entry tests with home-flow RED tests**

```tsx
test("creates the strict next meeting from the document-load clock", () => {
  render(<App now={() => new Date(2026,7,30,17,5)} />);
  expect(screen.getByRole("heading",{name:"Raise Room"})).toBeVisible();
  expect(screen.getByText("18:00–18:20")).toBeVisible();
  expect(screen.queryByRole("heading",{name:"設定這場薪資檢討"})).toBeNull();
});

test("saves five minutes without moving the start hour", () => {
  render(<App now={() => new Date(2026,7,30,17,5)} />);
  fireEvent.click(screen.getByRole("button",{name:"設定"}));
  fireEvent.click(screen.getByRole("tab",{name:"會議"}));
  fireEvent.click(screen.getByRole("radio",{name:"5 分鐘"}));
  fireEvent.click(screen.getByRole("button",{name:"儲存設定"}));
  expect(screen.getByText("18:00–18:05")).toBeVisible();
});
```

Add tests home→lobby、lobby→meeting、report retry→lobby、report reset→home、settings Cancel unchanged、storage read once and no media／model action on home mount.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/App.test.tsx --reporter=verbose`

Expected: current setup-entry assertions fail.

- [ ] **Step 3: Create stable runtime render-prop owner**

```tsx
export interface PracticeRuntime {
  media: PracticeMediaController;
  voice: ReturnType<typeof useLocalVoice>;
}

export function PracticeSession({
  modelPreset,
  children,
}: {
  modelPreset: AsrModelPresetId;
  children(runtime: PracticeRuntime): ReactNode;
}) {
  const media = usePracticeMedia();
  const voice = useLocalVoice({ modelPreset, sharedAudioStream: media.stream });
  return <>{children({ media, voice })}</>;
}
```

Mock both hooks in `PracticeSession.test.tsx`. Rerender a harness from lobby to meeting while keeping the same PracticeSession element；prove hooks are not remounted and unmount triggers their existing cleanup contracts.

- [ ] **Step 4: Implement state machine and stable schedule object**

```ts
type AppState =
  | {view:"home"}
  | {view:"settings"}
  | {view:"practice"; phase:"lobby"|"meeting"}
  | {view:"report"; transcript:TranscriptTurn[]; visualSignals?:VisualSignals};
```

Store one `documentNow` ref、scenario、practice settings、voice preset and scheduled meeting. Settings Save validates and writes all storage boundaries, then recreates the meeting with the original strict-next start and new duration／labels. Full reload obtains new now. Render the same `PracticeSession` element for both phases and never key it by phase.

- [ ] **Step 5: Add home-only auto-roll**

While home only, a minute interval checks `now() >= endsAt` and creates the next strict-hour meeting. Do not run it in lobby、meeting or report. Use fake timers and injected now.

- [ ] **Step 6: Verify and commit**

```bash
npm test -- src/App.test.tsx src/components/PracticeSession.test.tsx --reporter=verbose
npm run build
git add src/components/PracticeSession.tsx src/components/PracticeSession.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: route scheduled practice through the lobby"
```

Add `src/main.tsx` only if it changed.

---

### Task 10: Dynamic-duration MeetingRoom and injected controllers

**Files:**
- Modify: `src/components/PracticeSession.tsx`
- Modify: `src/components/PracticeSession.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Create: `src/components/MeetingSidePanel.tsx`
- Create: `src/components/MeetingSidePanel.test.tsx`
- Modify: `src/components/MeetingRoom.tsx`
- Modify: `src/components/MeetingRoom.test.tsx`
- Modify: `src/components/LocalVoiceControl.tsx`
- Modify: `src/components/LocalVoiceControl.test.tsx`
- Modify: `src/components/CoachingReport.tsx`
- Modify: `src/components/CoachingReport.test.tsx`
- Modify: `src/styles.css`

**New MeetingRoom props:**

```ts
{
  meeting:ScheduledPracticeMeeting;
  scenario:Scenario;
  camera?:PracticeMediaController;
  voice?:ReturnType<typeof useLocalVoice>;
  responder:ManagerResponder;
  onFinish?:(transcript:TranscriptTurn[],visualSignals?:VisualSignals)=>void;
  presenterConfig?:PresenterRuntimeConfig;
  clock?:{durationSeconds?:number;now?:()=>number;intervalMs?:number};
  modelPreset?:AsrModelPresetId;
}
```

- [ ] **Step 1: Write dynamic-duration RED tests**

```tsx
test("uses the scheduled twenty minute duration", () => {
  render(<MeetingRoom meeting={meeting20} scenario={scenario20} responder={simulatedResponder} />);
  expect(screen.getByLabelText("剩餘時間 20:00")).toBeVisible();
});

test("emits the first event at two minutes", () => {
  render(<MeetingRoom meeting={meeting20} scenario={scenario20} responder={simulatedResponder} clock={{durationSeconds:1200}} />);
  fireEvent.click(screen.getByRole("button",{name:"跳到第一個壓力事件"}));
  expect(screen.getByText("2:00 · 已發生")).toBeVisible();
});
```

Test initial 5／10／20 labels and all five exact emissions with injected clocks.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/components/MeetingRoom.test.tsx --reporter=verbose`

Expected: FAIL because MeetingRoom still defaults to 10 minutes and fixed minutes.

- [ ] **Step 3: Inject controllers without conditional hooks**

Split wrapper／view if needed so hook order never depends on props. `MeetingRoomView` receives concrete controllers；owned wrapper creates legacy controllers for direct tests；PracticeSession supplies shared controllers. Keep LocalVoiceControl injected voice behavior. Update App's PracticeSession render callback so lobby and meeting both receive the same `runtime.media`／`runtime.voice`. Add the previously deferred assertion：lobby→meeting creates no second worker、does not call getUserMedia again and does not stop the shared stream.

- [ ] **Step 4: Implement scheduled copy and dynamic timing**

Header uses `meeting.title`、scheduled range and countdown. Event rail formats offsets as `M:SS`. Finish copy becomes `離開並查看報告`. Duration is `meeting.durationMinutes * 60` unless test override. Replace `跳到第 3 分鐘` with test-only `跳到第一個壓力事件`.

- [ ] **Step 5: Update report navigation**

`再練一次` returns to lobby. `返回首頁` replaces `重新設定情境`. Do not change evidence calculation or aggregate signals.

- [ ] **Step 6: Move secondary meeting information into a right-side panel**

Create `MeetingSidePanel` with exact tabs `逐字稿`、`壓力事件`、`觀察`. It receives transcript、events、emitted IDs and local visual status through props. Opening one tab compresses the main stage and never covers the bottom control bar. Tests prove transcript stays append-only、event status uses derived `M:SS` offsets、only one panel is active and Close restores the full stage. Do not create a second chat input；the development text fallback remains in the transcript tab and retains its existing development-only marker.

- [ ] **Step 7: Verify and commit**

```bash
npm test -- src/components/MeetingSidePanel.test.tsx src/components/MeetingRoom.test.tsx src/components/LocalVoiceControl.test.tsx src/components/CoachingReport.test.tsx src/App.test.tsx --reporter=verbose
npm run build
git add src/components/PracticeSession.tsx src/components/PracticeSession.test.tsx src/App.tsx src/App.test.tsx src/components/MeetingSidePanel.tsx src/components/MeetingSidePanel.test.tsx src/components/MeetingRoom.tsx src/components/MeetingRoom.test.tsx src/components/LocalVoiceControl.tsx src/components/LocalVoiceControl.test.tsx src/components/CoachingReport.tsx src/components/CoachingReport.test.tsx src/styles.css
git commit -m "feat: run practices for the scheduled duration"
```

---

### Task 11: Responsive polish and accessibility

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/MeetHome.test.tsx`
- Modify: `src/components/PracticeSettingsDialog.test.tsx`
- Modify: `src/components/PrejoinLobby.test.tsx`
- Modify: `src/components/MeetingRoom.test.tsx`

- [ ] **Step 1: Add RED structural assertions**

Cover one h1、logical heading order、aria-current date、named dialog／tablist、early-entry status、focus return、no nested interactive schedule card and no duplicate camera／mic controls.

- [ ] **Step 2: Implement exact responsive tokens and layouts**

```css
:root {
  --nuva-blue:#2563eb;
  --nuva-blue-soft:#dbeafe;
  --surface:#fff;
  --surface-muted:#f8fafc;
  --border:#dfe3ea;
  --text:#202124;
  --text-muted:#5f6368;
  --video-stage:#202124;
}
.meet-home-shell{min-height:100vh;background:var(--surface);color:var(--text)}
.prejoin-grid{display:grid;grid-template-columns:minmax(0,7fr) minmax(320px,3fr);gap:2rem}
.prejoin-preview{aspect-ratio:16/9;background:var(--video-stage);border-radius:1.25rem;overflow:hidden}
@media(max-width:767px){
  .prejoin-grid{grid-template-columns:1fr}
  .settings-dialog-layout{grid-template-columns:1fr}
  .settings-tabs{display:flex;overflow-x:auto}
}
```

Keep 64px header、84px desktop nav、1120px max content、thin borders、minimal shadows and visible focus. No gradients、purple AI palette、nested cards or fake controls.

- [ ] **Step 3: Add reduced-motion／keyboard behavior**

All controls get `:focus-visible`. `prefers-reduced-motion:reduce` removes nonessential transitions. Countdown changes visually without a live announcement every second.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- --reporter=verbose
npm run build
git diff --check
git status --short
git add src/styles.css src/components/MeetHome.test.tsx src/components/PracticeSettingsDialog.test.tsx src/components/PrejoinLobby.test.tsx src/components/MeetingRoom.test.tsx
git commit -m "style: polish the Meet-style practice flow"
```

---

### Task 12: Documentation, real Chrome acceptance and publish gate

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/privacy-boundary.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/superpowers/specs/2026-08-30-meet-home-lobby-scheduling-design.md` only to record implementation evidence.
- Update outside Git: `/Users/linshangche/Desktop/Perxona Connect Kit/2026-08-30｜Google Meet 頁面與互動架構分析.md`

- [ ] **Step 1: Update public docs**

README documents strict next hour、5／10／20、early lobby、explicit permission、local media and role availability. Architecture records `App → PracticeSession → Lobby／Meeting` ownership. Privacy states microphone may remain enabled after explicit permission but MediaRecorder exists only during a speech turn.

- [ ] **Step 2: Run automated release gate**

```bash
npm run release:check
git diff --check
git status --short --branch
```

Expected：all tests PASS、build succeeds、audit gate passes、`.env.local` remains ignored、no build output tracked.

- [ ] **Step 3: Real Chrome schedule／settings acceptance**

Restart the local dev server and reuse the existing Raise Room tab. Prove 17:05→18:00–18:05／10／20 and exact hour→following hour；reload recalculates while SPA settings do not；official logo loads；all seven settings tabs work；Cancel does not save；Save changes duration；male／female availability is accurate；console has no new warning/error.

- [ ] **Step 4: Real Chrome lobby／practice acceptance**

Prove lobby mount makes no permission request；left 16:9 preview＋right join panel；allow and deny paths；`可以提早開始談判`；quality model loaded in lobby creates no second Worker／warmup after join；media stays continuous without second getUserMedia；accelerated 5／10／20 flows emit five exact offsets；one real-time 20-minute practice completes with Perxona、Presenter、voice preview、visual aggregates and report；return home disposes media and Worker.

- [ ] **Step 5: Responsive acceptance**

Inspect 320、375、768、1024、1440. Confirm no horizontal overflow、settings tabs reachable、lobby CTA visible、meeting controls do not overlap and focus order is logical. Save screenshots outside Git unless visual artifacts are already tracked.

- [ ] **Step 6: Update evidence note and commit docs**

Do not include credentials、account names、meeting codes、phone numbers、PINs or full private transcripts.

```bash
git add README.md docs/architecture.md docs/privacy-boundary.md CHANGELOG.md docs/superpowers/specs/2026-08-30-meet-home-lobby-scheduling-design.md
git commit -m "docs: explain the scheduled practice experience"
```

- [ ] **Step 7: Root final review and publish**

Root reviews correctness、readability、architecture、security and performance, then reruns:

```bash
npm run release:check
git diff --check origin/main...HEAD
git status --short --branch
git fetch origin
git rev-list --left-right --count origin/main...HEAD
git pull --ff-only origin main
git push origin main
```

Wait for the new main GitHub Actions run and require `success`. Never force push.

## Plan Self-Review Checklist

- [x] Every approved spec section maps to a task.
- [x] No placeholder、TBD、TODO、fake control or undefined public interface remains.
- [x] Task 5 owns media／ASR before lobby integration.
- [x] Task 3 makes events proportional before MeetingRoom consumes duration.
- [x] Task 4 preserves the current male Presenter and never maps female to male.
- [x] Task 7 saves all settings only through explicit global Save.
- [x] Task 9 recalculates only on full reload or an ended home meeting.
- [x] Task 10 preserves report evidence and manager fallback.
- [x] Task 12 requires one real 20-minute practice；unit tests alone are insufficient.
- [x] Public docs／Git contain no credentials、target IDs、Google account data、meeting codes、phone numbers or PINs.
