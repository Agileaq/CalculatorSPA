# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A scientific-calculator PWA: single-page, browser-executed, offline-capable, installable to a phone home screen, deployed to GitHub Pages. **Zero dependencies, zero build step** — pure HTML/CSS/native ES modules, no npm, no bundler, no framework. All paths are relative so it deploys under any subpath unchanged.

The repo lives on `master` and is developed directly on `master` (explicit standing decision for this project — do not create feature branches unless asked). Pushing to `master` triggers `.github/workflows/static.yml`, which auto-deploys the entire repo to GitHub Pages.

## Commands

Run locally (must be over HTTP — `file://` breaks ES modules and the service worker):
```bash
python3 -m http.server 8000
# Production view (cached, served by SW): http://localhost:8000/
# Trunk preview (no SW, live edits):    http://localhost:8000/dev.html
```

Tests are browser-based:
```bash
# Open in a browser and read the PASS/FAIL summary:
open tests/test.html   # or visit http://localhost:8000/tests/test.html
```

Headless checks (no test runner is wired up — use these for CI-style validation):
```bash
# Syntax-check every module (catches parse errors without a browser):
for f in js/*.js; do node --check --input-type=module < "$f" || echo "FAIL $f"; done

# app.js touches `document` at load, so it can only be syntax-checked, not imported headless.
# The engine modules (formatter/lexer/parser/evaluator/engine/tokens/history/state/keymap/mathmenu)
# and the assert* helpers are DOM-free and import cleanly under node --input-type=module.
```
`tests/assert.js` exposes `test/assertEqual/assertClose/assertThrows` (DOM-free) and `runAll` (uses `document`, browser-only). To run the suite headlessly, import the assert helpers + engine modules and invoke the registered `test` cases yourself; `runAll` will not work without a DOM.

## Architecture

### Two-layer split: Editor vs. engine pipeline
The **Editor** (`js/tokens.js`) holds the expression as an array of *atoms* (strings like `'2'`, `'+'`, `'sin('`, `'pi'`, `'Ans'`, `'nCr'`) plus a cursor index and undo/redo stacks. Adjacent digits merge into one number atom (`'3'`+`'1'` → `'31'`); operators stay separate atoms. The atom array is the canonical representation — it's what history stores and what recall restores.

The **engine pipeline** is a pure function chain, decoupled from the editor:
```
atoms → lex() → tokens → parse() → AST → evaluate(ast, ctx) → number → formatNumber()
```
- `js/lexer.js` `lex(atoms)`: flattens atoms to tokens, expands `sin(` → `FUNC`+`LPAREN`, and **inserts implicit `*`** between adjacent left-ending and right-starting tokens (e.g. `2 π` → `2 * π`, `)(` → `)*(`). Token taxonomy in `TOKEN_TYPES`.
- `js/parser.js` `parse(tokens)`: recursive descent. Precedence (low→high): `+ -` → `* /` → `nCr nPr` (combi) → unary `-` → `^` (**right-associative**) → postfix `%` → primary (num/const/var/Ans/func-call/paren). Trailing tokens after a complete parse = `Syntax Error`.
- `js/evaluator.js` `evaluate(node, ctx)`: walks the AST. `ctx = { angleMode, ans, vars }`. Domain errors (`/0`, `ln(≤0)`, `sqrt(<0)`, `asin`/`acos` out of `[-1,1]`, `nCr`/`nPr` invalid) throw `CalcError('Math Error')`; non-`CalcError` exceptions surface as `Syntax Error`.
- `js/engine.js` is the facade: `evaluate(atoms, ctx)` → `{ ok:true, value, display }` or `{ ok:false, error }`. It normalizes -0 to 0 and maps any thrown error to `'Math Error'` (if `CalcError`) or `'Syntax Error'`.
- `js/formatter.js` `formatNumber`: 12 significant digits, float-glitch cleanup (`0.1+0.2 → '0.3'`), `-0 → '0'`, scientific notation when `|n| ≥ 1e15` or `< 1e-9`.

