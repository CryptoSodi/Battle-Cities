export type HapticImpact = 'light' | 'medium' | 'heavy';

interface NativeHapticsPlugin {
  getStatus(): Promise<{ supported: boolean }>;
  impact(options: { style: HapticImpact }): Promise<void>;
  vibrate(options: { duration: number; amplitude?: number }): Promise<void>;
  playPattern(options: { pattern: number[] }): Promise<void>;
  cancel(): Promise<void>;
}

/**
 * Shared haptics gateway for Android and mobile browsers. Gameplay may call
 * this directly when it needs touch feedback without depending on native APIs.
 */
export class HapticsClient {
  public isAvailable(): boolean {
    return this.getNativePlugin() !== null || typeof navigator.vibrate === 'function';
  }

  public async impact(style: HapticImpact = 'medium'): Promise<void> {
    const plugin = this.getNativePlugin();
    if (plugin !== null) {
      await plugin.impact({ style });
      return;
    }

    const durations: Record<HapticImpact, number> = { light: 18, medium: 32, heavy: 55 };
    navigator.vibrate?.(durations[style]);
  }

  public async vibrate(duration = 40, amplitude?: number): Promise<void> {
    const safeDuration = Math.max(1, Math.min(10_000, Math.round(duration)));
    const plugin = this.getNativePlugin();
    if (plugin !== null) {
      await plugin.vibrate({ duration: safeDuration, amplitude });
      return;
    }

    navigator.vibrate?.(safeDuration);
  }

  public async playPattern(pattern: number[]): Promise<void> {
    const safePattern = pattern.map((duration) =>
      Math.max(0, Math.min(10_000, Math.round(duration))),
    );
    if (safePattern.length === 0) return;

    const plugin = this.getNativePlugin();
    if (plugin !== null) {
      await plugin.playPattern({ pattern: safePattern });
      return;
    }

    navigator.vibrate?.(safePattern);
  }

  public async cancel(): Promise<void> {
    const plugin = this.getNativePlugin();
    if (plugin !== null) {
      await plugin.cancel();
      return;
    }

    navigator.vibrate?.(0);
  }

  private getNativePlugin(): NativeHapticsPlugin | null {
    const capacitor = (window as any).Capacitor;
    if (capacitor?.getPlatform?.() !== 'android') return null;

    return (capacitor.Plugins?.BattleCitiesHaptics as NativeHapticsPlugin | undefined) ?? null;
  }
}

export const haptics = new HapticsClient();
