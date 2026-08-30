# Raise Room Meet Fidelity UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 Raise Room 的首頁、設定、準備室與談判室提升為高擬真 Google Meet 互動體驗，同時保留 nuva 品牌與既有 local-first 功能。

**Architecture:** 保留 `App → PracticeSession → PrejoinLobby／MeetingRoom` owner。新增無外部依賴的本地 SVG icon 與互動 primitives；每個頁面只持有自身 menu／popover／drawer UI state，跨頁 settings target 由 `App` 傳遞。高耦合 CSS 依序落地，每個 task 由 fresh Terra implementer 完成並經獨立 reviewer gate。

**Tech Stack:** React 19、TypeScript 7、vanilla CSS、Vitest、Testing Library、原生 `<dialog>`、本地 SVG。

## Global Constraints

- 保留官方藍色 nuva logo、Raise Room 名稱、薪資談判用途與 local-first 邊界；不複製 Google 商標、帳號或 Workspace 功能。
- 所有可見控制必須執行實際動作、開啟實際內容、切換可觀察狀態，或以 disabled 加原因呈現；禁止假按鈕。
- 不新增 UI framework、motion library、icon dependency、外部 runtime font 或 CDN。
- 動效只使用 opacity、transform、background-color、border-color、color、box-shadow；不得動畫化 width／height／top／left。
- Motion 固定為 `160ms cubic-bezier(.2, 0, 0, 1)`；dialog/drawer 固定 `180ms`；tooltip 固定延遲 `500ms`。
- Light focus 為 `2px solid var(--focus-light)`，dark focus 為 `2px solid var(--focus-dark)`，offset `2px`。
- MediaStream 與 ASR runtime 必須由 lobby 無縫交接 meeting，不得二次取得。
- Settings 只有 Save 寫入 allowlisted localStorage；UI-only state 不持久化或送往 Perxona。
- 每個 task 必須 RED → GREEN、focused tests、`npm run build`、`git diff --check`、commit、自我審查、獨立 task review。
- 不追蹤 screenshots、`.env.local`、credentials、account data、meeting codes、完整私人逐字稿或 device IDs。
- 所有 task、real Chrome 五尺寸驗收、20 分鐘真實流程與 release gate 完成前不得 push；絕不 force push。

## File Structure

- `src/components/ui/Icons.tsx`: 本地 SVG catalog 與 `IconName`。
- `src/components/ui/Tooltip.tsx`: 500ms hover/focus tooltip。
- `src/components/ui/IconButton.tsx`: 統一 icon button 狀態與 aria。
- `src/components/ui/ActionMenu.tsx`: menu、方向鍵、Escape、outside click、focus return。
- `src/components/HomeChrome.tsx`: 首頁說明、更多與身份 popover。
- `src/components/MeetingControlBar.tsx`: 六枚核心會議控制。
- `src/components/ParticipantMenu.tsx`: 主管與使用者人物操作。
- `src/components/ToastRegion.tsx`: 主管狀態、notice 與錯誤呈現。
- 現有 `MeetHome`、`PracticeSettingsDialog`、`PrejoinLobby`、`MeetingRoom`、`MeetingSidePanel`、`App` 與 `styles.css` 依任務修改。

---

### Task 1: Visual tokens, icons and interaction primitives

