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

// Pure: should we reload after the new SW activates? Only when we actually saw an
// update this session (the banner path fired). We do NOT gate on a synchronously
// captured hadController flag because iOS Safari standalone sets
// navigator.serviceWorker.controller ASYNCHRONOUSLY — a pre-capture hadController
// can be false even on a real update, wrongly suppressing the reload (the
// tap-Update-does-nothing bug). The banner path (updatefound + a controller
// exists at THAT moment) is the authoritative "this is an update" signal; first
// install never shows the banner, so sawUpdate stays false on cold install.
export function shouldReloadAfterUpdate(sawUpdate) {
  return sawUpdate === true;
}

// Pure: on page load, is there ALREADY a waiting worker that warrants showing
// the banner? updatefound only fires when a NEW worker begins installing during
// THIS page session. A worker that finished installing in a prior session
// (e.g. while the PWA was backgrounded, or installed then the user refreshed
// without tapping Update) sits in reg.waiting but never re-fires updatefound —
// so without this check the banner never (re)appears and the user is stranded
// on the old version. Treat a present waiting worker + an existing controller
// (i.e. NOT a first install) as "an update is ready right now".
export function shouldShowBannerForWaiting(waiting, hasController) {
  return !!waiting && hasController === true;
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
  // signal. Set true when we show the banner; gates the post-activation reload.
  // NOT a synchronous navigator.serviceWorker.controller snapshot — iOS Safari
  // standalone sets controller async, so such a snapshot is unreliable.
  let sawUpdate = false;
  // newWorker: the worker from updatefound, captured as a stable reference so the
  // click handler can watch ITS statechange to 'activated'. reg.waiting at click
  // time can be a different object on some engines, losing the listener.
  let newWorker = null;

  // Show the banner + mark an update was seen. Shared by the live-updatefound
  // path AND the waiting-on-load path below so they can't diverge.
  const showBanner = () => {
    banner.hidden = false;
    refreshUpdateBanner();
    sawUpdate = true;
  };

  navigator.serviceWorker.register('sw.js').then((reg) => {
    // Waiting-on-load: a worker may have finished installing in a PRIOR session
    // (while backgrounded, or the user refreshed without tapping Update). It sits
    // in reg.waiting and does NOT re-fire updatefound, so without this check the
    // banner never (re)appears and the user is stranded on the old version. This
    // fixes "refresh after banner → still old, banner gone, can't update".
    if (shouldShowBannerForWaiting(reg.waiting, !!navigator.serviceWorker.controller)) {
      newWorker = reg.waiting;   // capture stable ref for the click handler
      showBanner();
    }

    reg.addEventListener('updatefound', () => {
      newWorker = reg.installing;   // stable ref through installing→installed→waiting
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (shouldShowBanner(newWorker.state, !!navigator.serviceWorker.controller)) {
          showBanner();
        }
      });
    });

    // iOS survival: installed PWAs get suspended; force an update check on
    // foreground and hourly. Only checks when the tab is visible.
    const check = () => { if (document.visibilityState === 'visible') reg.update(); };
    document.addEventListener('visibilitychange', check);
    setInterval(check, 60 * 60 * 1000);
  }).catch(() => { /* SW registration failed — fail silently, app still works uncached */ });

  // Reload after the new SW activates. Two signals, whichever fires first once
  // activated — defensive because some engines (notably iOS Safari standalone)
  // drop statechange listeners on the waiting worker across the install→activate
  // transition, so we also listen on controllerchange with a short delay to let
  // activate's cache cleanup finish before the reload fetch.
  let reloaded = false;
  const reloadIfUpdate = () => {
    if (reloaded || !shouldReloadAfterUpdate(sawUpdate)) return;
    reloaded = true;
    window.location.reload();
  };

  // User taps Update → post SKIP_WAITING, then reload once the new SW activates.
  if (actionEl) {
    actionEl.addEventListener('click', () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        const waiting = (newWorker && newWorker.state !== 'activated') ? newWorker : (reg && reg.waiting);
        if (!waiting) return;
        waiting.addEventListener('statechange', () => {
          if (waiting.state === 'activated') reloadIfUpdate();
        });
        waiting.postMessage({ type: 'SKIP_WAITING' });
      });
    });
  }
  // Backstop: if the waiting worker's statechange to 'activated' is lost (iOS),
  // controllerchange still fires once the new SW claims clients. Delay slightly
  // so activate's cache cleanup (caches.delete old + new cache ready) resolves
  // before the reload fetch — otherwise the reload loads a half-swapped cache.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    setTimeout(reloadIfUpdate, 500);
  });
}
