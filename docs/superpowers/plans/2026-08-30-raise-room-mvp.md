# Raise Room MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an open-source, local-first browser MVP in which a user configures an annual-salary-review scenario, completes a deterministic 10-minute pressure simulation, and receives evidence-linked coaching feedback.

**Architecture:** A React/Vite browser application keeps the scenario, meeting transcript, event timeline, and report in local storage. Pure TypeScript domain functions generate scheduled pressure events and derive coaching evidence from an explicit transcript; the initial UI uses a simulated manager response adapter so no API key, camera frame, or external model is required. A future Perxona adapter will implement the same `ManagerResponder` interface rather than being embedded in UI components.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, React Testing Library, localStorage, CSS custom properties.

## Global Constraints

- User-facing Chinese uses Traditional Chinese and `週`, never `周`.
- Source code, build output, and documentation must never include API keys, real salary data, raw video, or personal data.
- The app is a private practice coach, never an employer assessment, hiring screen, lie detector, or mental-health tool.
- Raw camera video is out of scope for this increment; the UI must disclose that visual coaching is not yet enabled.
- Design a Meet-inspired meeting flow with original visual styling and no Google Meet branding, assets, or copied interface text.
- Perxona integration must remain disabled by default and use only an environment-configured publishable key when later enabled.
- Every report recommendation must point to explicit user-entered transcript evidence or state that evidence is absent.

---

### Task 1: Bootstrap the open-source browser project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/test/setup.ts`
- Create: `src/App.test.tsx`
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `README.md`

**Interfaces:**
- Produces: `npm run dev`, `npm test`, `npm run build`, and a rendered `App` root.

- [ ] **Step 1: Write the failing render test**

```tsx
import { render, screen } from "@testing-library/react";
import { App } from "./App";

test("renders Raise Room's local-first setup entry point", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Raise Room" })).toBeVisible();
  expect(screen.getByText("你的練習資料預設只留在這台裝置。"))
    .toBeVisible();
});
```

- [ ] **Step 2: Run the test and verify it fails because `App` is absent**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL with a module-resolution error for `./App`.

- [ ] **Step 3: Add the smallest Vite/React project and root App**

```tsx
export function App() {
  return (
    <main>
      <h1>Raise Room</h1>
      <p>你的練習資料預設只留在這台裝置。</p>
    </main>
  );
}
```

- [ ] **Step 4: Run tests and production build**

Run: `npm test -- src/App.test.tsx && npm run build`

Expected: one passing test and a successful Vite production build.

- [ ] **Step 5: Commit the bootstrap**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src .gitignore LICENSE README.md
git commit -m "chore: bootstrap local-first Raise Room app"
```

### Task 2: Add scenario and timed-event domain contracts

**Files:**
- Create: `src/domain/scenario.ts`
- Create: `src/domain/scenario.test.ts`

**Interfaces:**
- Produces: `Scenario`, `ScheduledEvent`, `defaultScenario`, `eventsDueAt`, and `buildManagerBrief`.
- Consumes: no browser or network API.

- [ ] **Step 1: Write failing event and brief tests**

```ts
import { defaultScenario, eventsDueAt, buildManagerBrief } from "./scenario";

test("returns the budget-freeze event exactly at minute three", () => {
  expect(eventsDueAt(defaultScenario, 180)).toEqual([
    expect.objectContaining({ id: "budget-freeze", minute: 3 }),
  ]);
});

