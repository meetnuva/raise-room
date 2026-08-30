# Raise Room Open-Source Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓目前 MIT 授權、local-first 的 Raise Room 成為可安全公開的 Preview repository：新貢獻者能安裝、理解、驗證、回報問題，且每次 push／PR 都自動執行與本機一致的品質門檻。

**Architecture:** 保持單一 Node 24 + Vite + React 專案，不加入部署平台或新 runtime dependency。GitHub Actions 只讀 checkout，使用完整 commit SHA 固定官方 Actions；本機與 CI 共用 `check`、`audit:known`、`release:check` scripts。現有但無修正版的 Transformers 傳遞依賴以可到期 allowlist 管理，不得靜默忽略 `npm audit`。

**Tech Stack:** Node.js `24.13.1`、npm lockfile、Vitest、TypeScript、Vite、GitHub Actions、純 Node `.mjs` 驗證 scripts。

## Global Constraints

- 不建立 GitHub repository、不新增 remote、不 push、不改 branch；外部發布是後續獨立行動。
- 不建立或讀取 Perxona Key／Chatbot，也不要求 camera／microphone。
- 不加入 ESLint、Prettier、Playwright、secret-scanner SaaS、release bot 或 deployment dependency。
- 保留 `private: true` 與現有 MIT License。
- 文件一律繁體中文，程式碼／command／API identifier 保持原名。
- CI 不使用 secrets；workflow 權限固定 `contents: read`。
- 官方 Actions 使用完整 SHA：
  - `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`
  - `actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0`
- 新增 `.nvmrc` 固定 `24.13.1`，與 `package.json.engines.node >=24.13.1` 一致。
- 唯一暫時接受的 root advisories：
  - `GHSA-xcpc-8h2w-3j85`（`adm-zip`，經 `onnxruntime-node`）
  - `GHSA-f88m-g3jw-g9cj`（`sharp`）
- audit allowlist review deadline 固定 `2026-09-30`；到期、critical、新 advisory 或無法解析的依賴鏈一律 fail closed。
- 不宣稱 advisories 已修復；只能記錄目前 browser Whisper path 不呼叫 Node ZIP／image processing，仍須持續追蹤。

---

### Task 1: 可測試的 audit gate

**Files:**
- Create: `scripts/check-audit.mjs`
- Create: `scripts/check-audit.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `evaluateAuditReport(report, { today }) -> { ok, errors, knownAdvisories }`
- Produces CLI: `npm run audit:known`

- [ ] **Step 1: Write failing tests**

Tests must cover:

```js
expect(evaluateAuditReport(reviewedReport, { today: "2026-08-30" }).ok).toBe(true);
expect(evaluateAuditReport(reportWithNewGhsa, { today: "2026-08-30" }).ok).toBe(false);
expect(evaluateAuditReport(criticalReport, { today: "2026-08-30" }).ok).toBe(false);
expect(evaluateAuditReport(reviewedReport, { today: "2026-10-01" }).ok).toBe(false);
```

Fixture must model the current graph: `@huggingface/transformers` via `onnxruntime-node`／`sharp`，`onnxruntime-node` via `adm-zip`，terminal entries contain advisory objects.

- [ ] **Step 2: Verify RED**

Run: `npm test -- scripts/check-audit.test.mjs --reporter=verbose`

Expected: FAIL because implementation does not exist.

- [ ] **Step 3: Implement fail-closed evaluation and CLI**

```js
export const REVIEW_DEADLINE = "2026-09-30";
export const ALLOWED_ADVISORIES = new Set([
  "GHSA-xcpc-8h2w-3j85",
  "GHSA-f88m-g3jw-g9cj",
]);
```

- Parse `GHSA-*` from advisory-object URLs.
- Recursively resolve string `via` dependencies; terminate cycles.
- Any critical, unknown advisory, unresolved vulnerability or expired review is an error.
- A report with no vulnerabilities passes.
- CLI runs `npm audit --omit=dev --json` with `spawnSync`; exit 1 from npm audit is allowed only when valid JSON is present.
- Output dependency names, GHSAs and deadline only; never raw env/request data.
- `ok=false` sets `process.exitCode=1`.

- [ ] **Step 4: Add script and verify GREEN**

```json
"audit:known": "node scripts/check-audit.mjs"
```

Run:

```bash
npm test -- scripts/check-audit.test.mjs --reporter=verbose
npm run audit:known
```

Expected: tests PASS；live audit PASS and lists both reviewed GHSAs plus `2026-09-30`.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-audit.mjs scripts/check-audit.test.mjs package.json package-lock.json
git commit -m "chore: gate reviewed dependency advisories"
```

