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

// Pure: should controllerchange trigger a reload? Only when we actually saw an
// update this session (the banner path fired). We do NOT gate on a synchronously
// captured hadController flag because iOS Safari standalone sets
// navigator.serviceWorker.controller ASYNCHRONOUSLY — a pre-capture hadController
// can be false even on a real update, wrongly suppressing the reload (the
// tap-Update-does-nothing bug). The banner path (updatefound + a controller
// exists at THAT moment) is the authoritative "this is an update" signal; first
// install never shows the banner, so sawUpdate stays false on cold install.
export function shouldReloadOnControllerChange(sawUpdate) {
  return sawUpdate === true;
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
  // sawUpdate: did the banner path fire this session (updatefound + a controller
  // existed)? This is the authoritative "this is an update, not a first install"
  // signal. Set true when we show the banner; gates the controllerchange reload.
  // NOT a synchronous navigator.serviceWorker.controller snapshot — iOS Safari
  // standalone sets controller async, so such a snapshot is unreliable.
  let sawUpdate = false;

  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (shouldShowBanner(nw.state, !!navigator.serviceWorker.controller)) {
          // Show first, then fill — refreshUpdateBanner no-ops while hidden.
          banner.hidden = false;
          refreshUpdateBanner();
          sawUpdate = true;   // mark that a real update was seen this session
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
    // First install: no banner was ever shown (shouldShowBanner needs a controller
    // at updatefound time, which a cold install lacks) → sawUpdate false → no reload.
    // Genuine update: banner path set sawUpdate true → reload to pick up the new SW.
    // Gating on sawUpdate (not a synchronous controller snapshot) keeps this correct
    // on iOS Safari standalone, where controller is set asynchronously.
    if (shouldReloadOnControllerChange(sawUpdate)) window.location.reload();
  });
}
