self.addEventListener('push', function (event) {
    if (event.data) {
        let data = {};
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'Nyx', type: 'text', chatId: '' };
        }

        const options = {
            body: 'Новое зашифрованное сообщение',
            icon: '/logo.png',
            badge: '/logo.png',
            data: {
                chatId: data.chatId
            }
        };

        if (data.type === 'image') options.body = '📷 Прислал(а) фото';
        else if (data.type === 'video') options.body = '🎬 Прислал(а) видео';
        else if (data.type === 'audio') options.body = '🎤 Голосовое сообщение';
        else if (data.type === 'file') options.body = '📎 Прислал(а) файл';
        else if (data.type === 'sticker') options.body = '✨ Стикер';

        event.waitUntil(
            self.registration.showNotification(data.title || 'Nyx', options)
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    // Open the app and focus the chat
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            const url = '/';
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    // We can attempt to message the client here
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
