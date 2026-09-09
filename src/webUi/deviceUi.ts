import {
  isPlaySolanaPsg1,
  AndroidDeviceProfile,
} from '../input/mobile/NativeAndroidGamepad';

/** Presentation only: do not change input bindings or gameplay based on this flag. */
export function isPsg1Ui(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.dataset.uiDevice === 'psg1'
  );
}

export function initializeDeviceUi(): void {
  // Keep the explicit preview available in deployed builds so PSG1 layouts can
  // be tested without the physical device. Hardware detection still enables
  // the same mode automatically on the console.
  const requestedPreview = new URLSearchParams(window.location.search).get(
    'ui',
  );
  const preview = requestedPreview === 'psg1';
  const androidPreview = requestedPreview === 'android';
  const update = (profile: AndroidDeviceProfile): void => {
    const next = preview || isPlaySolanaPsg1(profile) ? 'psg1' : 'standard';
    const platform = androidPreview || profile != null ? 'android' : 'web';
    const deviceChanged = document.documentElement.dataset.uiDevice !== next;
    const platformChanged =
      document.documentElement.dataset.uiPlatform !== platform;
    if (!deviceChanged && !platformChanged) return;
    document.documentElement.dataset.uiDevice = next;
    document.documentElement.dataset.uiPlatform = platform;
    window.dispatchEvent(new Event('battlecities:ui-device'));
  };
  window.addEventListener(
    'battlecities:android-device',
    (event: CustomEvent) => {
      update(event.detail as AndroidDeviceProfile);
    },
  );
  update((window as any).battleCitiesAndroidDevice);
}