---

### Task 2: Tracked-file and credential release gate

**Files:**
- Create: `scripts/check-release.mjs`
- Create: `scripts/check-release.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `validateTrackedFiles(entries) -> string[]`
- Produces CLI: `npm run release:files`

- [ ] **Step 1: Write failing tests**

```js
expect(validateTrackedFiles(validEntries)).toEqual([]);
expect(validateTrackedFiles([[".env.local", "SECRET=x"]])[0]).toContain(".env.local");
expect(validateTrackedFiles([[".env.example", "PERXONA_CONNECT_SECRET_KEY=real-value"]])[0]).toContain("PERXONA_CONNECT_SECRET_KEY");
expect(validateTrackedFiles([["dist/index.html", "..."]])[0]).toContain("dist");
```

Also reject tracked `.DS_Store`, `.superpowers/`, `node_modules/`, `*.pem`, `*.key`, and non-empty `VITE_PERXONA_CONNECT_PUBLISHABLE_KEY`.

- [ ] **Step 2: Verify RED**

Run: `npm test -- scripts/check-release.test.mjs --reporter=verbose`

Expected: FAIL because implementation does not exist.

- [ ] **Step 3: Implement with Git as source of truth**

- CLI uses `git ls-files -z` and reads tracked regular files only.
- Files over 1 MiB or containing NUL skip content scan, but forbidden path rules still apply.
- Required public files: `README.md`, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.env.example`.
- Only blank assignments are allowed for `PERXONA_CONNECT_SECRET_KEY` and `VITE_PERXONA_CONNECT_PUBLISHABLE_KEY`.
- Variable names in source/docs/tests and `X-Connect-Key` server code are not themselves violations.
- Errors print file + rule, never the candidate value.

Package scripts:

```json
"release:files": "node scripts/check-release.mjs",
"check": "npm test -- --reporter=verbose && npm run build && npm run audit:known",
"release:check": "npm run release:files && npm run check"
```

- [ ] **Step 4: Verify behavior**

Run:

```bash
npm test -- scripts/check-release.test.mjs --reporter=verbose
npm run release:files
```

Expected now: unit tests PASS；CLI FAIL only because Task 3 public docs do not yet exist. Do not weaken this intentional cross-task gate.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-release.mjs scripts/check-release.test.mjs package.json package-lock.json
git commit -m "chore: add tracked release safety gate"
```

---

### Task 3: Public contributor and architecture documentation

**Files:**
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`
- Create: `CODE_OF_CONDUCT.md`
- Create: `CHANGELOG.md`
- Create: `docs/architecture.md`
- Create: `docs/decisions/0001-local-first-perxona-boundary.md`
- Create: `docs/decisions/0002-observable-not-psychological-signals.md`
- Create: `docs/decisions/0003-loopback-open-source-runtime.md`
- Modify: `README.md`

- [ ] **Step 1: Write exact current-state documents**

`CONTRIBUTING.md`:
- Node `24.13.1`, `nvm use`, `npm ci`, `.env.example` → `.env.local`.
- Commands: dev/test/build/audit/release check.
- TDD, Traditional Chinese UI, local-first privacy invariants.
- Ban real keys/screenshots with keys, employer scoring, deception/emotion/confidence inference.
- PR checklist: tests, build, docs, data flow, no automatic permissions, no credentials.

`SECURITY.md`:
- Use GitHub Security → Report a vulnerability when available; public issues must never contain keys/private transcripts.
- Explain Secret vs Publishable boundary and immediate revocation.
- Support current `main` Preview only.
- Known-advisory table: both GHSAs, dependency path, current non-reachability rationale, no fix, next review `2026-09-30`.
- State that reviewed/temporarily accepted does not mean fixed or harmless.

`CODE_OF_CONDUCT.md`: original concise project language, not a copied covenant; require respectful collaboration, no harassment/discrimination, and privacy of salary/meeting content.

`CHANGELOG.md` starts with:

```markdown
# Changelog
## [Unreleased]
### Added
- Local-first annual salary negotiation scenario workshop.
- Ten-minute pressure meeting with local voice/visual observation and evidence-linked report.
- Optional Perxona Presenter and server-only dynamic manager boundary with visible fallback.
```

