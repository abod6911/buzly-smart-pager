// Service Worker for Chimer Smart Restaurant Pager
// Handles Background Web Push Notifications & Screen Wake Actions

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = {
        title: 'Chimer | طلبك جاهز!',
        body: event.data.text(),
      };
    }
  }

  const title = data.title || 'طلبك جاهز للاستلام';
  const orderNumber = data.orderNumber || '';
  const targetUrl = data.url || (orderNumber ? `/track/${encodeURIComponent(orderNumber)}` : '/track');

  const options = {
    body: data.body || 'تفضل بالتوجه إلى الكاونتر لاستلام وجبتك وهي ساخنة ولذيذة.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `chimer-order-${orderNumber || 'ready'}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [500, 200, 500, 200, 800, 300, 800],
    data: {
      url: targetUrl,
      orderNumber: orderNumber,
      timestamp: Date.now(),
    },
    actions: [
      { action: 'open', title: 'عرض الطلب' },
      { action: 'dismiss', title: 'إغلاق' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/track';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if ('focus' in client && client.url.includes(targetUrl)) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
