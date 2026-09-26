// Notificaciones push. Workbox lo carga dentro del service worker (importScripts en vite.config.ts).

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Mi cuatri', {
      body: data.body || '',
      tag: data.tag,
      icon: 'pwa-192x192.png',
      badge: 'pwa-64x64.png',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of windows) if ('focus' in w) return w.focus();
      return self.clients.openWindow(self.registration.scope);
    })(),
  );
});
