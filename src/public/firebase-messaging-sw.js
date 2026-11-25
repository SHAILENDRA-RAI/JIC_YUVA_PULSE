/* Firebase Cloud Messaging service worker for JIC YUVA PULSE.
   Keep this file at the GitHub Pages app root: /JIC_YUVA_PULSE/. */
importScripts('https://www.gstatic.com/firebasejs/13.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.4.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAGtio92y3HTOCOnsl7tX6jQmEKJ-a2HNo',
  authDomain: 'jic-yuva-pulse.firebaseapp.com',
  projectId: 'jic-yuva-pulse',
  storageBucket: 'jic-yuva-pulse.firebasestorage.app',
  messagingSenderId: '665881373304',
  appId: '1:665881373304:web:62a07be894eba0bd87db8d',
  measurementId: 'G-N9TX06ERDH',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = data.title || 'JIC YUVA PULSE';
  const body = data.body || 'You have a new workspace notification.';
  const appRoot = self.registration.scope;

  self.registration.showNotification(title, {
    body,
    icon: new URL('icons/icon-192.png', appRoot).href,
    badge: new URL('icons/icon-192.png', appRoot).href,
    tag: data.notificationId || 'jic-yuva-pulse-notification',
    data: {
      url: data.url || new URL('#/notifications', appRoot).href,
    },
    vibrate: [120, 60, 120],
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || new URL('#/notifications', self.registration.scope).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(targetUrl);
        return;
      }
    }
    await self.clients.openWindow(targetUrl);
  })());
});
