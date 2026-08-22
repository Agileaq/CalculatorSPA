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
