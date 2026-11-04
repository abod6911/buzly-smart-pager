// Browser Permissions, Service Worker, Web Push, and Screen WakeLock for Buzly

export const DEFAULT_VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BPEhFElgcbeGL_YQ4svRzW5n174EW1MZL2rrTGD6IrrfuEB4qlp-gnHt2LA821tuRbU6Mlrd1JHvYAo2isHrl10';

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

class PwaHelper {
  private wakeLockSentinel: WakeLockSentinel | null = null;
  private swRegistration: ServiceWorkerRegistration | null = null;

  public isIOS(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent;
    return (
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  }

  public isStandalonePWA(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone)
    );
  }

  /**
   * Registers the Service Worker (/sw.js)
   */
  public async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }

    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      this.swRegistration = reg;
      return reg;
    } catch (err) {
      console.warn('Service Worker registration failed:', err);
      return null;
    }
  }

  public getNotificationPermission(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  public async requestNotification(): Promise<NotificationPermission | 'unsupported'> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch {
      return Notification.permission;
    }
  }

  /**
   * Subscribes the device to Web Push API using VAPID
   */
  public async subscribeToWebPush(
    vapidKey: string = DEFAULT_VAPID_PUBLIC_KEY
  ): Promise<PushSubscription | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return null;
    }

    try {
      const reg = this.swRegistration || (await this.registerServiceWorker());
      if (!reg) return null;

      // Check if already subscribed
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        const applicationServerKey = urlBase64ToUint8Array(vapidKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        });
      }

      return sub;
    } catch (err) {
      console.warn('Web Push subscription failed:', err);
      return null;
    }
  }

  /**
   * Screen Wake Lock API to prevent screen dimming
   */
  public async acquireWakeLock(): Promise<boolean> {
    if (typeof window === 'undefined' || !('wakeLock' in navigator)) {
      return false;
    }
    try {
      this.wakeLockSentinel = await navigator.wakeLock.request('screen');

      this.wakeLockSentinel.addEventListener('release', () => {
        this.wakeLockSentinel = null;
      });

      // Auto-reacquire when returning to the tab
      document.addEventListener('visibilitychange', async () => {
        if (this.wakeLockSentinel === null && document.visibilityState === 'visible') {
          try {
            this.wakeLockSentinel = await navigator.wakeLock.request('screen');
          } catch {
            // Ignore
          }
        }
      });

      return true;
    } catch {
      return false;
    }
  }

  public releaseWakeLock(): void {
    if (this.wakeLockSentinel) {
      this.wakeLockSentinel.release().catch(() => {});
      this.wakeLockSentinel = null;
    }
  }

  /**
   * Fires a fallback in-tab/system notification
   */
  public showSystemNotification(title: string, options?: NotificationOptions): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      if (this.swRegistration && 'showNotification' in this.swRegistration) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.swRegistration as any).showNotification(title, {
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'buzly-order-ready',
          requireInteraction: true,
          vibrate: [500, 200, 500, 200, 800],
          ...options,
        });
        return;
      }

      const notification = new Notification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'buzly-order-ready',
        requireInteraction: true,
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (err) {
      console.warn('Notification trigger error:', err);
    }
  }
}

export const pwaHelper = new PwaHelper();
