const CACHE = 'calc-v6c';
const ASSETS = [
  './', './index.html', './styles.css',
  './js/app.js', './js/tokens.js', './js/state.js', './js/history.js',
  './js/engine.js', './js/lexer.js', './js/parser.js', './js/evaluator.js',
  './js/formatter.js', './js/keymap.js', './js/mathmenu.js',
  './manifest.webmanifest',
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
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
