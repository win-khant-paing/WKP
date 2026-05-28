// sw.js — QueueMaster Service Worker
// Pure Web Push API (no Firebase). Place at ROOT of your site.

const CACHE_NAME = 'queuemaster-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// ── Native Web Push: fired when a push arrives in background ──────────────────
self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { title: 'QueueMaster', body: event.data ? event.data.text() : 'Your queue position has updated.' };
    }

    const title = data.title || 'QueueMaster';
    const options = {
        body: data.body || 'Your queue position has updated.',
        icon: '/icon.png',
        badge: '/icon.png',
        vibrate: [200, 100, 200],
        data: data.data || {},
        requireInteraction: false,
        tag: 'queuemaster-notification' // Replaces previous notification instead of stacking
    };

    event.waitUntil(
        self.registration.showNotification(title, options).then(() => {
            // Notify any open windows to play a sound
            return self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        }).then(clients => {
            clients.forEach(client => client.postMessage({ type: 'PLAY_NOTIFICATION_SOUND' }));
        })
    );
});

// ── Notification click: focus or open the app ────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
            const focused = clients.find(c => c.url && c.visibilityState === 'visible');
            if (focused) return focused.focus();
            if (clients.length > 0) return clients[0].focus();
            return self.clients.openWindow('/');
        })
    );
});

// ── Message relay (e.g. foreground sound requests) ───────────────────────────
self.addEventListener('message', (event) => {
    if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
        self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
            clients.forEach(c => c.postMessage({ type: 'PLAY_NOTIFICATION_SOUND' }));
        });
    }
});