/* Aventura de almas — service worker: recibe los avisos push y abre el juego al tocarlos */
/* Copia de la app para poder abrirla y jugar sin conexión (v1.56). Con red va primero lo más nuevo;
   si la red no responde en 4 s (poca señal) se usa la copia guardada. */
const CACHE = 'ada-app-v1';
const SHELL = ['/', '/shared.js', '/botchat.js', '/engine.js', '/local.js', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map(u => fetch(u, { cache: 'no-cache' }).then(r => { if (r.ok) return c.put(u, r); }).catch(() => {})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('ada-app-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/health' || url.pathname === '/sw.js') return;
  const key = req.mode === 'navigate' || url.pathname === '/index.html' ? '/' : url.pathname;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const net = fetch(req).then(r => { if (r && r.ok && (SHELL.includes(key))) c.put(key, r.clone()); return r; });
    try {
      const cached = await c.match(key);
      if (!cached) return await net;
      return await Promise.race([net, new Promise((_, rej) => setTimeout(rej, 4000))]);
    } catch (err) {
      return (await c.match(key)) || Response.error();
    }
  })());
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Aventura de almas', body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const ios = /iPhone|iPad|iPod/.test(self.navigator.userAgent);
    // si la persona ya está mirando el juego no hace falta molestarla (en iOS siempre se muestra: Apple lo exige)
    if (!ios && wins.some(w => w.visibilityState === 'visible' && w.focused)) return;
    await self.registration.showNotification(d.title || 'Aventura de almas', {
      body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag,
      icon: '/icon-192.png', badge: '/icon-192.png', data: { url: d.url || '/' },
    });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) { if ('focus' in w) { await w.focus(); return; } }
    await self.clients.openWindow((e.notification.data && e.notification.data.url) || '/');
  })());
});
