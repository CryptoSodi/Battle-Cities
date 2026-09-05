import { isPlaySolanaPsg1, AndroidDeviceProfile } from '../input/mobile/NativeAndroidGamepad';

/** Presentation only: do not change input bindings or gameplay based on this flag. */
export function isPsg1Ui(): boolean {
  return typeof document !== 'undefined' &&
    document.documentElement.dataset.uiDevice === 'psg1';
}

export function initializeDeviceUi(): void {
  // Keep the explicit preview available in deployed builds so PSG1 layouts can
  // be tested without the physical device. Hardware detection still enables
  // the same mode automatically on the console.
  const preview = new URLSearchParams(window.location.search).get('ui') ===
    'psg1';
  const update = (profile: AndroidDeviceProfile): void => {
    const next = preview || isPlaySolanaPsg1(profile) ? 'psg1' : 'standard';
    if (document.documentElement.dataset.uiDevice === next) return;
    document.documentElement.dataset.uiDevice = next;
    window.dispatchEvent(new Event('battlecities:ui-device'));
  };
  window.addEventListener('battlecities:android-device', (event: CustomEvent) => {
    update(event.detail as AndroidDeviceProfile);
  });
  update((window as any).battleCitiesAndroidDevice);
}
