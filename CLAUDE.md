# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A scientific-calculator PWA: single-page, browser-executed, offline-capable, installable to a phone home screen, deployed to GitHub Pages. **Zero dependencies, zero build step** — pure HTML/CSS/native ES modules, no npm, no bundler, no framework. All paths are relative so it deploys under any subpath unchanged.

The repo lives on `master` and is developed directly on `master` (explicit standing decision for this project — do not create feature branches unless asked). Pushing to `master` triggers `.github/workflows/static.yml`, which auto-deploys the entire repo to GitHub Pages.

## Commands

Run locally (must be over HTTP — `file://` breaks ES modules and the service worker):
```bash
python3 -m http.server 8000
# Production view (versioned, with SW):  http://localhost:8000/        → redirects to /vN/
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

## Version-gate release flow (critical, non-obvious)

The repo is **not** served from the trunk. The root `index.html` is a *gate* that redirects to a frozen per-version snapshot directory, and `dev.html` is the only thing that runs the live trunk working copy.

- **Root `index.html`**: redirects to `/vN/` via `<meta http-equiv="refresh" content="0; url=vN/">` + `location.replace('vN/')` (replace so the back button isn't trapped). The two `当前版本：vN` comment markers are the single source of truth for "what is current" — flip both, plus the `url=vN/`, the `版本 <b>vN</b>`, the `点此进入` `href`, and the `location.replace('vN/')`.
- **`vN/` directories**: frozen, self-contained snapshots (own `index.html`, `js/`, `styles.css`, `manifest.webmanifest`, `sw.js`, `icons/`). All paths relative. **Old snapshots (`v5/`, …) are preserved unchanged as rollback targets** — never edit a released snapshot's content except to build the next one.
- **Trunk** lives at the repo root: `js/`, `styles.css`, `sw.js`, `manifest.webmanifest`, `dev.html`. `dev.html` references the trunk `js/` and deliberately does **not** register the service worker, so edits reload fresh.
- **`sw.js`** is cache-first with `CACHE = 'calc-vN'`; `activate` deletes non-current caches. The cache name **must** be bumped on every release or clients keep stale assets.

### To release a new version (e.g. v6 → v7)
1. Implement on the trunk (`js/`, `styles.css`, etc.) and verify via `dev.html` + `tests/test.html`.
2. Bump `sw.js` `CACHE` to `'calc-v7'`.
3. Create `v7/`: copy trunk `styles.css`, `manifest.webmanifest`, `sw.js`, and all `js/*.js` into it, plus `icons/` from the prior snapshot. Seed `v7/index.html` from the prior `vN/index.html`, then update the `#version` label and any new button attributes (e.g. dropping `data-placeholder` on keys that became real).
4. Flip root `index.html`: both `当前版本：v7` markers, the redirect URL, the version badge text, the manual link, and `location.replace('v7/')`.
5. Bump the `dev.html` version label (e.g. `v6 · dev` → `v7 · dev`).
6. Commit and push — the Pages workflow deploys automatically. Verify the JS in `vN/` is byte-identical to the trunk (the trunk is the source of truth; the snapshot is a copy).

### Patch releases (e.g. v6 → v6b, v7 → v7a) — DO NOT create a new snapshot dir

A **full version** (v6 → v7) creates a new `vN/` directory and flips the root gate to it. A **patch release** (v6 → **v6b**, v7 → **v7a**) ships a small fix to the *current* version **without** a new directory:

- **Root `index.html` gate stays at the current dir** — `url=v6/` and `location.replace('v6/')` are **unchanged**; do not flip to `v6b/`. The "current version" comment markers in the root gate stay `v6` (the *path* reflects the dir; only the CACHE name and the on-screen badge carry the letter).
- **Patch the existing snapshot in place** — copy the trunk's changed files into `v6/` (e.g. `v6/styles.css`, `v6/sw.js`, `v6/js/*.js`, new `v6/icons/*`). `v6/index.html` keeps its structure; update it only if the DOM structure changed (new buttons, removed `data-placeholder`, etc.), keeping the SW-registration `<script>` (it registers `sw.js`).
- **Bump the CACHE name AND the on-screen badge** — `calc-v6` → `calc-v6b` (in **both** trunk `sw.js` and `v6/sw.js`) to force installed clients to drop the old cache and refetch. **Also update `v6/index.html`'s `#version` badge** from `v6` to `v6b` so the *production page itself* shows the patch level — this lets you eyeball, on the live site, whether you're running the patched version or a stale cache (if the badge still says `v6`, the SW hasn't refetched yet).
- **`dev.html` label** bumps to the patch letter (e.g. `v6 · dev` → `v6b · dev`) so the trunk preview shows the patch level.
- Rule of thumb: **the letter is a cache-version tag, not a directory.** Only a digit bump (v7 → v8) makes a new directory and flips the gate.

### `vN/index.html` vs `dev.html` — service worker registration

Both share the keypad + `#display` DOM, but differ in one block at the bottom:
- **`vN/index.html`** registers the service worker (production = cached): `<script>if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('sw.js')); }</script>`
- **`dev.html`** deliberately does **not** register the SW (trunk preview = always-fresh): a comment replaces that block.

When patching a snapshot's `index.html` from the trunk, **re-add the SW-registration script** (don't copy dev.html's no-SW comment verbatim). When cutting a new full snapshot, seed `vN/index.html` from the prior `vN/index.html` (which already has the SW block), not from `dev.html`.

## Tests

`tests/test.html` is a single module script that imports every engine module plus `assert.js` and registers ~70 cases covering formatter, lexer (incl. implicit multiply, nCr/nPr, new funcs), parser (precedence, right-assoc `^`, unary, nCr), evaluator (all funcs, angle modes, domain errors, nCr/nPr), engine facade, Editor merge/backspace/undo, Store ordering + persistence + 100-cap, AppState (incl. `recall`), keymap kinds + keyboard mapping + shift labels, and MATH_CATALOG shape. When you add an atom/kind/func, add a case here and keep it green before releasing.
