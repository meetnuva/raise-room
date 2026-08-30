# Live visual fix report — 2026-08-31

## Scope

Only the eight defects recorded in `live-visual-findings.md` were changed. No media ownership, permission timing, ASR, storage, Perxona runtime target, domain behavior, or dependencies changed.

## Delivered fixes

1. Home date cells now visibly render only the numeric day; the full date remains the button accessible name and `title`.
2. Schedule details are a wrapping, left-aligned flex column with a minimum width of zero.
3. The existing schedule-card CTA is a compact rounded chip; the card remains the only semantic button.
4. The self-camera sidebar is above the Presenter canvas.
5. Presenter launch/interrupt controls are compact, absolutely positioned stage overlays above the tile hit target.
6. Presenter status is a compact, non-interactive stage overlay.
7. The desktop settings dialog width is `min(54rem, calc(100vw - 32px))`, preserving its 208px rail, height limit, scrolling, and mobile rule.
8. Explicit device read/test controls are compact and have hover/focus feedback.

## TDD evidence

The focused suite was deliberately RED before production changes: 6 failures covering numeric date text, details/CTA layout, stage layering, Presenter overlays, settings width, and device action controls. After the production changes it was GREEN: 67/67 focused tests passed. A later live-CSS cascade issue on the Presenter action was also reproduced (computed `relative`, `z-index: 4`, `1126px` width), guarded by a new RED test, and fixed with a selector of matching specificity.

## Live Chrome evidence

At the default desktop viewport, the post-fix home DOM exposed buttons such as accessible `8月31日` with visible strong text `31`; settings computed to `864px`; details computed to `flex|column|0px`; and the CTA computed to `flex|nowrap|999px`.

In the meeting, the post-fix launch action computed to `position: absolute`, `z-index: 5`, and `127.664px` width. Layering was canvas `2`, self sidebar `3`, participant overlay `4`, and fixed controls `30`.

## Verification

- Focused: 5 files, 67/67 tests passed.
- Full: 59 files, 325/325 tests passed.
- Build: `tsc -b && vite build` passed.
- Release files: `npm run release:files` passed.
- Diff check: `git diff --check` passed.

## Review notes

Self-review found no correctness, architecture, security, performance, or scope issue. The browser emitted an existing `react-i18next` initialization warning but no errors; this visual-only change does not touch that dependency/runtime path. The Vite build retained its pre-existing large-chunk warning.

## Follow-up: self-tile overlap

The post-fix screenshot `06-raise-room-meeting-after.png` showed the compact launch action still overlapped the bottom-right self tile. A dedicated source regression test was RED against the old `right: .75rem` rule, then GREEN after anchoring the action at the manager stage horizontal center with `left: 50%` and `translateX(-50%)`. This keeps its absolute `z-index: 5` overlay behavior without changing the self-tile layout.

Fresh Chrome geometry verification measured the action at x `650.168..777.832`, the self tile at x `1144..1400`, and no rectangle intersection. The action remained `absolute`, `z-index: 5`.
