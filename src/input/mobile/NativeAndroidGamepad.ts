import { InputControl } from '../InputControl';

type NativeGamepadEventType = 'button' | 'axes' | 'reset';

export interface NativeGamepadAxes {
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
  hatX: number;
  hatY: number;
  leftTrigger: number;
  rightTrigger: number;
}

export interface NativeGamepadEventDetail {
  type: NativeGamepadEventType;
  control?: string;
  pressed?: boolean;
  keyCode?: number;
  axes?: NativeGamepadAxes;
}

export interface AndroidDeviceProfile {
  deviceId: string;
  manufacturer: string;
  brand: string;
  model: string;
  device: string;
  product: string;
  osRelease: string;
  sdkVersion: number;
}

function normalizeDeviceValue(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function isSolanaSeeker(
  profile: AndroidDeviceProfile,
): boolean {
  if (profile === null || profile === undefined) {
    return false;
  }

  return normalizeDeviceValue(profile.model) === 'seeker';
}

export function isPlaySolanaPsg1(
  profile: AndroidDeviceProfile,
): boolean {
  if (profile === null || profile === undefined) {
    return false;
  }

  const model = normalizeDeviceValue(profile.model);
  const device = normalizeDeviceValue(profile.device);
  const product = normalizeDeviceValue(profile.product);
  const manufacturer = normalizeDeviceValue(profile.manufacturer);
  const brand = normalizeDeviceValue(profile.brand);
  const hasPsg1Identity = [model, device, product].some(
    (value) => value === 'psg1' || value === 'playsolanagen1',
  );
  const isPlaySolanaBrand = [manufacturer, brand].some(
    (value) => value === 'playsolana' || value === 'playsolanaecosystem',
  );

  return hasPsg1Identity || (isPlaySolanaBrand && model.indexOf('gen1') !== -1);
}

export class NativeAndroidGamepad {
  private static readonly AXIS_THRESHOLD = 0.45;

  private buttons: { [control: string]: boolean } = {};
  private axes: NativeGamepadAxes = this.emptyAxes();
  private mappedControls: { [control: number]: boolean } = {};
  private deviceProfile: AndroidDeviceProfile = null;
  private deviceProfilePromise: Promise<void> = null;
  private listening = false;

  constructor(
    private setControlPressed: (
      control: InputControl,
      pressed: boolean,
    ) => void,
  ) {}

  public listen(): void {
    if (this.listening) {
      return;
    }
    window.addEventListener(
      'battlecities:native-gamepad',
      this.handleNativeEvent as EventListener,
    );
    this.listening = true;
    this.deviceProfilePromise = this.loadDeviceProfile();
  }

  public unlisten(): void {
    if (!this.listening) {
      return;
    }
    window.removeEventListener(
      'battlecities:native-gamepad',
      this.handleNativeEvent as EventListener,
    );
    this.reset();
    this.listening = false;
  }

  public isButtonPressed(control: string): boolean {
    return this.buttons[control] === true;
  }

  public getAxes(): NativeGamepadAxes {
    return { ...this.axes };
  }

  public getDeviceProfile(): AndroidDeviceProfile {
    return this.deviceProfile === null ? null : { ...this.deviceProfile };
  }

  public async waitForDeviceProfile(): Promise<AndroidDeviceProfile> {
    if (this.deviceProfilePromise === null) {
      this.deviceProfilePromise = this.loadDeviceProfile();
    }
    await this.deviceProfilePromise;
    return this.getDeviceProfile();
  }

  private handleNativeEvent = (event: CustomEvent): void => {
    const detail = event.detail as NativeGamepadEventDetail;
    if (detail === undefined || detail === null) {
      return;
    }

    if (detail.type === 'reset') {
      this.reset();
      return;
    }

    if (detail.type === 'button' && detail.control !== undefined) {
      const control = this.normalizePhysicalButton(detail.control);
      this.buttons[control] = detail.pressed === true;
    } else if (detail.type === 'axes' && detail.axes !== undefined) {
      this.axes = detail.axes;
    }

    this.syncMappedControls();
  };

  private syncMappedControls(): void {
    const threshold = NativeAndroidGamepad.AXIS_THRESHOLD;
    this.setMappedControl(
      InputControl.Up,
      this.isButtonPressed('dpad_up') ||
        this.axes.leftY < -threshold ||
        this.axes.hatY < -threshold,
    );
    this.setMappedControl(
      InputControl.Down,
      this.isButtonPressed('dpad_down') ||
        this.axes.leftY > threshold ||
        this.axes.hatY > threshold,
    );
    this.setMappedControl(
      InputControl.Left,
      this.isButtonPressed('dpad_left') ||
        this.axes.leftX < -threshold ||
        this.axes.hatX < -threshold,
    );
    this.setMappedControl(
      InputControl.Right,
      this.isButtonPressed('dpad_right') ||
        this.axes.leftX > threshold ||
        this.axes.hatX > threshold,
    );
    this.setMappedControl(InputControl.PrimaryAction, this.isButtonPressed('a'));
    this.setMappedControl(
      InputControl.SecondaryAction,
      this.isButtonPressed('b'),
    );
    this.setMappedControl(
      InputControl.Select,
      this.isButtonPressed('start') || this.isButtonPressed('menu'),
    );
    const psg1 = isPlaySolanaPsg1(this.deviceProfile);
    const rightStickHorizontal =
      Math.abs(this.axes.rightX) >= Math.abs(this.axes.rightY);
    this.setMappedControl(
      InputControl.PowerOne,
      psg1 && rightStickHorizontal && this.axes.rightX > threshold,
    );
    this.setMappedControl(
      InputControl.PowerTwo,
      psg1 && !rightStickHorizontal && this.axes.rightY < -threshold,
    );
    this.setMappedControl(
      InputControl.PowerThree,
      psg1 && !rightStickHorizontal && this.axes.rightY > threshold,
    );
    this.setMappedControl(
      InputControl.PowerFour,
      psg1 && rightStickHorizontal && this.axes.rightX < -threshold,
    );
  }

  private setMappedControl(control: InputControl, pressed: boolean): void {
    if (this.mappedControls[control] === pressed) {
      return;
    }
    this.mappedControls[control] = pressed;
    this.setControlPressed(control, pressed);
  }

  private reset(): void {
    this.buttons = {};
    this.axes = this.emptyAxes();
    Object.keys(this.mappedControls).forEach((control) => {
      this.setControlPressed(Number(control) as InputControl, false);
    });
    this.mappedControls = {};
  }

  private emptyAxes(): NativeGamepadAxes {
    return {
      leftX: 0,
      leftY: 0,
      rightX: 0,
      rightY: 0,
      hatX: 0,
      hatY: 0,
      leftTrigger: 0,
      rightTrigger: 0,
    };
  }

  private async loadDeviceProfile(): Promise<void> {
    const plugin = (window as any).Capacitor?.Plugins?.AndroidDevice;
    if (plugin === undefined) {
      return;
    }

    try {
      const profile = (await plugin.getInfo()) as AndroidDeviceProfile;
      this.updateDeviceProfile(profile);
    } catch {
      // Native device metadata is optional outside the Android wrapper.
    }
  }

  private updateDeviceProfile(profile: AndroidDeviceProfile): void {
    this.deviceProfile = profile;
    this.syncMappedControls();
    (window as any).battleCitiesAndroidDevice = { ...profile };
    window.dispatchEvent(
      new CustomEvent('battlecities:android-device', {
        detail: { ...profile },
      }),
    );
  }

  private normalizePhysicalButton(control: string): string {
    return control.indexOf('button_') === 0 ? control.slice(7) : control;
  }
}