### Dispatch pattern (the control spine)
Keypad buttons and physical keys both flow through one function: `dispatch(id)` in `js/app.js`.
- `js/keymap.js` defines three tables: `ACTIONS` (base), `SHIFT_ACTIONS` (second-function, with `label` for the on-key tag), `KEYBOARD` (physical-key → id).
- `dispatch(id)` resolves shift-vs-base: if Shift is on and the key has no `SHIFT_ACTIONS` entry, it toasts "该功能暂未开放" and clears Shift (except for `shift` itself).
- It then routes by `action.kind`:
  - **Insert kinds** (`digit` / `atom` / `func` / `ans`) → `execAction(action)` mutates the editor, clears shift, **resets the recall cursor**, then `render()`.
  - **Control kinds** (`backspace` / `clear` / `left` / `right` / `undo` / `redo` / `equals` / `toggleAngle` / `toggleShift` / `history` / `math` / `sto` / `historyUp` / `historyDown` / `placeholder`) → handled in a `switch`.
- `func`-kind payloads (`square`, `cube`, `recip`, `tenpow`, `eex`, `epow`) are **expanded by `execAction` into atom sequences**, not stored as single atoms — e.g. `square` → `^` `2`, `tenpow` → optional `*` + `1` `0` `^`. Any new compound insert belongs here.
- `js/mathmenu.js` `MATH_CATALOG` feeds the MATH panel; each item's `action` is routed back through `execAction`, so it reuses the same insert path.

### State & persistence
- `js/state.js` `AppState`: `angleMode` (DEG default, RAD toggle), `shift`, `ans`, and `recall` (history-replay cursor, `null` = not replaying).
- `js/history.js` `Store`: localStorage-backed. History is **newest-first** (`unshift`, capped at 100). Also stores `vars` (A–Z) for `STO`. Constructor accepts an injectable storage object, which the tests use (`memStorage`).

### History recall (∧ / ∨ keys, kinds `historyUp`/`historyDown`)
Casio REPLAY-style traversal in `recallUp()`/`recallDown()` (`app.js`):
- `∧` (historyUp): first press starts at index 0 (newest), each press goes older, clamps at oldest with a toast.
- `∨` (historyDown): goes newer; pressing past newest (index `< 0`) exits replay, clears the editor, and sets `recall = null`. When **not** replaying (`recall === null`), `∨` is a safe no-op so it never destroys current input.
- Any insert / backspace / clear / undo / redo / equals / history-panel-tap calls `state.resetRecall()`, so the next `∧` always starts fresh from newest. While replaying, the result line shows `= <recalled display>`.

### Rendering conventions
- `DISPLAY` map in `app.js` translates atoms for display: `*`→`×`, `/`→`÷`, `pi`→`π`, `sqrt(`→`√(`, `nCr`→`C`, `nPr`→`P`, etc. Add new display glyphs here, not in the engine.
- Error model is **gentle**: errors show in the result line (`Syntax Error` / `Math Error`), the expression is preserved, and the calculator never locks. Don't change this to a hard reset.

## Release flow: single-trunk + SW prompt-update (critical, non-obvious)

The repo is served **from the trunk root**: `index.html` is the real app shell, `sw.js` is the one and only service worker (scoped to the repo root), and `dev.html` is the no-SW trunk preview. There is **no version-gate redirect** and **no per-version snapshot directory** that users boot from.

Installed (Add-to-Home-Screen) PWAs **actively discover new versions**: the browser re-fetches `sw.js` (bypassing HTTP cache for the SW script) on navigation and ~every 24h; when the bytes differ (because the `CACHE` string changed), a new SW installs in the **waiting** state; `js/update.js` detects it via `updatefound`/`statechange`, shows a yellow `#update-banner`, and on tap sends `{type:'SKIP_WAITING'}` → the waiting SW `skipWaiting()`s → activates → deletes the old `CACHE` + `clients.claim()` → reload → fresh assets from the new cache. iOS survival: `visibilitychange` + hourly `registration.update()` (iOS suspends installed PWAs).

