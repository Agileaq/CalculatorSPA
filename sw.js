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
