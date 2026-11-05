/* Aventura de almas — service worker: recibe los avisos push y abre el juego al tocarlos */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

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