The reload is gated by a **dual signal** in `update.js`'s tap-Update handler, taking whichever fires first:
- Watch the **stable `newWorker` reference** (captured at `updatefound` as `reg.installing`, the same object through `installing`→`installed`→`activating`→`activated`) for `state === 'activated'`. `'activated'` only fires AFTER `activate`'s `e.waitUntil` resolves (cache swap done), so the reload fetch hits the new cache — NOT the half-swapped one.
- A **`controllerchange` backstop with a 500ms delay**, because iOS Safari standalone can drop the waiting worker's `statechange` listener across the install→activate transition. `controllerchange` still fires when the new SW `clients.claim()`s; the delay lets `activate`'s cache cleanup finish before the reload fetch.

This `sawUpdate` flag (set when the banner shows) gates the reload — first install never shows the banner → no reload. Do NOT revert to gating on a synchronously-captured `navigator.serviceWorker.controller` snapshot: iOS Safari standalone sets `controller` **asynchronously**, so that snapshot is `false` even on a real update and wrongly suppresses the reload (the original "tap Update does nothing" bug).

### The single source of truth = `sw.js` `CACHE`

`const CACHE = "calc-v8g";` in `sw.js` (and the `#version` badge text in `index.html`, and the `dev.html` label) is the version. **Bumping the `CACHE` string is what triggers the update** — the browser sees a byte-diff on `sw.js`. No `version.json`, no separate version file.

### Auto-stamp: every push triggers the update banner (no manual bump needed)

