// sw.js — QueueMaster Service Worker
// Pure Web Push API (no Firebase). Place at ROOT of your site.

const CACHE_NAME = 'queuemaster-v2';

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
        data = {
            title: 'QueueMaster',
            body: event.data ? event.data.text() : 'Your queue position has updated.',
            type: 'generic'
        };
    }

    const type = data.type || 'generic';

    // ── Pick icon/badge/vibrate based on notification type ──────────────────
    const isYourTurn = type === 'immediate_call' || type === 'called';
    const isWarning  = type === 'warning';
    const isCanceled = type === 'canceled';

    const options = {
        body: data.body || 'Your queue position has updated.',
        icon: '/icon.png',
        badge: '/icon.png',
        // Distinct vibration sequences
        vibrate: isYourTurn ? [300, 100, 300, 100, 300] : 
                 isWarning  ? [500, 200, 500] : 
                 isCanceled ? [100, 50, 100] : [200, 100, 200],
        data: data.data || {},
        // Keep "your turn" and "warning" visible until the user taps them
        requireInteraction: isYourTurn || isWarning, 
        // Group notifications by type so they don't spam a dozen separate messages
        tag: isYourTurn ? 'qm-turn' : 
             isWarning  ? 'qm-warn' : 
             isCanceled ? 'qm-cancel' : 'qm-queued',
        renotify: true
    };

    const title = data.title || 'QueueMaster';

    event.waitUntil(
        self.registration.showNotification(title, options).then(() => {
            return self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        }).then(clients => {
            clients.forEach(client => client.postMessage({
                type: 'PLAY_NOTIFICATION_SOUND',
                notificationType: type   // lets the page play a different sound if needed
            }));
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
            clients.forEach(c => c.postMessage({
                type: 'PLAY_NOTIFICATION_SOUND',
                notificationType: event.data.notificationType
            }));
        });
    }
});