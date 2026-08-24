import { apiFetch } from '../network/api';

interface NativeNotificationRegistration {
  supported: boolean;
  token: string | null;
  permission: 'granted' | 'denied' | 'prompt' | 'prompted' | 'unavailable';
}

interface NativeNotificationPlugin {
  getRegistration(): Promise<NativeNotificationRegistration>;
  requestPermission(): Promise<NativeNotificationRegistration>;
  consumePendingNotification(): Promise<{ payload?: string }>;
}

export class NativeNotificationClient {
  public async consumePendingNotification(): Promise<void> {
    const plugin = this.getPlugin();
    if (plugin === null) return;
    const result = await plugin.consumePendingNotification();
    if (typeof result?.payload !== 'string' || result.payload === '') return;
    try {
      const detail = JSON.parse(result.payload);
      if (typeof detail?.route === 'string') {
        window.dispatchEvent(new CustomEvent('battlecities:notification', { detail }));
      }
    } catch {
      // Ignore an invalid native payload rather than interrupting app startup.
    }
  }
  public async sync(): Promise<void> {
    const plugin = this.getPlugin();
    if (plugin === null) {
      return;
    }

    let registration = await plugin.getRegistration();
    if (registration.permission === 'prompt') {
      await plugin.requestPermission();
      registration = await plugin.getRegistration();
    }

    if (!registration.supported || registration.token === null) {
      return;
    }

    await apiFetch('/api/notifications/devices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: registration.token,
        platform: 'android',
        permission: registration.permission,
      }),
    });
  }

  private getPlugin(): NativeNotificationPlugin | null {
    const capacitor = (window as any).Capacitor;
    if (capacitor?.getPlatform?.() !== 'android') {
      return null;
    }

    return (capacitor.Plugins?.BattleCitiesNotifications as NativeNotificationPlugin | undefined) ?? null;
  }
}
