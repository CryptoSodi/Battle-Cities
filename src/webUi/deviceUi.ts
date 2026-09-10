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

/** Physical-console behavior is not implied by the medium browser layout. */
export function isPsg1Controls(): boolean {
  return isPsg1Ui() && document.documentElement.dataset.uiResponsive !== 'true';
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
  const compactViewport = window.matchMedia('(max-width: 899px)');
  const mediumViewport = window.matchMedia('(min-width: 900px) and (max-width: 1279px)');
  let deviceProfile = (window as Window & {
    battleCitiesAndroidDevice?: AndroidDeviceProfile;
  }).battleCitiesAndroidDevice;
  const update = (profile: AndroidDeviceProfile): void => {
    deviceProfile = profile;
    const responsive = !preview && !androidPreview && profile == null && mediumViewport.matches;
    const next = preview || isPlaySolanaPsg1(profile) || responsive ? 'psg1' : 'standard';
    // uiPlatform selects presentation assets, not the runtime/input platform.
    // Compact browser windows use the same home screen as Android phones.
    const platform = androidPreview || profile != null ||
      (!preview && compactViewport.matches) ? 'android' : 'web';
    const deviceChanged = document.documentElement.dataset.uiDevice !== next;
    const platformChanged =
      document.documentElement.dataset.uiPlatform !== platform;
    const responsiveChanged = document.documentElement.dataset.uiResponsive !== String(responsive);
    const native = profile != null;
    const nativeChanged = document.documentElement.dataset.uiNative !== String(native);
    if (!deviceChanged && !platformChanged && !responsiveChanged && !nativeChanged) return;
    document.documentElement.dataset.uiDevice = next;
    document.documentElement.dataset.uiPlatform = platform;
    document.documentElement.dataset.uiResponsive = String(responsive);
    document.documentElement.dataset.uiNative = String(native);
    window.dispatchEvent(new Event('battlecities:ui-device'));
  };
  window.addEventListener(
    'battlecities:android-device',
    (event: CustomEvent) => {
      update(event.detail as AndroidDeviceProfile);
    },
  );
  compactViewport.addEventListener('change', () => update(deviceProfile));
  mediumViewport.addEventListener('change', () => update(deviceProfile));
  update(deviceProfile);
}
