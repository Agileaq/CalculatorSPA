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

// Pure: should controllerchange trigger a reload? Only on a genuine update
// (a controller existed BEFORE the new SW took over), never on first install.
// sw.js's activate → self.clients.claim() transitions controller null→new SW
// on every install including the first, which fires controllerchange — so the
// reload must be guarded by the captured pre-registration controller state.
export function shouldReloadOnControllerChange(hadController) {
  return hadController === true;
}

// Re-fill the banner text IF the banner is currently visible. Safe no-op if
// the banner element is missing or hidden. Called from initUpdater's
// updatefound handler (after unhiding the banner) AND from applyLocale on
// locale switch, so a visible banner re-localizes when the user changes
// language (spec §4.7).
export function refreshUpdateBanner() {
  const banner = document.getElementById('update-banner');
  if (!banner || banner.hidden) return;
  const textEl = banner.querySelector('[data-update-text]');
  const actionEl = banner.querySelector('[data-update-action]');
  if (textEl) textEl.textContent = t('update.available');
  if (actionEl) actionEl.textContent = t('update.reload');
}

// Side-effecting: wire the whole update UX. Safe no-op if SW unsupported,
// dev preview (body[data-dev]), or the banner element is missing.
export function initUpdater() {
  if (!('serviceWorker' in navigator)) return;
  if (document.body.hasAttribute('data-dev')) return;
  const banner = document.getElementById('update-banner');
  if (!banner) return;
  const actionEl = banner.querySelector('[data-update-action]');
  // Capture BEFORE registering: was a prior SW controlling this page? On first
  // install this is false; on a genuine update it is true. Guards the
  // controllerchange reload below so cold installs don't reload the page.
  const hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (shouldShowBanner(nw.state, !!navigator.serviceWorker.controller)) {
          // Show first, then fill — refreshUpdateBanner no-ops while hidden.
          banner.hidden = false;
          refreshUpdateBanner();
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
    // First install: controller went null→new SW via clients.claim(), firing
    // controllerchange — DON'T reload. Genuine update: prior SW was controlling
    // (hadController captured pre-registration) → reload to pick up the new SW.
    if (shouldReloadOnControllerChange(hadController)) window.location.reload();
  });
}