test("builds a manager brief from scenario facts without exposing a hidden stance", () => {
  expect(buildManagerBrief(defaultScenario)).toContain("預算防守：高");
  expect(buildManagerBrief(defaultScenario)).not.toContain("隱藏立場");
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/domain/scenario.test.ts`

Expected: FAIL because `./scenario` is missing.

- [ ] **Step 3: Implement minimal deterministic contracts**

```ts
export function eventsDueAt(scenario: Scenario, elapsedSeconds: number) {
  return scenario.events.filter(
    (event) => event.minute * 60 === elapsedSeconds,
  );
}

export function buildManagerBrief(scenario: Scenario) {
  return [
    `主管姓名：${scenario.manager.name}`,
    `預算防守：${scenario.manager.budgetDefensiveness}`,
    `證據要求：${scenario.manager.evidenceDemand}`,
  ].join("\n");
}
```

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/domain/scenario.test.ts && npm run build`

Expected: both domain tests pass and build succeeds.

- [ ] **Step 5: Commit the domain slice**

```bash
git add src/domain
git commit -m "feat: model salary-review scenarios and pressure events"
```

### Task 3: Build the local scenario workshop

**Files:**
- Create: `src/components/ScenarioWorkshop.tsx`
- Create: `src/components/ScenarioWorkshop.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `Scenario`, `defaultScenario`.
- Produces: `onStart(scenario: Scenario): void` after required role, current salary, requested salary, manager name, and reason are present.

- [ ] **Step 1: Write a failing interaction test**

```tsx
test("starts a meeting with the configured manager and request", async () => {
  const onStart = vi.fn();
  render(<ScenarioWorkshop onStart={onStart} />);
  await userEvent.type(screen.getByLabelText("主管姓名"), "陳經理");
  await userEvent.type(screen.getByLabelText("期待月薪"), "85000");
  await userEvent.click(screen.getByRole("button", { name: "進入會議大廳" }));
  expect(onStart).toHaveBeenCalledWith(expect.objectContaining({
    manager: expect.objectContaining({ name: "陳經理" }),
    compensation: expect.objectContaining({ requestedMonthlySalary: 85000 }),
  }));
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/components/ScenarioWorkshop.test.tsx`

Expected: FAIL because `ScenarioWorkshop` is missing.

- [ ] **Step 3: Implement the local-only form**

Implement labeled controls for company, role, tenure, current salary, requested salary, minimum acceptable result, achievements, meeting reason, manager name, six personality parameters, and the five default timed events. Store draft values with `localStorage` only after user input; provide an explicit `清除本機草稿` control.

- [ ] **Step 4: Verify workshop behavior**

Run: `npm test -- src/components/ScenarioWorkshop.test.tsx && npm run build`

Expected: form interaction passes and build succeeds.

- [ ] **Step 5: Commit the scenario workshop**

```bash
git add src/components/ScenarioWorkshop.tsx src/components/ScenarioWorkshop.test.tsx src/App.tsx src/styles.css
git commit -m "feat: add local salary-review scenario workshop"
```

### Task 4: Add a deterministic meeting simulator and event timeline

**Files:**
- Create: `src/domain/meeting.ts`
- Create: `src/domain/meeting.test.ts`
- Create: `src/components/MeetingRoom.tsx`
- Create: `src/components/MeetingRoom.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `Scenario` and a `ManagerResponder`.
- Produces: `MeetingState` with an append-only transcript and one-time emitted events.
- `ManagerResponder.reply(input: { scenario: Scenario; transcript: TranscriptTurn[]; dueEvents: ScheduledEvent[] }): Promise<string>`.

- [ ] **Step 1: Write a failing state test**

```ts
test("emits each timed event only once", () => {
  const state = createMeeting(defaultScenario);
  const atMinuteThree = advanceMeeting(state, 180);
  const repeatedTick = advanceMeeting(atMinuteThree, 180);
  expect(atMinuteThree.emittedEventIds).toContain("budget-freeze");
  expect(repeatedTick.emittedEventIds).toEqual(atMinuteThree.emittedEventIds);
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/domain/meeting.test.ts`

Expected: FAIL because `./meeting` is missing.

- [ ] **Step 3: Implement the deterministic simulator and visible room**

Implement a simulated responder that speaks only from scenario facts and emitted events. Build a two-panel original meeting UI with manager stage, user stage, countdown, transcript, event rail, microphone/camera placeholders marked `尚未啟用`, a text input used only as a development fallback for speech, and an `結束並看報告` action.

- [ ] **Step 4: Add and verify meeting UI test**

```tsx
test("shows the budget-freeze card when the test clock reaches three minutes", () => {
  render(<MeetingRoom scenario={defaultScenario} responder={simulatedResponder} />);
  fireEvent.click(screen.getByRole("button", { name: "跳到第 3 分鐘" }));
  expect(screen.getByText("本季預算已凍結")).toBeVisible();
});
```

Run: `npm test -- src/domain/meeting.test.ts src/components/MeetingRoom.test.tsx && npm run build`

Expected: all meeting tests pass and build succeeds.

- [ ] **Step 5: Commit the meeting slice**

```bash
git add src/domain/meeting.ts src/domain/meeting.test.ts src/components/MeetingRoom.tsx src/components/MeetingRoom.test.tsx src/App.tsx src/styles.css
git commit -m "feat: simulate timed salary-review pressure meetings"
```

### Task 5: Generate evidence-linked coaching reports

**Files:**
- Create: `src/domain/report.ts`
- Create: `src/domain/report.test.ts`
- Create: `src/components/CoachingReport.tsx`
- Create: `src/components/CoachingReport.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `Scenario`, `TranscriptTurn[]`.
- Produces: `CoachingReport` with `strengths`, `practiceTargets`, `negotiationMap`, and evidence-bearing `Recommendation` items.

- [ ] **Step 1: Write a failing report test**

```ts
test("recommends a clearer request when the transcript lacks a requested salary", () => {
  const report = createCoachingReport(defaultScenario, [
    { speaker: "user", atSeconds: 40, text: "我想談談這一年的成果。" },
  ]);
  expect(report.practiceTargets).toContainEqual(expect.objectContaining({
    title: "提出具體要求",
    evidenceAtSeconds: 40,
  }));
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/domain/report.test.ts`

Expected: FAIL because `./report` is missing.

- [ ] **Step 3: Implement deterministic recommendations**

Derive only explicit signals: requested salary appears, achievement contains a number, a manager rejection is followed by a user response, and a next-step commitment appears. Return `evidenceAtSeconds` for every recommendation. Never create confidence, honesty, or emotion judgments.

- [ ] **Step 4: Add report UI and verify GREEN**

```tsx
test("links a practice target back to its transcript timestamp", () => {
  render(<CoachingReport report={reportWithMissingRequest} />);
  expect(screen.getByRole("button", { name: "查看 00:40" })).toBeVisible();
});
```

Run: `npm test -- src/domain/report.test.ts src/components/CoachingReport.test.tsx && npm run build`

Expected: report tests pass and build succeeds.

- [ ] **Step 5: Commit the report slice**

```bash
git add src/domain/report.ts src/domain/report.test.ts src/components/CoachingReport.tsx src/components/CoachingReport.test.tsx src/App.tsx src/styles.css
git commit -m "feat: add evidence-linked salary negotiation coaching reports"
```

### Task 6: Document local-first deployment and Perxona boundary

**Files:**
- Modify: `README.md`
- Create: `.env.example`
- Create: `docs/privacy-boundary.md`
- Create: `docs/perxona-integration.md`

**Interfaces:**
- Produces: a runnable local-development guide without any credentials.

- [ ] **Step 1: Write a documentation contract test**

```ts
test("does not enable Perxona without an explicit publishable key", () => {
  expect(readPerxonaConfig({})).toEqual({ enabled: false });
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/lib/perxona-config.test.ts`

Expected: FAIL because `readPerxonaConfig` is missing.

- [ ] **Step 3: Add disabled-by-default config and documentation**

Create `src/lib/perxona-config.ts` so only `VITE_PERXONA_CONNECT_PUBLISHABLE_KEY` enables the future Presenter path. Document raw-video handling, transcript routing, one-click deletion requirements, required API-key domain restrictions, and that Perxona integration is not part of this initial UI MVP.

- [ ] **Step 4: Verify the configuration contract and build**

Run: `npm test -- src/lib/perxona-config.test.ts && npm run build`

Expected: config test passes and build succeeds.

- [ ] **Step 5: Commit docs and safe integration boundary**

```bash
git add README.md .env.example docs src/lib/perxona-config.ts src/lib/perxona-config.test.ts
git commit -m "docs: define local-first and Perxona integration boundaries"
```

## Plan Self-Review

- Spec coverage: Tasks 2–5 cover scenario setup, manager personality, timed pressure events, a ten-minute meeting flow, transcript evidence, reports, and re-practice; Task 6 covers privacy, open source, and future Perxona integration. VRoid asset import, live speech, browser camera analysis, and external-model selection are explicitly deferred because each needs an independent risk-first plan.
- Placeholder scan: no `TBD`, `TODO`, or implementation-later placeholders are used; each task names files, contracts, tests, and expected command output.
- Contract consistency: `Scenario` feeds the workshop, meeting state, responder, and report; `TranscriptTurn[]` is append-only meeting output and report input; `ManagerResponder` prevents the UI from owning Perxona coupling.
