// Browser Permissions, Screen WakeLock, and Web Notification Helper for Buzly

export interface ActivationStatus {
  wakeLockActive: boolean;
  notificationPermission: NotificationPermission | 'unsupported';
  audioUnlocked: boolean;
  isIOS: boolean;
}

class PwaHelper {
  private wakeLockSentinel: WakeLockSentinel | null = null;

  public isIOS(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
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

  public async acquireWakeLock(): Promise<boolean> {
    if (typeof window === 'undefined' || !('wakeLock' in navigator)) {
      return false;
    }
    try {
      this.wakeLockSentinel = await navigator.wakeLock.request('screen');

      this.wakeLockSentinel.addEventListener('release', () => {
        this.wakeLockSentinel = null;
      });

      // Auto-reacquire if document becomes visible again
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

  public showSystemNotification(title: string, options?: NotificationOptions): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
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