**Files:**
- Create: `src/components/ui/Icons.tsx`
- Create: `src/components/ui/Icons.test.tsx`
- Create: `src/components/ui/Tooltip.tsx`
- Create: `src/components/ui/Tooltip.test.tsx`
- Create: `src/components/ui/IconButton.tsx`
- Create: `src/components/ui/IconButton.test.tsx`
- Create: `src/components/ui/ActionMenu.tsx`
- Create: `src/components/ui/ActionMenu.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**

```tsx
export type IconName = "settings" | "help" | "more" | "account" | "meeting" | "history" | "microphone" | "microphoneOff" | "camera" | "cameraOff" | "captions" | "events" | "info" | "close" | "leave" | "back" | "pin" | "expand" | "devices" | "check" | "warning" | "loading";
export function Icon(props: { name: IconName; size?: number }): JSX.Element;
export type IconButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { icon: IconName; label: string; tone?: "default" | "inverse" | "danger"; selected?: boolean; tooltipDelayMs?: number };
export type ActionMenuItem = { id: string; label: string; icon: IconName; disabled?: boolean; disabledReason?: string; onSelect(): void };
```

- [ ] Write failing tests proving tooltip appears only after `500ms`, focus also opens it, timer cleans up, `aria-pressed` reflects selected, menu arrows/Escape/outside-click work and focus returns.
- [ ] Run `npm test -- --run src/components/ui/Icons.test.tsx src/components/ui/Tooltip.test.tsx src/components/ui/IconButton.test.tsx src/components/ui/ActionMenu.test.tsx`; require FAIL because components do not exist.
- [ ] Implement the exact interfaces with local `24×24` SVGs, no network/runtime dependency, and roving menu focus.
- [ ] Add the spec token names and primitive default／hover／pressed／focus／disabled／selected／danger CSS plus reduced-motion rules.
- [ ] Run focused tests, `npm run build`, `git diff --check`; commit `feat: add Meet-style interaction primitives`.

---

### Task 2: Functional home chrome and schedule interactions

**Files:**
- Create: `src/components/HomeChrome.tsx`
- Create: `src/components/HomeChrome.test.tsx`
- Modify: `src/components/MeetHome.tsx`
- Modify: `src/components/MeetHome.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:** `MeetHome` changes to `onOpenSettings(target?: "audio" | "video" | "voice" | "manager" | "personality" | "meeting" | "privacy"): void` while preserving `onEnterLobby()`.

- [ ] Write failing tests that help, settings, more and local-user controls each open real content; menu items route to exact settings targets; nav has icons; entire schedule card supports Enter/Space and inner CTA fires only once.
- [ ] Run `npm test -- --run src/components/HomeChrome.test.tsx src/components/MeetHome.test.tsx src/App.test.tsx`; require RED.
- [ ] Implement `HomeChrome` with four controls in order. More menu must contain only these real actions:

```tsx
[
  { id: "devices", label: "檢查裝置", icon: "devices", onSelect: () => onOpenSettings("audio") },
  { id: "privacy", label: "查看本機資料與隱私", icon: "info", onSelect: () => onOpenSettings("privacy") },
  { id: "about", label: "關於 Raise Room", icon: "help", onSelect: onOpenAbout },
]
```

- [ ] Rebuild nav as `80px` icon rail, date cells as `64×72px`, schedule card min-height `112px`, and all interactive states.
- [ ] Store settings target in `App` memory only; preserve Save/Cancel/localStorage behavior.
- [ ] Run focused tests, build, diff check; commit `feat: make the Meet-style home controls functional`.

---

### Task 3: Animated icon settings dialog and targeted navigation

**Files:**
- Modify: `src/components/PracticeSettingsDialog.tsx`
- Modify: `src/components/PracticeSettingsDialog.test.tsx`
- Modify: `src/components/DeviceSettingsPanel.tsx`
- Modify: `src/components/DeviceSettingsPanel.test.tsx`
- Modify: `src/components/VoiceSettings.tsx`
- Modify: `src/components/VoiceSettings.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**

```ts
export type SettingsTarget = "audio" | "video" | "voice" | "manager" | "personality" | "meeting" | "privacy";
```

`PracticeSettingsDialog` adds `initialTab?: SettingsTarget` and maps IDs to Traditional Chinese labels internally.

- [ ] Write failing tests for target panel, icon tabs, `scrollIntoView({block:"nearest", inline:"center"})`, `data-motion=entering|entered|leaving`, and close handoff only after exactly `180ms`.
- [ ] Run settings/device/voice/App focused tests; require RED.
- [ ] Replace label tuple with exact definitions:

```ts
const tabs = [
  { id: "audio", label: "音訊", icon: "microphone" }, { id: "video", label: "視訊", icon: "camera" },
  { id: "voice", label: "語音模型", icon: "captions" }, { id: "manager", label: "主管角色", icon: "account" },
  { id: "personality", label: "主管個性", icon: "info" }, { id: "meeting", label: "會議", icon: "meeting" },
  { id: "privacy", label: "隱私", icon: "settings" },
] as const;
```

- [ ] Implement one cleanup-safe close timer, native dialog/Escape/focus preservation, mobile selected-tab scroll, and danger-zone cancel-first confirmation.
- [ ] Apply `960px` width, max `720px`, `208px` rail, `64px` header/footer, `44px` tabs, backdrop fade and opacity/translate/scale only.
- [ ] Convert voice presets from three generic cards to a single selectable list/detail without changing model behavior.
- [ ] Run focused tests, build, diff check; commit `feat: animate and clarify practice settings`.

---

### Task 4: Meet-style prejoin preview controls and readiness

**Files:**
- Modify: `src/components/PrejoinLobby.tsx`
- Modify: `src/components/PrejoinLobby.test.tsx`
- Modify: `src/components/LocalCameraTile.tsx`
- Modify: `src/components/LocalCameraTile.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:** `PrejoinLobby` adds `onOpenSettings(target: "audio" | "video" | "voice"): void`; media and voice controllers remain unchanged.

