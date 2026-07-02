import {
  DeviceInputFrame,
  GamepadInputDevice,
  InputBinding,
  InputDevice,
  InputMethod,
  InputRecorderDevice,
  KeyboardInputDevice,
  MobileGamepadInputDevice,
  RecordedInputDevice,
} from '../core';
import { GameStorage } from '../game';
import * as config from '../config';

import {
  PrimaryGamepadInputBinding,
  PrimaryKeyboardInputBinding,
  SecondaryGamepadInputBinding,
  SecondaryKeyboardInputBinding,
  TertiaryKeyboardInputBinding,
} from './bindings';
import {
  GamepadButtonCodePresenter,
  KeyboardButtonCodePresenter,
} from './presenters';
import { InputBindingType } from './InputBindingType';
import { InputButtonCodePresenter } from './InputButtonCodePresenter';
import { InputControl } from './InputControl';
import { InputDeviceType } from './InputDeviceType';
import { InputVariant } from './InputVariant';
import { MobileGamepadHost } from './mobile';

export class InputManager {
  private deviceMap = new Map<InputDeviceType, InputDevice[]>();
  private bindings = new Map<InputBindingType, InputBinding>();
  private presenters = new Map<InputDeviceType, InputButtonCodePresenter>();
  private storage: GameStorage;
  private mobileGamepadHost = new MobileGamepadHost();
  // Active device is always the one last interacted with. Use it only for
  // single-player interactions. It might be helpful when user for example
  // was playing on keyboard and then started pressing buttons on gamepad -
  // in this case active device will switch from keyboard to gamepad
  // seamlessly.
  // For multi-player you should query player-specific devices.
  private activeDeviceType: InputDeviceType = null;
  // Pristine live devices, snapshotted once at construction so recording/
  // replay (which swap deviceMap entries for InputRecorderDevice/
  // RecordedInputDevice) can always be cleanly undone afterward.
  private liveDeviceMap = new Map<InputDeviceType, InputDevice[]>();
  private recording = false;
  private replaying = false;

  constructor(storage: GameStorage) {
    this.storage = storage;

    // Order by priority, first is default.
    // Assume that keyboard is only one, and that there might be multiple
    // gamepads.
    this.deviceMap.set(InputDeviceType.Keyboard, [new KeyboardInputDevice()]);
    this.deviceMap.set(InputDeviceType.Gamepad, [
      new GamepadInputDevice(0),
      new GamepadInputDevice(1),
    ]);
    this.deviceMap.set(InputDeviceType.MobileGamepad, [
      new MobileGamepadInputDevice(this.mobileGamepadHost, 0),
      new MobileGamepadInputDevice(this.mobileGamepadHost, 1),
    ]);

    this.deviceMap.forEach((devices, deviceType) => {
      this.liveDeviceMap.set(deviceType, devices.slice());
    });

    if (this.deviceMap.size > 0) {
      this.activeDeviceType = Array.from(this.deviceMap.keys())[0];
    }

    // Three keyboards are used to cover single-player and multi-player
    // (2 players) so if user plays alone he could have one binding, but
    // when he plays with somebody, he could have another binding without a
    // need to reconfigure his "alone" binding, and the second player gets
    // the third binding. It does not relate to gamepads, because they are
    // separate devices with their own buttons, but keyboard is shared.

    // Order by priority, first is default
    this.bindings.set(
      InputBindingType.PrimaryKeyboard,
      new PrimaryKeyboardInputBinding(),
    );
    this.bindings.set(
      InputBindingType.SecondaryKeyboard,
      new SecondaryKeyboardInputBinding(),
    );
    this.bindings.set(
      InputBindingType.TertiaryKeyboard,
      new TertiaryKeyboardInputBinding(),
    );
    this.bindings.set(
      InputBindingType.PrimaryGamepad,
      new PrimaryGamepadInputBinding(),
    );
    this.bindings.set(
      InputBindingType.SecondaryGamepad,
      new SecondaryGamepadInputBinding(),
    );
    this.bindings.set(
      InputBindingType.PrimaryMobileGamepad,
      new PrimaryGamepadInputBinding(),
    );
    this.bindings.set(
      InputBindingType.SecondaryMobileGamepad,
      new SecondaryGamepadInputBinding(),
    );

    this.presenters.set(
      InputDeviceType.Keyboard,
      new KeyboardButtonCodePresenter(),
    );
    this.presenters.set(
      InputDeviceType.Gamepad,
      new GamepadButtonCodePresenter(),
    );
    this.presenters.set(
      InputDeviceType.MobileGamepad,
      new GamepadButtonCodePresenter(),
    );
  }

