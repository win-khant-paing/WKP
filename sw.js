cat > /home/claude/sw.js << 'SWEOF'
// sw.js — QueueMaster Service Worker v4
// Pure Web Push API (no Firebase). Place at ROOT of your site.

const CACHE_NAME = 'queuemaster-v4';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ── Notification configs per type ──────────────────────────────────────────
function getNotifOptions(type, body) {
    const base = { body, icon: '/icon.png', badge: '/icon.png', renotify: true };

    switch (type) {
        case 'token_confirmed':
            return { ...base,
                vibrate: [150, 80, 150],
                tag: 'qm-confirmed',
                requireInteraction: false,
                actions: [{ action: 'open', title: '📱 View Token' }]
            };
        case 'almost_turn':
            return { ...base,
                vibrate: [200, 100, 200, 100, 200],
                tag: 'qm-almost',
                requireInteraction: false,
                actions: [{ action: 'open', title: '🚶 Get Ready' }]
            };
        case 'called':
        case 'immediate_call':
            return { ...base,
                vibrate: [300, 100, 300, 100, 300, 100, 300],
                tag: 'qm-turn',
                requireInteraction: true,   // stays until tapped
                actions: [{ action: 'open', title: '🏃 Go to Counter Now' }]
            };
        case 'warning':
            return { ...base,
                vibrate: [500, 150, 500, 150, 500, 150, 500],
                tag: 'qm-warn',
                requireInteraction: true,
                actions: [
                    { action: 'open',   title: '🏃 I\'m Coming!' },
                    { action: 'ignore', title: '✕ Cancel Token'  }
                ]
            };
        case 'canceled':
            return { ...base,
                vibrate: [100, 60, 100, 60, 100],
                tag: 'qm-cancel',
                requireInteraction: false,
                actions: [{ action: 'open', title: '🎫 Get New Token' }]
            };
        default:
            return { ...base, vibrate: [150], tag: 'qm-generic' };
    }
}

// ── Push handler — works in ALL states (foreground, background, closed) ────
self.addEventListener('push', event => {
    let data = {};
    try   { data = event.data ? event.data.json() : {}; }
    catch { data = { title: 'QueueMaster', body: event.data?.text() || 'Queue update.', type: 'generic' }; }

    const type    = data.type  || 'generic';
    const title   = data.title || 'QueueMaster';
    const options = getNotifOptions(type, data.body || '');

    event.waitUntil(
        self.registration.showNotification(title, options)
            .then(() => self.clients.matchAll({ includeUncontrolled: true, type: 'window' }))
            .then(clients => clients.forEach(c => c.postMessage({ type: 'PLAY_NOTIFICATION_SOUND', notificationType: type })))
    );
});

// ── Notification click ─────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();
    // Both 'open' action and clicking the notification body focus/open the app
    if (event.action === 'ignore') return; // user chose to dismiss

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
            const visible = clients.find(c => c.visibilityState === 'visible');
            if (visible) return visible.focus();
            if (clients.length) return clients[0].focus();
            return self.clients.openWindow('/');
        })
    );
});

// ── Message relay (foreground sound trigger from page) ─────────────────────
self.addEventListener('message', event => {
    if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
        self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients =>
            clients.forEach(c => c.postMessage({ type: 'PLAY_NOTIFICATION_SOUND', notificationType: event.data.notificationType }))
        );
    }
});
SWEOF