- [ ] Write failing tests for overlay mic/camera/more icons, `aria-pressed`, red off state, device-menu routing, four readiness rows, optional note and unchanged explicit permission behavior.
- [ ] Run lobby/camera/App focused tests; require RED.
- [ ] Implement preview overlay at left/bottom `16px`, `48px` controls, `8px` gap. More menu opens real audio/video settings and never requests permission by opening.
- [ ] Derive four rows from existing controller state only:

```ts
type Readiness = "ready" | "optional" | "needs-action" | "loading";
```

- [ ] Keep join enabled, show `你仍可進入，未完成項目可在會議中開啟`, and reduce right panel to approved hierarchy.
- [ ] Run focused tests, build, diff check; commit `feat: rebuild the prejoin readiness experience`.

---

### Task 5: Fixed meeting control bar and responsive information drawer

**Files:**
- Create: `src/components/MeetingControlBar.tsx`
- Create: `src/components/MeetingControlBar.test.tsx`
- Modify: `src/components/MeetingRoom.tsx`
- Modify: `src/components/MeetingRoom.test.tsx`
- Modify: `src/components/MeetingSidePanel.tsx`
- Modify: `src/components/MeetingSidePanel.test.tsx`
- Modify: `src/components/LocalVoiceControl.tsx`
- Modify: `src/components/LocalVoiceControl.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**

```ts
export type MeetingPanelTab = "transcript" | "events" | "observations" | "devices";
```

`MeetingSidePanel` receives controlled `activeTab`, `onActiveTabChange`, `voiceContent`, `deviceContent`, `onClose`. `MeetingControlBar` consumes state/callbacks and never owns domain resources.

- [ ] Write failing tests for exact six-button order: `開始說話`, `關閉／開啟我的鏡頭`, `開啟逐字稿`, `開啟壓力事件`, `更多會議選項`, `離開並查看報告`; prove icons, aria state, danger leave, real tab routing, no wrapping and mobile focus return.
- [ ] Run control/room/panel/voice focused tests; require RED.
- [ ] Keep one mic icon in the bar; move language/model status/editable transcript preview into transcript panel without creating another voice controller.
- [ ] Implement fixed `56px` control group, `8px` gap, `48px` controls, dark surface, captions/events tab routing and a real more menu for voice/observation/devices/info.
- [ ] Make desktop panel `360px` push-stage; tablet/mobile overlay drawer with scrim; control bar remains above scrim.
- [ ] Compress header to title/time and move permanent engine rows into information content.
- [ ] Run focused tests, build, diff check; commit `feat: add the Meet-style meeting controls`.

---

### Task 6: Participant tile actions and meeting toasts

**Files:**
- Create: `src/components/ParticipantMenu.tsx`
- Create: `src/components/ParticipantMenu.test.tsx`
- Create: `src/components/ToastRegion.tsx`
- Create: `src/components/ToastRegion.test.tsx`
- Modify: `src/components/PerxonaManagerStage.tsx`
- Modify: `src/components/PerxonaManagerStage.test.tsx`
- Modify: `src/components/LocalCameraTile.tsx`
- Modify: `src/components/LocalCameraTile.test.tsx`
- Modify: `src/components/MeetingRoom.tsx`
- Modify: `src/components/MeetingRoom.test.tsx`
- Modify: `src/styles.css`

**Interfaces:** `type StageFocus = "manager" | "self"` owned by `MeetingRoom`. `ParticipantMenu` consumes `kind`, `pinned`, `expanded`, actual callbacks. `ToastRegion` consumes `{id, tone, message, durationMs, onDismiss}`.

- [ ] Write failing tests for manager pin/role/info; self expand/pin/device settings; reversible stage focus without resource remount; toast auto-dismiss at `4000ms`, manual close and persistent error alerts.
- [ ] Run participant/toast/stage/camera/room focused tests; require RED.
- [ ] Add hover overlays and only supported actions. Explicitly exclude fake mute-other/remove/host actions.
- [ ] Implement stage-focus CSS placement only; preserve Presenter, stream, transcript and meeting state mount identity.
- [ ] Convert engine source and manager notice to four-second toast; errors remain `role=alert` until resolved/dismissed.
- [ ] Run focused tests, build, diff check; commit `feat: add participant interactions and meeting toasts`.

---

### Task 7: Whole-flow polish, docs and real Chrome acceptance

**Files:**
- Modify: `src/styles.css`
- Modify: tests only for proven acceptance defects
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/architecture.md`
- Modify: `docs/privacy-boundary.md` only if boundary copy changes
- Modify: `docs/superpowers/specs/2026-08-30-meet-fidelity-ui-redesign-design.md` only to append evidence
- Update outside Git: `/Users/linshangche/Desktop/Perxona Connect Kit/2026-08-30｜Google Meet 頁面與互動架構分析.md`

