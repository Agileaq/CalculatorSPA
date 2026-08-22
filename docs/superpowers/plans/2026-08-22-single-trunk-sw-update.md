# Single-Trunk SW Prompt Update — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Add-to-Home-Screen PWAs actively discover new versions and apply them via a click-to-update banner, matching CalorieCounter's behavior — without adopting its build toolchain (stays zero-build / zero-npm).

**Architecture:** Root `index.html` becomes the real app shell (snapshot dirs become frozen rollback backups only). `sw.js` keeps cache-first but switches to prompt-style updates: install drops auto-`skipWaiting`, a new `message` channel gates `skipWaiting` behind a user click. A new `js/update.js` registers the SW, detects a waiting worker via `updatefound`/`statechange`, renders a banner (reusing `i18n`'s `t()`), keeps iOS alive via `visibilitychange` + hourly `registration.update()`, and reloads on `controllerchange`. Existing v7 home-screen installs get a one-time `v7/index.html` → root redirect onto the root SW.

**Tech Stack:** Pure HTML/CSS/native ES modules, zero dependencies, zero build step. No npm, no Vite, no Workbox. Hand-written `sw.js`.

**Spec:** `docs/superpowers/specs/2026-08-22-single-trunk-sw-update-design.md`

## Global Constraints

- **Zero-build / zero-npm:** no bundler, no framework, no external runtime or build dependency may be introduced. All paths relative. (Spec §1, §8.)
- **Version truth = `sw.js` `CACHE` string** (e.g. `"calc-v7f"` → `"calc-v8"`). No `version.json`, no separate version file. The byte change of this string is the SW-update trigger. (Spec §3 ⑥, §6.)
- **`dev.html` must never register the service worker.** Tracked via `<body data-dev>` attribute; `update.js` skips registration when present. (Spec §3 ⑦, §4.5.)
- **First install must not prompt.** Banner shows only when `navigator.serviceWorker.controller` already exists at the `installed` state. (Spec §4.2, §4.3.)
- **`i18n.js` is the sole string source.** Banner text via `t('update.available')` / `t('update.reload')`; new keys must include all 6 locales (en/zh/fr/es/ru/ar). (Spec §4.7.)
- **`app.js` business logic is untouched** except one `initUpdater()` call at the end of init. (Spec §8.)
- **`v7/sw.js`, `v7/js/`, `v7/styles.css`, `v7/icons/` stay frozen.** Only `v7/index.html` is rewritten (one-time migration exception). `v5/`, `v6/` untouched. (Spec §3 ⑧, §4.6.)
- **Snapshot dirs are no longer boot targets** — frozen rollback backups only. (Spec §6.)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `js/update.js` | Create | SW registration + waiting-worker detection + banner UI + iOS survival polling + reload on controllerchange. Exports `initUpdater()` (side-effecting, touches `navigator`/`document`) and `shouldShowBanner(state, hasController)` (pure decision, unit-testable). |
| `sw.js` (trunk) | Modify | Cache-first fetch unchanged. Install drops `skipWaiting`; add `message` → `{type:'SKIP_WAITING'}` → `skipWaiting()`. |
| `index.html` (root) | Rewrite | Replace redirect-gate with real app shell (from today's `v7/index.html` body). Add `#update-banner` element. Drop inline SW-registration `<script>`. |
| `dev.html` | Modify | Add `<body data-dev>` attribute. Bump version label. |
| `styles.css` | Modify | Add `#update-banner` + `#update-banner button` rules. |
| `js/i18n.js` | Modify | Add `update.available` + `update.reload` keys (6 locales each). |
| `js/app.js` | Modify | Import `initUpdater`; call once at end of init. |
| `v7/index.html` | Rewrite | One-time redirect to `../` so existing v7 installs migrate onto root SW. |
| `tests/test.html` | Modify | Import `shouldShowBanner`; add 4 unit cases for the banner state machine. |
| `CLAUDE.md` | Modify | Rewrite the "Version-gate release flow" section and related snapshot/§ references for single-trunk. |

**Why `shouldShowBanner` is split out:** `update.js` touches `navigator.serviceWorker`, so like `app.js` it cannot be imported headlessly. Extracting the pure boolean decision lets `tests/test.html` unit-test the state machine without a real SW — mirroring how the suite already tests "the judgment, not `app.js`'s `execAction`" (see the existing "空输入按运算符" cases).

---

## Task 1: i18n keys for the update banner

**Files:**
- Modify: `js/i18n.js` (inside the `STRINGS` object, after the `noAns` entry around line 72)
- Test: `tests/test.html` (add one assertion case importing `t` — already imported at line 19)

**Interfaces:**
- Produces: `t('update.available')` → translated string; `t('update.reload')` → translated string. Consumed by Task 3 (`update.js`) and Task 4 (`app.js` `applyLocale`-adjacent banner fill).

- [ ] **Step 1: Write the failing test**

Add to `tests/test.html` (after the existing i18n-using cases, before `runAll();`):

```js
// ---- Update banner i18n keys ----
test('i18n: update.available / update.reload 存在且 en 兜底', () => {
  setLocale('en');
  assertEqual(t('update.available'), 'New version available');
  assertEqual(t('update.reload'), 'Update');
});
test('i18n: update.* 至少 6 语言齐全', () => {
  for (const loc of LOCALES) {
    setLocale(loc.code);
    assertEqual(typeof t('update.available'), 'string');
    assertEqual(t('update.available').length > 0, true);
    assertEqual(t('update.reload').length > 0, true);
  }
  setLocale('en');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run locally: `python3 -m http.server 8000` then open `http://localhost:8000/tests/test.html`.
Expected: FAIL — `t('update.available')` returns the key string itself (fallback to key when entry missing, per `i18n.js` line 145).

- [ ] **Step 3: Write minimal implementation**

In `js/i18n.js`, inside `STRINGS`, add after the `noAns` block (around line 72):

```js
  // Update banner (SW prompt-style update)
  'update.available': {
    en: 'New version available', zh: '新版本可用',
    fr: 'Nouvelle version disponible', es: 'Nueva versión disponible',
    ru: 'Доступна новая версия', ar: 'إصدار جديد متاح',
  },
  'update.reload': {
    en: 'Update', zh: '更新',
    fr: 'Mettre à jour', es: 'Actualizar',
    ru: 'Обновить', ar: 'تحديث',
  },
```

- [ ] **Step 4: Run test to verify it passes**

Reload `http://localhost:8000/tests/test.html`.
Expected: PASS — both new cases green, and all pre-existing cases still green.

- [ ] **Step 5: Syntax-check headlessly**

```bash
node --check --input-type=module js/i18n.js
```
Expected: no output (no parse error).

- [ ] **Step 6: Commit**

```bash
git add js/i18n.js tests/test.html
git commit -m "feat(i18n): add update.available / update.reload keys (6 locales)"
```

---

## Task 2: sw.js — prompt-style update (drop auto skipWaiting, add message channel)

**Files:**
- Modify: `sw.js` (trunk, full rewrite — 30 lines)

**Interfaces:**
- Produces: SW that (a) precaches `ASSETS` on install **without** auto-`skipWaiting`, (b) deletes non-current caches + `clients.claim` on activate (unchanged), (c) responds to `{type:'SKIP_WAITING'}` `postMessage` by calling `self.skipWaiting()`, (d) cache-first fetch (unchanged).
- Consumes: nothing from earlier tasks. The page-side `postMessage({type:'SKIP_WAITING'})` sender is built in Task 3.

- [ ] **Step 1: Rewrite `sw.js`**

```js
const CACHE = "calc-v7f";
const ASSETS = [
  './', './index.html', './styles.css',
  './js/app.js', './js/tokens.js', './js/state.js', './js/history.js',
  './js/engine.js', './js/lexer.js', './js/parser.js', './js/evaluator.js',
  './js/formatter.js', './js/keymap.js', './js/mathmenu.js',
  './js/i18n.js', './js/tape.js', './js/update.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-192-maskable.png', './icons/icon-512-maskable.png',
  './icons/history.png',
  './icons/apple-touch-icon.png',
  './icons/apple-touch-icon-57.png', './icons/apple-touch-icon-60.png',
  './icons/apple-touch-icon-72.png', './icons/apple-touch-icon-76.png',
  './icons/apple-touch-icon-114.png', './icons/apple-touch-icon-120.png',
  './icons/apple-touch-icon-152.png', './icons/apple-touch-icon-167.png',
  './icons/apple-touch-icon-180.png',
];
self.addEventListener('install', (e) => {
  // Prompt-style: do NOT auto-skipWaiting. New SW waits; the page prompts the
  // user and posts {type:'SKIP_WAITING'} when they tap Update (see js/update.js).
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
```

Two changes vs. the old `sw.js`: (1) install handler no longer chains `.then(() => self.skipWaiting())`; (2) new `message` listener. `CACHE` string is **unchanged** at `"calc-v7f"` for now — the version bump happens at release time (Task 8), not during this build-out. `ASSETS` gains `'./js/update.js'` (created in Task 3).

- [ ] **Step 2: Syntax-check**

```bash
node --check sw.js
```
Expected: no output. (Plain script, `--input-type` default is fine.)

- [ ] **Step 3: Verify no regression on existing trunk preview**

`python3 -m http.server 8000` → open `http://localhost:8000/dev.html`. The dev page does not register the SW, so this change is inert in dev. Confirm the calculator still boots and renders (expression input + `=` works). No test assertion added here — SW behavior is verified end-to-end in Task 7.

- [ ] **Step 4: Commit**

```bash
git add sw.js
git commit -m "feat(sw): prompt-style update — drop auto skipWaiting, add SKIP_WAITING message channel"
```

---

## Task 3: js/update.js — registration, detection, banner, iOS survival, reload

**Files:**
- Create: `js/update.js`
- Test: `tests/test.html` (add import + 4 cases for `shouldShowBanner`)

**Interfaces:**
- Produces:
  - `shouldShowBanner(workerState, hasController)` → `boolean` (pure). Returns `true` iff `workerState === 'installed'` AND `hasController === true`.
  - `initUpdater()` → `void` (side-effecting). Reads `#update-banner` and `[data-update-action]` from the DOM; safe no-op if SW unsupported, `data-dev` present, or banner element absent.
- Consumes: `t` from `./i18n.js` (Task 1). DOM elements `#update-banner`, `#update-banner [data-update-text]`, `#update-banner [data-update-action]` (Task 5). `postMessage({type:'SKIP_WAITING'})` protocol from Task 2's SW.

- [ ] **Step 1: Write the failing test**

Add to the import block at top of `tests/test.html` (after the `i18n.js` import on line 19):

```js
import { shouldShowBanner } from '../js/update.js';
```

Add these cases before `runAll();`:

```js
// ---- update.js banner state machine (pure decision, no real SW) ----
test('shouldShowBanner: installed + has controller → true', () => {
  assertEqual(shouldShowBanner('installed', true), true);
});
test('shouldShowBanner: installed 但无 controller(首次安装) → false', () => {
  assertEqual(shouldShowBanner('installed', false), false);
});
test('shouldShowBanner: installing 态不提示', () => {
  assertEqual(shouldShowBanner('installing', true), false);
});
test('shouldShowBanner: activating/activated 不提示(此时已无 waiting)', () => {
  assertEqual(shouldShowBanner('activating', true), false);
  assertEqual(shouldShowBanner('activated', true), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

`http://localhost:8000/tests/test.html`.
Expected: FAIL — `SyntaxError: Failed to resolve module specifier '../js/update.js'` (file does not exist yet).

- [ ] **Step 3: Write minimal implementation — pure decision first**

Create `js/update.js`:

```js
// js/update.js
// SW prompt-style update: register root sw.js, detect a waiting worker,
// show a banner, keep iOS alive, reload on controllerchange.
// Pure decision exported for unit tests; initUpdater() does the DOM/SW work.
import { t } from './i18n.js';

// Pure: should the banner show given the installing worker's state and
// whether a controller already exists (i.e. this is NOT the first install)?
export function shouldShowBanner(workerState, hasController) {
  return workerState === 'installed' && hasController === true;
}

// Side-effecting: wire the whole update UX. Safe no-op if SW unsupported,
// dev preview (body[data-dev]), or the banner element is missing.
export function initUpdater() {
  if (!('serviceWorker' in navigator)) return;
  if (document.body.hasAttribute('data-dev')) return;
  const banner = document.getElementById('update-banner');
  if (!banner) return;
  const textEl = banner.querySelector('[data-update-text]');
  const actionEl = banner.querySelector('[data-update-action]');

  function fillBanner() {
    if (textEl) textEl.textContent = t('update.available');
    if (actionEl) actionEl.textContent = t('update.reload');
  }

  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (shouldShowBanner(nw.state, !!navigator.serviceWorker.controller)) {
          fillBanner();
          banner.hidden = false;
        }
      });
    });

    // iOS survival: installed PWAs get suspended; force an update check on
    // foreground and hourly. Only checks when the tab is visible.
    const check = () => { if (document.visibilityState === 'visible') reg.update(); };
    document.addEventListener('visibilitychange', check);
    setInterval(check, 60 * 60 * 1000);
  }).catch(() => { /* SW registration failed — fail silently, app still works uncached */ });

  // User taps Update → tell the waiting SW to take over → controllerchange → reload.
  if (actionEl) {
    actionEl.addEventListener('click', () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      });
    });
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

`http://localhost:8000/tests/test.html`.
Expected: PASS — all 4 `shouldShowBanner` cases green; full suite still green.

- [ ] **Step 5: Syntax-check headlessly**

```bash
node --check --input-type=module js/update.js
```
Expected: no output. (Note: `node --check` parses but does not execute, so the `navigator`/`document` references do not error at check time.)

- [ ] **Step 6: Commit**

```bash
git add js/update.js tests/test.html
git commit -m "feat(update): add js/update.js — SW registration, waiting-worker detection, banner, iOS survival"
```

---

## Task 4: Wire initUpdater() into app.js

**Files:**
- Modify: `js/app.js` (import block lines 2-9; init tail around line 633)

**Interfaces:**
- Consumes: `initUpdater` from `./update.js` (Task 3).
- Produces: `app.js` boots the updater after first render. No new exports.

- [ ] **Step 1: Add the import**

In `js/app.js`, add to the import block (after line 9, the `i18n.js` import):

```js
import { initUpdater } from './update.js';
```

- [ ] **Step 2: Call initUpdater() at the end of init**

At the very end of `js/app.js` (after the existing `updateBadge(); updateShift(); renderTape(); render(); scrollTapeToBottom();` line, ~line 633), append:

```js
// SW prompt-style update: register + detect + banner (no-op in dev.html via body[data-dev])
initUpdater();
```

- [ ] **Step 3: Syntax-check**

```bash
node --check --input-type=module js/app.js
```
Expected: no output (`app.js` touches `document` at load but `--check` only parses).

- [ ] **Step 4: Verify dev preview still boots**

`http://localhost:8000/dev.html` — calculator boots and renders; no banner (dev has `data-dev`, added in Task 6; until then `initUpdater` will try to register SW in dev — that's acceptable during build-out and is fixed by Task 6). Confirm no console errors from `app.js`.

- [ ] **Step 5: Commit**

```bash
git add js/app.js
git commit -m "feat(app): call initUpdater() at end of init"
```

---

## Task 5: Root index.html — real app shell + banner element

**Files:**
- Modify: `index.html` (root) — full rewrite from redirect-gate to app shell

**Interfaces:**
- Produces: root `index.html` containing the full calculator DOM (sourced from today's `v7/index.html`), a `#update-banner` element with `[data-update-text]` span and `[data-update-action]` button, `#version` set to the current version label, and **no** inline SW-registration `<script>` (registration is now in `update.js`).
- Consumes: `js/update.js` (Task 3) reads `#update-banner` etc. at `initUpdater()` time.

- [ ] **Step 1: Rewrite root `index.html`**

Use today's `v7/index.html` body verbatim as the base (the keypad DOM, `#statusbar` with `#badge`/`#lang`/`#version`, `#display`/`#tape-scroll`, `#toast`, `#math-panel`, `#keypad`), with these changes:

1. `#version` text: `v7f` (current; will bump at release).
2. Add the banner element right after the `</section>` that closes `#keypad` (i.e. just before `</div>` closing `#calc`), so it overlays above the keypad:
   ```html
   <div id="update-banner" hidden>
     <span data-update-text></span>
     <button type="button" data-update-action>Update</button>
   </div>
   ```
3. **Delete** the inline SW-registration `<script>` block (the `if ('serviceWorker' in navigator) { ... }` one). Keep `<script type="module" src="js/app.js"></script>`. The SW registration now lives in `update.js`, gated by `data-dev` (which root does NOT have).

The `<head>` links (`manifest`, `styles.css`, icons) match `v7/index.html`'s `<head>` exactly. The `<title>` stays `Calculator`.

- [ ] **Step 2: Verify root boots as the app**

`http://localhost:8000/` (root, not `/dev.html`). Now that root is the app shell, it loads `js/app.js` directly. Confirm: calculator renders, keypad works, `=` evaluates. (SW will register here — that's intended for production; in local HTTP it registers `sw.js` from the repo root.)

- [ ] **Step 3: Confirm banner is hidden by default**

On the root page, `#update-banner` has `hidden` → not visible (CSS Task makes `[hidden]` already `display:none` globally via line 8 of `styles.css`). No banner shows unless a waiting SW is detected.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(root): index.html becomes real app shell + #update-banner element; drop inline SW registration"
```

---

## Task 6: dev.html — body[data-dev] + version label

**Files:**
- Modify: `dev.html` (line 25 `<body>`; line 35 `#version` label)

**Interfaces:**
- Produces: `dev.html` with `<body data-dev>` so `initUpdater()` skips SW registration; version label bumped to match trunk.

- [ ] **Step 1: Add data-dev attribute**

In `dev.html`, change `<body>` (line 25) to:

```html
<body data-dev>
```

- [ ] **Step 2: Bump version label**

`dev.html` line 35, `<div id="version">v7f · dev</div>` — keep `v7f · dev` (current trunk version; will bump at release in Task 8). No change needed now unless the release in Task 8 sets a new number — leave as `v7f · dev` for this task.

- [ ] **Step 3: Verify dev preview is SW-free**

`http://localhost:8000/dev.html` → DevTools → Application → Service Workers: **none registered**. Confirm calculator boots, no banner, reload fetches fresh working copy (no cache).

- [ ] **Step 4: Commit**

```bash
git add dev.html
git commit -m "feat(dev): add body[data-dev] so initUpdater() skips SW registration in trunk preview"
```

---

## Task 7: styles.css — banner styling

**Files:**
- Modify: `styles.css` (add rules; place after the `.toast.show` block, ~line 93)

**Interfaces:**
- Produces: `#update-banner` visual rules — `position: absolute` scoped to `#calc` (like `.toast`/`#math-panel`), `--yellow` brand color, overlays the bottom of `#calc` while a waiting SW is detected.

**Placement note (read before implementing):** `#calc` is a flex column (`#statusbar` / `#display` (flex:1) / `#keypad`). The banner is `position: absolute` (out of flow) at `bottom: 8px`, so it overlays the bottom of `#calc` — over the keypad's bottom rows. This is intentional and acceptable: the banner only shows when an update is waiting and the user taps Update, which reloads immediately; the keypad does not need to stay usable while the banner is up.

- [ ] **Step 1: Add the banner CSS**

In `styles.css`, after the `.toast.show { opacity: 1; }` line (~line 93), add:

```css
/* Update banner: SW prompt-style update. Overlays bottom of #calc (over keypad)
   only while a waiting SW is detected; tapping Update reloads. */
#update-banner { position: absolute; left: 8px; right: 8px; bottom: 8px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: var(--yellow); color: #000; padding: 12px 14px; border-radius: 10px;
  font-size: 14px; font-weight: 600; z-index: 25; }
#update-banner button { background: #000; color: var(--yellow); border: none;
  border-radius: 6px; padding: 8px 16px; font-size: 14px; font-weight: 700; cursor: pointer; }
#update-banner button:active { opacity: .8; }
```

- [ ] **Step 2: Verify banner styling visually (manual)**

Temporarily make the banner visible to check styling: in browser console on `http://localhost:8000/`, run `document.getElementById('update-banner').hidden = false`. Confirm: yellow bar, black text, black button with yellow text, rounded, sits at bottom. Then `document.getElementById('update-banner').hidden = true` to restore.

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "style: add #update-banner overlay (yellow, above keypad, z-index 25)"
```

---

## Task 8: v7/index.html — one-time redirect to root (migrate existing installs)

**Files:**
- Rewrite: `v7/index.html` (full content replaced with a minimal redirect page)

**Interfaces:**
- Produces: `v7/index.html` that redirects to `../` (root) via `location.replace` + meta refresh, so an existing v7 home-screen install, on next launch, jumps to root and picks up the root SW. `v7/sw.js`, `v7/js/`, `v7/styles.css`, `v7/icons/`, `v7/manifest.webmanifest` stay **frozen and untouched**.

- [ ] **Step 1: Rewrite `v7/index.html`**

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Scientific Calculator</title>
  <!--
    v7 snapshot: superseded by single-trunk root. Existing home-screen installs
    pinned to /v7/ hit this page on launch and are forwarded to the root app
    (which registers the root sw.js and joins the prompt-style update flow).
    v7/sw.js, v7/js/, v7/styles.css, v7/icons/ remain frozen as rollback backup.
  -->
  <meta http-equiv="refresh" content="0; url=../">
  <style>
    html, body { height: 100%; margin: 0; background: #000; color: #fff;
      font-family: -apple-system, system-ui, sans-serif; }
    #gate { min-height: 100%; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 14px; }
    .name { font-size: 20px; letter-spacing: 1px; opacity: .9; }
    .ver  { font-size: 13px; color: #8a8a8e; letter-spacing: 2px; }
  </style>
</head><body>
  <div id="gate">
    <div class="name">Scientific Calculator</div>
    <div class="ver">v7 → redirecting…</div>
  </div>
  <!-- replace-redirect: back button not trapped on the gate page -->
  <script>location.replace('../');</script>
</body></html>
```

`../` is relative to `v7/`, resolving to `/CalculatorSPA/` (root).

- [ ] **Step 2: Verify v7 redirects to root**

`http://localhost:8000/v7/` → should immediately redirect to `http://localhost:8000/` (root app). Confirm the calculator renders at root after the redirect.

- [ ] **Step 3: Confirm v7 assets are untouched**

```bash
git status v7/
```
Expected: only `v7/index.html` shows as modified; `v7/sw.js`, `v7/js/`, `v7/styles.css`, `v7/icons/`, `v7/manifest.webmanifest` do **not** appear (unchanged).

- [ ] **Step 4: Commit**

```bash
git add v7/index.html
git commit -m "feat(v7): redirect v7/index.html to root (migrate existing home-screen installs onto root SW)"
```

---

## Task 9: CLAUDE.md — rewrite release-flow section for single-trunk

**Files:**
- Modify: `CLAUDE.md` (the "Version-gate release flow (critical, non-obvious)" section + "Patch releases" subsection + "`vN/index.html` vs `dev.html`" subsection + Architecture snapshot references)

**Interfaces:**
- Produces: `CLAUDE.md` accurately describing the new single-trunk + prompt-update release flow, so future work follows the new convention.

- [ ] **Step 1: Replace the "Version-gate release flow" section**

Open `CLAUDE.md`. Replace the entire `## Version-gate release flow (critical, non-obvious)` section (from the `## Version-gate...` heading through the end of the `### \`vN/index.html\` vs \`dev.html\` — service worker registration` subsection) with:

````markdown
## Release flow: single-trunk + SW prompt-update (critical, non-obvious)

The repo is served **from the trunk root**: `index.html` is the real app shell, `sw.js` is the one and only service worker (scoped to the repo root), and `dev.html` is the no-SW trunk preview. There is **no version-gate redirect** and **no per-version snapshot directory** that users boot from.

Installed (Add-to-Home-Screen) PWAs **actively discover new versions**: the browser re-fetches `sw.js` (bypassing HTTP cache for the SW script) on navigation and ~every 24h; when the bytes differ (because the `CACHE` string changed), a new SW installs in the **waiting** state; `js/update.js` detects it via `updatefound`/`statechange`, shows a yellow `#update-banner`, and on tap sends `{type:'SKIP_WAITING'}` → the waiting SW activates → `controllerchange` → `location.reload()` → fresh assets from the new cache. iOS survival: `visibilitychange` + hourly `registration.update()` (iOS suspends installed PWAs).

### The single source of truth = `sw.js` `CACHE`

`const CACHE = "calc-v7f";` in `sw.js` (and the `#version` badge text in `index.html`, and the `dev.html` label) is the version. **Bumping the `CACHE` string is what triggers the update** — the browser sees a byte-diff on `sw.js`. No `version.json`, no separate version file.

### To release a new version (e.g. v7f → v8)

1. Implement on the trunk (`js/`, `styles.css`, etc.) and verify via `dev.html` + `tests/test.html`.
2. Bump `sw.js` `CACHE` to the new tag (e.g. `"calc-v8"`).
3. Bump root `index.html` `#version` badge to the new label (e.g. `v8`).
4. Bump `dev.html` version label (e.g. `v7f · dev` → `v8 · dev`).
5. Commit and push — the Pages workflow deploys automatically. That's the entire release: no snapshot dir, no gate flip, no per-version copy.

### Patch releases (v8 → v8a) — same as a full release

There is no longer a distinction between "full" and "patch" releases at the directory level (there's only one directory). A **patch release** (v8 → **v8a**) is just another `CACHE` + badge bump:

- `sw.js` `CACHE`: `"calc-v8"` → `"calc-v8a"` (forces installed clients to drop the old cache and refetch).
- Root `index.html` `#version` badge: `v8` → `v8a` (so the live page shows the patch level — if the badge still says `v8`, the SW hasn't refetched yet).
- `dev.html` label: `v8 · dev` → `v8a · dev`.

Rule of thumb: **the version tag is a cache-version string, not a directory.** Bump it for every release, full or patch.

### `vN/` snapshot directories — frozen rollback backups only

`v5/`, `v6/`, `v7/` are **not** boot targets. They are frozen self-contained copies kept as rollback backups. **Never edit a released snapshot's content** — with one documented exception: `v7/index.html` was rewritten to redirect to `../` (root) so that pre-single-trunk home-screen installs (pinned to `/v7/`) migrate onto the root SW. `v7/sw.js`, `v7/js/`, `v7/styles.css`, `v7/icons/` remain frozen.

To **roll back** to a snapshot in an emergency: temporarily make root `index.html` redirect to `vN/` (restoring the old gate behavior for one recovery), fix forward, then remove the redirect.

### `index.html` vs `dev.html` — service worker registration

Both share the keypad + `#display` DOM, but differ in SW registration:
- **`index.html`** (root, production = cached): registers the SW **via `js/update.js`** (called from `app.js`'s init). `update.js` skips registration when `<body data-dev>` is present.
- **`dev.html`** (trunk preview = always-fresh): has `<body data-dev>` so `update.js` skips SW registration; every reload fetches the fresh working copy.

When editing the trunk, do **not** add an inline SW-registration `<script>` to `index.html` — registration lives in `update.js`.
````

- [ ] **Step 2: Update the Architecture section's snapshot reference**

In `CLAUDE.md`'s top "What this is" / Architecture section, find any sentence stating that the root `index.html` redirects to a frozen snapshot or that snapshots are boot targets, and update to reflect single-trunk. Specifically, replace:

```
The repo lives on `master` and is developed directly on `master` ...
```

block's surrounding context only if it references the gate. If the "What this is" section says "deployed to GitHub Pages" without referencing the gate, leave it. Check for and fix any line implying `vN/` is the production boot target.

- [ ] **Step 3: Verify the file reads coherently**

Read through the modified `CLAUDE.md` sections; confirm no remaining reference to "flip the root gate", "create `vN/`", or "`vN/index.html` registers sw.js inline" contradicts the new flow.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): rewrite release-flow section for single-trunk + SW prompt-update"
```

---

## Task 10: End-to-end verification + syntax sweep

**Files:**
- None modified — verification only.

**Interfaces:**
- Produces: confidence that the whole mechanism works and all modules parse.

- [ ] **Step 1: Syntax-check every module**

```bash
for f in js/*.js sw.js; do node --check --input-type=module < "$f" 2>/dev/null || node --check "$f"; echo "-> $f"; done
```
Expected: no `SyntaxError` for any file. (`app.js` and `update.js` touch `document`/`navigator` but `--check` only parses.)

- [ ] **Step 2: Run the full browser test suite**

`http://localhost:8000/tests/test.html`.
Expected: all cases PASS, including the new `shouldShowBanner` (4) and i18n (2) cases. Summary line shows 0 failed.

- [ ] **Step 3: Manual E2E — dev preview is SW-free**

`http://localhost:8000/dev.html` → DevTools → Application → Service Workers: none. Calculator works. No banner.

- [ ] **Step 4: Manual E2E — root registers SW, banner hidden initially**

`http://localhost:8000/` → DevTools → Application → Service Workers: `sw.js` registered, status `activated`. No banner (no waiting worker). `#version` shows `v7f`.

- [ ] **Step 5: Manual E2E — simulate an update**

To simulate a new version locally: bump `sw.js` `CACHE` to `"calc-v7f-test"` and `index.html` `#version` to `v7f-test` (do not commit). Reload `http://localhost:8000/`. DevTools → Application → Service Workers: a new `sw.js` appears in **waiting** state. The yellow `#update-banner` should show. Tap **Update** → page reloads → `#version` now shows `v7f-test`, old cache deleted. Then revert the two edits (do not commit the test bump).

- [ ] **Step 6: No commit (verification only)**

If the test bump from Step 5 was committed by accident, revert it: `git checkout -- sw.js index.html`. Confirm `git status` is clean except for already-committed task work.

---

## Self-Review

**1. Spec coverage** — mapping each spec section to a task:

| Spec section | Task(s) |
|---|---|
| §3 ① single-trunk root | Task 5 |
| §3 ② prompt-style SW (drop auto skipWaiting, SKIP_WAITING message) | Task 2 |
| §3 ③ new `js/update.js` reusing `t()` | Task 3 (+ Task 1 for the keys it consumes) |
| §3 ④ iOS survival (visibilitychange + hourly update) | Task 3 |
| §3 ⑤ v7 → root migration | Task 8 |
| §3 ⑥ CACHE string = sole version truth | Task 2 (keeps it); Task 9 (documents it) |
| §3 ⑦ dev.html SW-free via data-dev | Task 6 |
| §3 ⑧ snapshots = frozen backups | Task 9 (documents); Task 8 (v7 redirect exception) |
| §4.2 sw.js changes | Task 2 |
| §4.3 update.js state machine | Task 3 (+ tests) |
| §4.4 root index.html | Task 5 |
| §4.5 dev.html | Task 6 |
| §4.6 v7/index.html redirect | Task 8 |
| §4.7 i18n keys | Task 1 |
| §5 end-to-end flow | Task 10 (manual E2E) |
| §6 release-flow rewrite | Task 9 |
| §7 testing (headless + browser suite + manual) | Task 1/3 (browser cases), Task 10 (syntax + manual) |

No spec section is unimplemented.

**2. Placeholder scan** — No "TBD"/"TODO"/"implement later"/"add error handling"/"similar to Task N" in the plan. Every code step contains actual code. The Task 7 CSS block had exploratory drafts in-process but the **final** block is concretely specified (the `bottom: 8px` `--yellow` version) — the executor uses the final block only.

**3. Type consistency** — `shouldShowBanner(workerState, hasController)` signature: defined in Task 3 Step 3, tested in Task 3 Step 1, called in Task 3 Step 3 (`shouldShowBanner(nw.state, !!navigator.serviceWorker.controller)`). `initUpdater()` signature: defined Task 3, imported Task 4 Step 1, called Task 4 Step 2. `t('update.available')`/`t('update.reload')` keys: defined Task 1 Step 3, consumed Task 3 Step 3. `SKIP_WAITING` message type: sent Task 3 Step 3 (`postMessage({ type: 'SKIP_WAITING' })`), received Task 2 Step 1 (`e.data.type === 'SKIP_WAITING'`). DOM ids `[data-update-text]`/`[data-update-action]`/`#update-banner`: produced Task 5 Step 1, consumed Task 3 Step 3. All consistent.

**4. Ambiguity** — Task 7's banner placement was the one spot that needed a firm decision; resolved to `position: absolute; bottom: 8px` within `#calc`, overlaying the bottom over the keypad (acceptable since Update reloads immediately). The single final CSS block is the only one the executor uses; no competing drafts remain in the task body.
