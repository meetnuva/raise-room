# Presenter StrictMode Stale Mount Fix

## Goal

修正真實 Chrome 在 React StrictMode 下產生兩個 `<sv-presenter>` 的 race：第一次 effect 啟動非同步 `mount()`，cleanup 時 element 尚未建立；engine Promise 完成後，已 destroy 的 client 仍 append stale element。結果舞台出現兩個 0% loader，第二個 element 溢出並遮擋「啟動 3D 主管」。

## Evidence

- 真實網址：`http://raise-room.localhost:5173/`。
- 完整 Publishable Key／Avatar／Scene／Voice env 已讀入，UI 顯示「3D 主管待啟動」。
- DOM readback：`document.querySelectorAll("sv-presenter").length === 2`。
- Screenshot：一個 loader 在 `.presenter-canvas`，另一個 stale loader 溢出到啟動按鈕下方。
- `createPresenterClient.mount()` 在 `await loadPresenterEngine(url)` 後無 destroyed check。
- `destroy()` 在 engine 尚未 load 時只能看到 `element === null`，因此無法移除未來才建立的 element。
- 現有 tests 沒有覆蓋 `destroy-before-engine-load-resolves` 或 `<StrictMode>` 真實 lifecycle。

## Scope

- Modify: `src/lib/perxona-presenter.ts`
- Modify: `src/lib/perxona-presenter.test.ts`
- Optionally modify: `src/hooks/use-perxona-presenter.test.tsx` only if a StrictMode hook regression is needed.
- Do not change API keys, target IDs, Chatbot, UI copy, Presenter CDN URL, audio order or broader meeting behavior.

## TDD

### RED 1: client destroyed while engine is loading

Place this test before the existing successful mount test so module-level `enginePromise` is initially unresolved:

```ts
test("does not append a presenter after destroy wins the engine-load race", async () => {
  const container = document.createElement("div");
  const client = createPresenterClient(url);
  const mounting = client.mount(container);

  client.destroy();
  document.head
    .querySelector<HTMLScriptElement>("script[data-perxona-presenter]")!
    .dispatchEvent(new Event("load"));
  await mounting;

  expect(container.querySelectorAll("sv-presenter")).toHaveLength(0);
});
```

Run:

```bash
npm test -- src/lib/perxona-presenter.test.ts --reporter=verbose
```

Expected before fix: FAIL, received one stale `sv-presenter`.

### GREEN 1: lifecycle guard

Add client-instance lifecycle state:

```ts
let destroyed = false;
```

After awaiting the engine, return before creation if destroyed:

```ts
await loadPresenterEngine(url);
if (destroyed || element) return;
```

At the start of `destroy()`, set `destroyed = true` before removing listeners/element. The client is single-use after destroy; do not add remount/revive behavior.

Run the focused test again; expected all PASS.

### RED/GREEN 2: StrictMode integration if needed

If the pure regression does not reliably protect the hook lifecycle, add a `<StrictMode>` wrapper test with a deferred engine/client factory proving only the active client can mount and the stale client is destroyed. Do not mock away the destroy-before-resolve ordering.

## Verification

```bash
npm test -- src/lib/perxona-presenter.test.ts src/hooks/use-perxona-presenter.test.tsx src/components/PerxonaManagerStage.test.tsx --reporter=verbose
npm run release:check
git diff --check
git status --short
```

Then Sol must rerun real Chrome at `raise-room.localhost`:

1. Reload and enter meeting.
2. Verify exactly one `sv-presenter` after mount.
3. Click 「啟動 3D 主管」.
4. Verify status moves `mounted → initializing → ready`.
5. Send one real Chatbot turn; verify the same reply enters transcript and Presenter speaks.
6. Check `CONNECT_KEY_REJECTED`, console errors, domain restriction, layout and cleanup.

## Commit

```bash
git add src/lib/perxona-presenter.ts src/lib/perxona-presenter.test.ts src/hooks/use-perxona-presenter.test.tsx
git commit -m "fix: cancel stale Presenter mounts"
```

Do not include `.env.local`, screenshots, keys, IDs or unrelated changes.