**Interfaces:** Consumes Tasks 1–6; produces no new feature, only acceptance-proven fixes.

- [ ] Run `npm run release:check`, `git diff --check origin/main...HEAD`, `git status --short --branch`; require PASS and ignored `.env.local`.
- [ ] Reuse existing Chrome tabs. Capture same-viewport Google Meet and Raise Room screenshots, then Raise Room at `375×812`, `768×1024`, `1280×800`, `1440×900`, `1920×1080`; keep images outside Git and show key images to user.
- [ ] Inspect live Google Meet read-only: settings fade, icon hover/tooltip/pressed, top-right menus, available tile hover/click. Do not create a meeting, send data, accept permissions or change account settings solely for inspection.
- [ ] Click every visible Raise Room control and prove a real result: home menus, settings motion/tabs/Save/Cancel, lobby overlay and explicit permission, meeting control order/voice/drawer/participants/toasts, report/return. Check console after each page.
- [ ] Verify all five sizes: no horizontal overflow, selected tab visible, CTA/control non-overlap, drawer/scrim z-index, Escape/focus return, tooltip focus, reduced-motion final state.
- [ ] Run one uninterrupted real 20-minute practice with physical media, high-quality ASR, Presenter, confirmed edited voice turn, events at `2:00/6:00/10:00/14:00/18:00`, optional visual aggregate and automatic report. Dev reload or browser disconnect invalidates the claim.
- [ ] For every proven defect: add focused regression test, prove RED, implement minimum fix, prove GREEN, repeat browser view.
- [ ] Update docs with exact counts/evidence and no sensitive data.
- [ ] Root and fresh final reviewer approve; rerun full gate; fetch origin; require `git rev-list --left-right --count origin/main...HEAD` begins `0`; push `main`; require new GitHub Actions success. Never force push.

## Plan Self-Review

- [x] Spec sections 1–14 map to Tasks 1–7.
- [x] Task 1 produces every shared interface used later.
- [x] Every visible header/menu/participant/control maps to a real callback or disabled reason.
- [x] Media/ASR/Presenter owner and persistence boundaries remain unchanged.
- [x] Exact motion timings, dimensions, control order, viewport sizes and commands are present.
- [x] No UI framework, external icon/runtime font or speculative backend is introduced.
- [x] Final acceptance includes screenshots, live Meet inspection and uninterrupted 20-minute run before push.
