import { API_BASE_URL } from '../config';

export async function setupWebPush(userId: string) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Web Push is not supported in this browser.');
        return;
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js');

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            console.log('No Web Push subscription found, subscribing...');
            const serverUrl = API_BASE_URL.replace(/\/$/, '');
            const response = await fetch(`${serverUrl}/api/push/vapidPublicKey`);
            const { publicKey } = await response.json();

            const convertedVapidKey = urlBase64ToUint8Array(publicKey);

            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            await fetch(`${serverUrl}/api/push/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, subscription })
            });

            console.log('✅ Successfully subscribed to Web Push');
        } else {
            console.log('✅ Already subscribed to Web Push');
        }
    } catch (err) {
        console.error('Failed to setup Web Push', err);
    }
}

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
