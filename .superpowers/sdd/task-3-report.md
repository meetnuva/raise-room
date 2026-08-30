# Task 3 report — local scenario workshop

## Scope delivered

- Added `ScenarioWorkshop`, which consumes `Scenario` and `defaultScenario` and calls `onStart(scenario)` only when the role, current salary, requested salary, manager name, and meeting reason are present.
- Added labeled local-only controls for company, role, tenure, all compensation values, achievements, reason, manager, six personality parameters, hidden stance, and the five default timed events.
- Drafts are read from and written only to browser `localStorage` after a field change. The form provides `清除本機草稿`.
- Connected the workshop in `App` and added responsive, keyboard-focus-visible form styling. No real API, key, network request, or Google Meet branding was added.

## RED

Command:

```sh
npm test -- src/components/ScenarioWorkshop.test.tsx
```

Result before implementation: failed as expected because `./ScenarioWorkshop` could not be resolved; the component did not yet exist.

## GREEN and verification

Commands:

```sh
npm test -- src/components/ScenarioWorkshop.test.tsx && npm run build
npm test
git diff --check
```

Results:

- Focused workshop suite: 2/2 tests passed.
- Production build: passed (`tsc -b && vite build`).
- Full suite: 3 test files and 5 tests passed.
- Whitespace diff check: passed.

The project does not have `@testing-library/user-event` installed, so the interaction test uses Testing Library's already-installed `fireEvent` for the same labeled input and button path, without changing dependencies.

## Commit

`ec40c73 feat: add local salary-review scenario workshop`

## Scope check and concerns

- Commit contains only `src/components/ScenarioWorkshop.tsx`, `src/components/ScenarioWorkshop.test.tsx`, `src/App.tsx`, and `src/styles.css`.
- The Chrome DevTools MCP server is not configured in this environment, so a live-browser screenshot/accessibility-tree pass was not available. Automated jsdom interaction, full tests, and production build were completed.

## Follow-up fix — Traditional Chinese local-only label

- Replaced the remaining English eyebrow label `Local-only setup` with `僅限本機設定` in `ScenarioWorkshop`.
- Added a focused assertion covering the Traditional Chinese label and confirming the English label is absent.

Verification after the fix:

- Focused suite: 3/3 tests passed.
- Full suite: 3 test files and 6 tests passed.
- Production build: passed (`tsc -b && vite build`).