ADRs use Status `Accepted`, Date `2026-08-30`, and document context/decision/alternatives/consequences:
1. Local-first data + server Secret / browser Publishable boundary.
2. Observable geometry/delivery only; reject psychological scores.
3. Single loopback Express + Vite Preview; no hosted multi-tenant claim.

`docs/architecture.md` includes:

```text
Browser UI
├─ Local: scenario draft, transcript memory, Whisper worker, MediaPipe worker
├─ Same-origin: /api/manager/status + /api/manager/reply
└─ Optional Presenter: Publishable Key + target
        │
Loopback Node server ── Secret Key ──> Perxona Chatbot
```

README adds Preview/local-first status and links to Architecture, Contributing, Security, Changelog, License. Do not add a CI badge before a remote URL exists.

- [ ] **Step 2: Verify docs and release gate**

```bash
rg -n "TODO|TBD|尚未撰寫|填入內容" README.md CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md CHANGELOG.md docs
npm run release:files
```

Expected: placeholder scan has no hits；release-files PASS.

- [ ] **Step 3: Commit**

```bash
git add README.md CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md CHANGELOG.md docs/architecture.md docs/decisions
git commit -m "docs: prepare public contributor handoff"
```

---

### Task 4: GitHub templates and immutable CI

**Files:**
- Create: `.nvmrc`
- Create: `.github/workflows/ci.yml`
- Create: `.github/dependabot.yml`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`

- [ ] **Step 1: Create minimal-permission CI**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  quality:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run release:check
```

Do not reference `${{ secrets.* }}`, write permissions or movable `@vN` tags.

- [ ] **Step 2: Add Dependabot and forms**

- npm and github-actions weekly Monday, timezone `Asia/Taipei`, max 5 open PRs, no auto-merge.
- PR checklist: scope, tests, build, release check, privacy/data flow, no credentials, sanitized screenshots only.
- Bug form: reproduction, expected/actual, browser/OS/Node, fallback vs Perxona mode, explicit redaction warning.
- Feature form: problem, outcome, local-first/privacy impact, alternatives; reject employer scoring and psychological inference requests.
- `config.yml`: `blank_issues_enabled: false`; omit contact links until a concrete public URL exists.

- [ ] **Step 3: Validate YAML and pins**

```bash
ruby -e 'require "yaml"; ARGV.each { |file| YAML.safe_load_file(file, aliases: true); puts file }' .github/workflows/ci.yml .github/dependabot.yml .github/ISSUE_TEMPLATE/bug_report.yml .github/ISSUE_TEMPLATE/feature_request.yml .github/ISSUE_TEMPLATE/config.yml
rg -n "uses:" .github/workflows/ci.yml
rg -n "secrets\\.|permissions: write|write-all|@v[0-9]" .github
```

Expected: YAML PASS；only two `uses:` lines, both full 40-character SHA；forbidden scan has no hits.

- [ ] **Step 4: Commit**

```bash
git add .nvmrc .github
git commit -m "ci: add pinned open-source quality gates"
```

---

### Task 5: Full completion audit

- [ ] **Step 1: Clean archive install**

Create a temp directory with `mktemp -d`, export `HEAD` using `git archive`, extract, then run:

```bash
npm ci
npm run release:check
```

Do not copy `.env.local`, `node_modules`, `dist` or `.superpowers`. Remove only the exact validated temp path after success and report that it was removed.

- [ ] **Step 2: Current worktree verification**

```bash
npm run release:check
git diff --check
git status --short
git ls-files | rg '(^|/)(node_modules|dist|\\.superpowers|\\.DS_Store)(/|$)'
```

Expected: release check PASS；diff PASS；worktree clean；forbidden tracked-file scan empty.

- [ ] **Step 3: Browser smoke without permissions**

At 1280×800 and 375×812:
- no horizontal overflow;
- first unconfigured fallback calls only `/api/manager/status`;
- no camera/microphone/model permission request;
- no external request, console error, page error or failed request.

- [ ] **Step 4: Self-review**

- Required files are tracked.
- Actions are SHA-pinned and token read-only.
- Live audit has no unreviewed advisory and deadline is future.
- Release checker never prints credential values.
- README does not claim true Key/VRoid/device/full-10-minute E2E is complete.
- No remote/publication occurred.

## Completion Definition

This phase completes only when `npm run release:check` passes in the current worktree and a clean archive install, browser smoke remains clean, worktree is clean, and no remote/publication occurred. It does **not** complete the product-wide goal: true Perxona keys/Chatbot, VRoid validation, device permissions, full 10-minute E2E and actual public publication remain separate gates.
