import { supabase } from '@/lib/supabase';

interface FirebasePushPayload {
  notification?: { title?: string; body?: string };
  data?: Record<string, string>;
}

interface FirebaseMessagingCompat {
  getToken(options: {
    vapidKey: string;
    serviceWorkerRegistration: ServiceWorkerRegistration;
  }): Promise<string>;
  onMessage(callback: (payload: FirebasePushPayload) => void): () => void;
}

interface FirebaseCompatSdk {
  apps: unknown[];
  initializeApp(config: Record<string, string>): unknown;
  messaging: (() => FirebaseMessagingCompat) & { isSupported(): Promise<boolean> };
}

declare global {
  interface Window {
    firebase?: FirebaseCompatSdk;
  }
}

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAGtio92y3HTOCOnsl7tX6jQmEKJ-a2HNo',
  authDomain: 'jic-yuva-pulse.firebaseapp.com',
  projectId: 'jic-yuva-pulse',
  storageBucket: 'jic-yuva-pulse.firebasestorage.app',
  messagingSenderId: '665881373304',
  appId: '1:665881373304:web:62a07be894eba0bd87db8d',
  measurementId: 'G-N9TX06ERDH',
};

const VAPID_PUBLIC_KEY = 'BKt-uqJCCzoVn9FSv8E8NgnYQx8hkKzf4x-Na0TijFQ7BRLYrl1o1TlwvlDEVmdq_j4rVzx1138J5iCBhbe-g94';

function getFirebaseSdk(): FirebaseCompatSdk {
  if (!window.firebase) {
    throw new Error('Firebase Messaging did not load. Refresh the page and try again.');
  }

  if (window.firebase.apps.length === 0) {
    window.firebase.initializeApp(FIREBASE_CONFIG);
  }

  return window.firebase;
}

export function isFirebasePushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && Boolean(window.firebase?.messaging);
}

export function getPushDeviceLabel(): string {
  return typeof navigator === 'undefined' ? 'Unknown browser' : navigator.userAgent.slice(0, 240);
}

export async function enableFirebasePushForDevice(): Promise<{
  token: string;
  registration: ServiceWorkerRegistration;
  messaging: FirebaseMessagingCompat;
}> {
  if (!isFirebasePushSupported()) {
    throw new Error('This browser does not support web push notifications. Use Chrome on Android.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Notifications are blocked for this site. Allow them in Chrome site settings, then try again.'
      : 'Notification permission was not granted.');
  }

  const baseUrl = import.meta.env.BASE_URL || '/';
  const workerUrl = `${baseUrl.replace(/\/?$/, '/') }firebase-messaging-sw.js`;
  const registration = await navigator.serviceWorker.register(workerUrl, {
    scope: baseUrl,
    updateViaCache: 'none',
  });
  await navigator.serviceWorker.ready;

  const sdk = getFirebaseSdk();
  const supported = await sdk.messaging.isSupported();
  if (!supported) {
    throw new Error('Firebase push messaging is not supported in this browser.');
  }

  const messaging = sdk.messaging();
  const token = await messaging.getToken({
    vapidKey: VAPID_PUBLIC_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!token) throw new Error('Firebase did not return a device registration token.');
  return { token, registration, messaging };
}

export async function savePushDeviceRegistration(userId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      fcm_token: token,
      device_label: getPushDeviceLabel(),
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,fcm_token' });

  if (error) {
    throw new Error(`Device registration could not be saved: ${error.message}`);
  }
}

export function listenForForegroundPush(
  messaging: FirebaseMessagingCompat,
  registration: ServiceWorkerRegistration,
): () => void {
  return messaging.onMessage((payload) => {
    const title = payload.data?.title || payload.notification?.title || 'JIC YUVA PULSE';
    const body = payload.data?.body || payload.notification?.body || 'You have a new workspace notification.';
    const appRoot = registration.scope;
    void registration.showNotification(title, {
      body,
      icon: new URL('icons/icon-192.png', appRoot).href,
      badge: new URL('icons/icon-192.png', appRoot).href,
      tag: payload.data?.notificationId || 'jic-yuva-pulse-notification',
      data: { url: payload.data?.url || new URL('#/notifications', appRoot).href },
    });
  });
}