  public getBinding(bindingType: InputBindingType): InputBinding {
    if (!this.bindings.has(bindingType)) {
      throw new Error(`Binding "${bindingType.serialize()}" not registered`);
    }

    const binding = this.bindings.get(bindingType);

    return binding;
  }

  public getDevice(deviceType: InputDeviceType, deviceIndex = 0): InputDevice {
    if (!this.deviceMap.has(deviceType)) {
      throw new Error(`Device type "${deviceType}" not registered`);
    }

    const devices = this.deviceMap.get(deviceType);

    const device = devices[deviceIndex];

    if (device === undefined) {
      throw new Error(
        `Device "${deviceType}" index "${deviceIndex}" not registered`,
      );
    }

    return device;
  }

  // Swaps the device at (deviceType, deviceIndex) for a different InputDevice
  // implementation and returns the one it replaced (so a caller can restore
  // it later). Used to wrap a device in an InputRecorderDevice to record a
  // match, or to substitute a RecordedInputDevice to replay one -- everything
  // downstream (bindings, InputMethod, behaviors) keeps working unchanged
  // since they only ever see the InputDevice interface.
  public replaceDevice(
    deviceType: InputDeviceType,
    deviceIndex: number,
    device: InputDevice,
  ): InputDevice {
    const devices = this.deviceMap.get(deviceType);

    if (devices === undefined) {
      throw new Error(`Device type "${deviceType}" not registered`);
    }

    const previousDevice = devices[deviceIndex];
    devices[deviceIndex] = device;

    return previousDevice;
  }

  // Wraps every registered device (keyboard, both gamepads, both mobile
  // gamepads) in an InputRecorderDevice, so a full match -- single or local
  // multiplayer -- is captured regardless of which device(s) end up driving
  // it. Recording every device (not just "the" active one) also means single-
  // player's mid-match device switching (see activeDeviceType) is captured
  // implicitly: replaying the same per-device logs reproduces the same
  // switches, since InputManager derives activeDeviceType from device
  // activity, not from a recorded decision.
  public startRecording(): void {
    if (this.recording || this.replaying) {
      return;
    }
    this.recording = true;

    this.deviceMap.forEach((devices) => {
      devices.forEach((device, index) => {
        devices[index] = new InputRecorderDevice(device);
      });
    });
  }

  public isRecording(): boolean {
    return this.recording;
  }

  // Stops recording, restores the live devices, and returns everything
  // captured -- keyed by "deviceType:deviceIndex" so it can be fed straight
  // into startReplay() later (or serialized to JSON as-is).
  public stopRecording(): Record<string, DeviceInputFrame[]> {
    if (!this.recording) {
      return {};
    }
    this.recording = false;

    const log: Record<string, DeviceInputFrame[]> = {};

    this.deviceMap.forEach((devices, deviceType) => {
      devices.forEach((device, index) => {
        if (device instanceof InputRecorderDevice) {
          log[this.getDeviceKey(deviceType, index)] = device.getLog();
        }
      });
    });

    this.restoreLiveDevices();

    return log;
  }

  // Substitutes every registered device for a RecordedInputDevice playing
  // back the matching entry of `log` (empty if that device produced nothing
  // in the original recording). Call inputManager.reset() right after, same
  // as at the start of a real match, so playback cursors line up with where
  // recording began.
  public startReplay(log: Record<string, DeviceInputFrame[]>): void {
    if (this.recording || this.replaying) {
      return;
    }
    this.replaying = true;

    this.deviceMap.forEach((devices, deviceType) => {
      devices.forEach((_device, index) => {
        const frames = log[this.getDeviceKey(deviceType, index)] ?? [];
        devices[index] = new RecordedInputDevice(frames);
      });
    });
  }

  public isReplaying(): boolean {
    return this.replaying;
  }

  public stopReplay(): void {
    if (!this.replaying) {
      return;
    }
    this.replaying = false;

    this.restoreLiveDevices();
  }

  private restoreLiveDevices(): void {
    this.liveDeviceMap.forEach((devices, deviceType) => {
      this.deviceMap.set(deviceType, devices.slice());
    });
  }

  private getDeviceKey(deviceType: InputDeviceType, deviceIndex: number): string {
    return `${deviceType}:${deviceIndex}`;
  }

  public getPresenter(deviceType: InputDeviceType): InputButtonCodePresenter {
    const presenter = this.presenters.get(deviceType);

    return presenter;
  }