`.github/workflows/static.yml` has a **"Stamp commit SHA into cache + badge"** step that runs after checkout, before the Pages upload. On every push to `master` it rewrites three files **in the deployed artifact only** (the repo's working copy is NOT modified — the stamp lives in the workflow run, not in git):

- `sw.js` `CACHE`: `"calc-v8g"` → `"calc-v8g-<7char-SHA>"` (e.g. `"calc-v8g-abcdef1"`).
- `index.html` `#version`: `v8g` → `v8g · abcdef1`.
- `dev.html` `#version`: `v8g · dev` → `v8g · abcdef1 · dev`.

The stamp uses perl one-liners with **capture groups that preserve the human version** (`calc-([a-z0-9]+)` → `calc-$1-<SHA>`), so a future bump to `v9` stamps to `calc-v9-<SHA>`, not `calc-v8g-<SHA>`. It is **idempotent**: the `-` and ` · ` separators break the regex on an already-stamped string, so re-runs (e.g. workflow re-trigger) don't double-stamp.

**Why this exists:** so every push reaches installed (Add-to-Home-Screen) PWAs without a manual `CACHE` bump. The byte-diff on `sw.js` (the SHA in `CACHE` changed) is what the browser's SW update detector keys on — the SHA is the per-commit cache key. The **human-readable version** (`v8g`, `v9`...) is still bumped **manually** for real releases; the SHA suffix is the automatic per-commit prompt.

**Consequence — banner fatigue is real:** because *every* push now triggers, typo/WIP/experimental commits also prompt installed users. Treat `master` as shippable. If you want a commit to NOT reach installed users, either don't push it to `master` (use a throwaway local branch) or accept that it will prompt. There is no "push but skip the stamp" escape hatch by design — the stamp step is unconditional.

### To release a new human-readable version (e.g. v8g → v9)

1. Implement on the trunk (`js/`, `styles.css`, etc.) and verify via `dev.html` + `tests/test.html`.
2. Bump `sw.js` `CACHE` to the new tag (e.g. `"calc-v9"`). NOTE: the workflow will further append `-<SHA>` at deploy time → `calc-v9-<SHA>`.
3. Bump root `index.html` `#version` badge to the new label (e.g. `v9`). The workflow appends ` · <SHA>` → `v9 · <SHA>`.
4. Bump `dev.html` version label (e.g. `v8g · dev` → `v9 · dev`). The workflow inserts the SHA → `v9 · <SHA> · dev`.
5. Commit and push — the Pages workflow deploys automatically, stamping the SHA. That's the entire release: no snapshot dir, no gate flip, no per-version copy.

### Patch releases (v9 → v9a) — same as a full release

There is no longer a distinction between "full" and "patch" releases at the directory level (there's only one directory). A **patch release** (v9 → **v9a**) is just another `CACHE` + badge bump:

- `sw.js` `CACHE`: `"calc-v9"` → `"calc-v9a"` (workflow stamps → `"calc-v9a-<SHA>"`).
- Root `index.html` `#version` badge: `v9` → `v9a` (workflow stamps → `v9a · <SHA>`).
- `dev.html` label: `v9 · dev` → `v9a · dev` (workflow stamps → `v9a · <SHA> · dev`).

Rule of thumb: **the version tag is a cache-version string, not a directory.** Bump it for every real release, full or patch — the SHA suffix handles per-commit prompting in between.

### `vN/` snapshot directories — frozen rollback backups only

`v5/`, `v6/`, `v7/` are **not** boot targets. They are frozen self-contained copies kept as rollback backups. **Never edit a released snapshot's content** — with two documented one-time exceptions, both on `v7/`, made so that pre-single-trunk home-screen installs (pinned to `/v7/`) migrate onto the root SW:
- `v7/index.html` was rewritten to redirect to `../` (root).
- `v7/sw.js`'s `CACHE` was bumped (`calc-v7f` → `calc-v7g`) — the frozen cache-first v7 SW would otherwise serve the old `index.html` forever, so the bumped cache forces installed v7 clients to refetch and hit the redirect.

`v7/js/`, `v7/styles.css`, `v7/icons/` remain frozen.

To **roll back** to a snapshot in an emergency: temporarily make root `index.html` redirect to `vN/` (restoring the old gate behavior for one recovery), fix forward, then remove the redirect.

### `index.html` vs `dev.html` — service worker registration

Both share the keypad + `#display` DOM, but differ in SW registration:
- **`index.html`** (root, production = cached): registers the SW **via `js/update.js`** (called from `app.js`'s init). `update.js` skips registration when `<body data-dev>` is present.
- **`dev.html`** (trunk preview = always-fresh): has `<body data-dev>` so `update.js` skips SW registration; every reload fetches the fresh working copy.

When editing the trunk, do **not** add an inline SW-registration `<script>` to `index.html` — registration lives in `update.js`.

**Subtle invariants:** (1) `initUpdater()` is called synchronously at `app.js` init (not wrapped in `setTimeout`/`DOMContentLoaded`) so its registration + listeners attach early. (2) The post-update reload gates on `sawUpdate` (banner shown this session), NOT a synchronously-captured `navigator.serviceWorker.controller` flag — iOS Safari standalone sets `controller` asynchronously, so a startup snapshot would mis-read `false` on a real update and suppress the reload. (3) The tap-Update handler watches a **stable `newWorker` reference** captured at `updatefound` (not `reg.waiting` re-fetched at click time, which can be a different object and lose the listener) and has a `controllerchange`+500ms backstop for iOS where that listener is dropped. These three are load-bearing — changing them reintroduces the "tap Update shows the old version" bug.

## Tests

`tests/test.html` is a single module script that imports every engine module plus `assert.js` and registers ~70 cases covering formatter, lexer (incl. implicit multiply, nCr/nPr, new funcs), parser (precedence, right-assoc `^`, unary, nCr), evaluator (all funcs, angle modes, domain errors, nCr/nPr), engine facade, Editor merge/backspace/undo, Store ordering + persistence + 100-cap, AppState (incl. `recall`), keymap kinds + keyboard mapping + shift labels, and MATH_CATALOG shape. When you add an atom/kind/func, add a case here and keep it green before releasing.
