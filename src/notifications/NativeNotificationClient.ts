import { apiFetch } from '../network/api';

interface NativeNotificationRegistration {
  supported: boolean;
  token: string | null;
  permission: 'granted' | 'denied' | 'prompt' | 'prompted' | 'unavailable';
}

export interface NativeNotificationSettings {
  supported: boolean;
  enabled: boolean;
  permission: NativeNotificationRegistration['permission'];
}

interface NativeNotificationPlugin {
  getRegistration(): Promise<NativeNotificationRegistration>;
  requestPermission(): Promise<NativeNotificationRegistration>;
  consumePendingNotification(): Promise<{ payload?: string }>;
  getSettings(): Promise<NativeNotificationSettings>;
  setEnabled(options: { enabled: boolean }): Promise<NativeNotificationSettings>;
}

export class NativeNotificationClient {
  public isAvailable(): boolean {
    return this.getPlugin() !== null;
  }

  public async getSettings(): Promise<NativeNotificationSettings | null> {
    const plugin = this.getPlugin();
    return plugin === null ? null : plugin.getSettings();
  }

  public async setEnabled(enabled: boolean): Promise<NativeNotificationSettings | null> {
    const plugin = this.getPlugin();
    if (plugin === null) return null;

    let settings = await plugin.setEnabled({ enabled });
    if (enabled && settings.permission !== 'granted') {
      await plugin.requestPermission();
      settings = await plugin.getSettings();
    }
    await this.sync();
    return settings;
  }

  public async requestPermission(): Promise<NativeNotificationSettings | null> {
    const plugin = this.getPlugin();
    if (plugin === null) return null;

    await plugin.requestPermission();
    const settings = await plugin.getSettings();
    await this.sync();
    return settings;
  }

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

    const registration = await plugin.getRegistration();

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