  public getMobileGamepadHost(): MobileGamepadHost {
    return this.mobileGamepadHost;
  }

  public getMethodByVariant(variant: InputVariant): InputMethod {
    const device = this.getDevice(
      variant.bindingType.deviceType,
      variant.deviceIndex,
    );
    const binding = this.getBinding(variant.bindingType);

    // TODO: reuse class
    const method = new InputMethod(device, binding);

    return method;
  }

  public getActiveMethod(): InputMethod {
    const activeDevice = this.getActiveDevice();
    const activeBinding = this.getActiveBinding();

    // TODO: reuse class
    const method = new InputMethod(activeDevice, activeBinding);

    return method;
  }

  // Which device single-player input currently reads from (see the field's
  // own comment). Not part of any recorded replay log by itself -- a replay
  // must capture and restore this alongside the input frames, or single-
  // player's live device-switching behavior (see update() below) would start
  // from whatever device was last active in the menu, not what the original
  // recording actually started from.
  public getActiveDeviceType(): InputDeviceType {
    return this.activeDeviceType;
  }

  public setActiveDeviceType(deviceType: InputDeviceType): void {
    this.activeDeviceType = deviceType;
  }

  public getActiveDevice(): InputDevice {
    return this.getDevice(this.activeDeviceType);
  }

  // Find first binding that suits active device
  public getActiveBinding(): InputBinding {
    let foundBinding = null;

    this.bindings.forEach((binding, bindingType) => {
      // Null check tells if binding was already selected in prev iterations
      if (
        foundBinding === null &&
        bindingType.deviceType === this.activeDeviceType
      ) {
        foundBinding = binding;
      }
    });

    if (foundBinding === null) {
      throw new Error(
        `No binding registered for active device "${this.activeDeviceType}"`,
      );
    }

    return foundBinding;
  }

  // Find first binding type that suits active device
  public getActiveBindingType(): InputBindingType {
    let foundBindingType = null;

    this.bindings.forEach((binding, bindingType) => {
      // Null check tells if binding was already selected in prev iterations
      if (
        foundBindingType === null &&
        bindingType.deviceType === this.activeDeviceType
      ) {
        foundBindingType = bindingType;
      }
    });

    if (foundBindingType === null) {
      throw new Error(
        `No binding registered for active device "${this.activeDeviceType}"`,
      );
    }

    return foundBindingType;
  }

  public listen(): void {
    this.deviceMap.forEach((devices) => {
      for (const device of devices) {
        device.listen();
      }
    });
  }

  public unlisten(): void {
    this.deviceMap.forEach((devices) => {
      for (const device of devices) {
        device.unlisten();
      }
    });
  }

  public update(): void {
    const activeDevice = this.getActiveDevice();

    this.deviceMap.forEach((devices, deviceType) => {
      for (const device of devices) {
        device.update();

        // Check each device if it has any events. If it does and it is not an
        // active device - activate a new one.
        const downCodes = device.getDownCodes();
        const hasActivity = downCodes.length > 0;

        const isSameDeviceActive = activeDevice === device;

        if (hasActivity && !isSameDeviceActive) {
          this.activeDeviceType = deviceType;
        }
      }
    });
  }

  // Clear cached/held state on every device. Call when entering gameplay so a
  // key still "held" from a missed keyup or menu navigation can't make the
  // tank move on its own.
  public reset(): void {
    this.deviceMap.forEach((devices) => {
      for (const device of devices) {
        device.reset();
      }
    });
  }

  public loadAllBindings(): void {
    this.bindings.forEach((binding, bindingType) => {
      const key = this.getBindingStorageKey(bindingType);
      const json = this.storage.get(key);

      binding.fromJSON(json);
    });
  }

  public saveBinding(bindingType: InputBindingType): void {
    const binding = this.getBinding(bindingType);
    const key = this.getBindingStorageKey(bindingType);
    const json = binding.toJSON();

    this.storage.set(key, json);
    this.storage.save();
  }

  public getDisplayedControlCode(
    bindingType: InputBindingType,
    control: InputControl,
  ): string {
    const binding = this.getBinding(bindingType);
    const presenter = this.getPresenter(bindingType.deviceType);

    const code = binding.get(control);
    const displayedCode = presenter.asString(code);

    return displayedCode;
  }

  private getBindingStorageKey(bindingType: InputBindingType): string {
    const prefix = config.STORAGE_KEY_SETTINGS_INPUT_BINDINGS_PREFIX;

    const key = `${prefix}.${bindingType.serialize()}`;

    return key;
  }
}
