"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputManager = void 0;
const core_1 = require("../core");
const config = __importStar(require("../config"));
const bindings_1 = require("./bindings");
const presenters_1 = require("./presenters");
const InputBindingType_1 = require("./InputBindingType");
const InputDeviceType_1 = require("./InputDeviceType");
const mobile_1 = require("./mobile");
class InputManager {
    constructor(storage) {
        this.deviceMap = new Map();
        this.bindings = new Map();
        this.presenters = new Map();
        this.mobileGamepadHost = new mobile_1.MobileGamepadHost();
        // Active device is always the one last interacted with. Use it only for
        // single-player interactions. It might be helpful when user for example
        // was playing on keyboard and then started pressing buttons on gamepad -
        // in this case active device will switch from keyboard to gamepad
        // seamlessly.
        // For multi-player you should query player-specific devices.
        this.activeDeviceType = null;
        // Pristine live devices, snapshotted once at construction so recording/
        // replay (which swap deviceMap entries for InputRecorderDevice/
        // RecordedInputDevice) can always be cleanly undone afterward.
        this.liveDeviceMap = new Map();
        this.recording = false;
        this.replaying = false;
        this.storage = storage;
        // Order by priority, first is default.
        // Assume that keyboard is only one, and that there might be multiple
        // gamepads.
        this.deviceMap.set(InputDeviceType_1.InputDeviceType.Keyboard, [new core_1.KeyboardInputDevice()]);
        this.deviceMap.set(InputDeviceType_1.InputDeviceType.Gamepad, [
            new core_1.GamepadInputDevice(0),
            new core_1.GamepadInputDevice(1),
        ]);
        this.deviceMap.set(InputDeviceType_1.InputDeviceType.MobileGamepad, [
            new core_1.MobileGamepadInputDevice(this.mobileGamepadHost, 0),
            new core_1.MobileGamepadInputDevice(this.mobileGamepadHost, 1),
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
        this.bindings.set(InputBindingType_1.InputBindingType.PrimaryKeyboard, new bindings_1.PrimaryKeyboardInputBinding());
        this.bindings.set(InputBindingType_1.InputBindingType.SecondaryKeyboard, new bindings_1.SecondaryKeyboardInputBinding());
        this.bindings.set(InputBindingType_1.InputBindingType.TertiaryKeyboard, new bindings_1.TertiaryKeyboardInputBinding());
        this.bindings.set(InputBindingType_1.InputBindingType.PrimaryGamepad, new bindings_1.PrimaryGamepadInputBinding());
        this.bindings.set(InputBindingType_1.InputBindingType.SecondaryGamepad, new bindings_1.SecondaryGamepadInputBinding());
        this.bindings.set(InputBindingType_1.InputBindingType.PrimaryMobileGamepad, new bindings_1.PrimaryGamepadInputBinding());
        this.bindings.set(InputBindingType_1.InputBindingType.SecondaryMobileGamepad, new bindings_1.SecondaryGamepadInputBinding());
        this.presenters.set(InputDeviceType_1.InputDeviceType.Keyboard, new presenters_1.KeyboardButtonCodePresenter());
        this.presenters.set(InputDeviceType_1.InputDeviceType.Gamepad, new presenters_1.GamepadButtonCodePresenter());
        this.presenters.set(InputDeviceType_1.InputDeviceType.MobileGamepad, new presenters_1.GamepadButtonCodePresenter());
    }
    getBinding(bindingType) {
        if (!this.bindings.has(bindingType)) {
            throw new Error(`Binding "${bindingType.serialize()}" not registered`);
        }
        const binding = this.bindings.get(bindingType);
        return binding;
    }
    getDevice(deviceType, deviceIndex = 0) {
        if (!this.deviceMap.has(deviceType)) {
            throw new Error(`Device type "${deviceType}" not registered`);
        }
        const devices = this.deviceMap.get(deviceType);
        const device = devices[deviceIndex];
        if (device === undefined) {
            throw new Error(`Device "${deviceType}" index "${deviceIndex}" not registered`);
        }
        return device;
    }
    // Swaps the device at (deviceType, deviceIndex) for a different InputDevice
    // implementation and returns the one it replaced (so a caller can restore
    // it later). Used to wrap a device in an InputRecorderDevice to record a
    // match, or to substitute a RecordedInputDevice to replay one -- everything
    // downstream (bindings, InputMethod, behaviors) keeps working unchanged
    // since they only ever see the InputDevice interface.
    replaceDevice(deviceType, deviceIndex, device) {
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
    startRecording() {
        if (this.recording || this.replaying) {
            return;
        }
        this.recording = true;
        this.deviceMap.forEach((devices) => {
            devices.forEach((device, index) => {
                devices[index] = new core_1.InputRecorderDevice(device);
            });
        });
    }
    isRecording() {
        return this.recording;
    }
    // Stops recording, restores the live devices, and returns everything
    // captured -- keyed by "deviceType:deviceIndex" so it can be fed straight
    // into startReplay() later (or serialized to JSON as-is).
    stopRecording() {
        if (!this.recording) {
            return {};
        }
        this.recording = false;
        const log = {};
        this.deviceMap.forEach((devices, deviceType) => {
            devices.forEach((device, index) => {
                if (device instanceof core_1.InputRecorderDevice) {
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
    startReplay(log) {
        if (this.recording || this.replaying) {
            return;
        }
        this.replaying = true;
        this.deviceMap.forEach((devices, deviceType) => {
            devices.forEach((_device, index) => {
                const frames = log[this.getDeviceKey(deviceType, index)] ?? [];
                devices[index] = new core_1.RecordedInputDevice(frames);
            });
        });
    }
    isReplaying() {
        return this.replaying;
    }
    stopReplay() {
        if (!this.replaying) {
            return;
        }
        this.replaying = false;
        this.restoreLiveDevices();
    }
    restoreLiveDevices() {
        this.liveDeviceMap.forEach((devices, deviceType) => {
            this.deviceMap.set(deviceType, devices.slice());
        });
    }
    getDeviceKey(deviceType, deviceIndex) {
        return `${deviceType}:${deviceIndex}`;
    }
    getPresenter(deviceType) {
        const presenter = this.presenters.get(deviceType);
        return presenter;
    }
    getMobileGamepadHost() {
        return this.mobileGamepadHost;
    }
    setTouchControl(control, pressed) {
        const device = this.liveDeviceMap.get(InputDeviceType_1.InputDeviceType.Keyboard)?.[0];
        const binding = this.getBinding(InputBindingType_1.InputBindingType.PrimaryKeyboard);
        if (device instanceof core_1.KeyboardInputDevice) {
            device.setCodePressed(binding.get(control), pressed);
        }
    }
    getMethodByVariant(variant) {
        const device = this.getDevice(variant.bindingType.deviceType, variant.deviceIndex);
        const binding = this.getBinding(variant.bindingType);
        // TODO: reuse class
        const method = new core_1.InputMethod(device, binding);
        return method;
    }
    getActiveMethod() {
        const activeDevice = this.getActiveDevice();
        const activeBinding = this.getActiveBinding();
        // TODO: reuse class
        const method = new core_1.InputMethod(activeDevice, activeBinding);
        return method;
    }
    // Which device single-player input currently reads from (see the field's
    // own comment). Not part of any recorded replay log by itself -- a replay
    // must capture and restore this alongside the input frames, or single-
    // player's live device-switching behavior (see update() below) would start
    // from whatever device was last active in the menu, not what the original
    // recording actually started from.
    getActiveDeviceType() {
        return this.activeDeviceType;
    }
    setActiveDeviceType(deviceType) {
        this.activeDeviceType = deviceType;
    }
    getActiveDevice() {
        return this.getDevice(this.activeDeviceType);
    }
    // Find first binding that suits active device
    getActiveBinding() {
        let foundBinding = null;
        this.bindings.forEach((binding, bindingType) => {
            // Null check tells if binding was already selected in prev iterations
            if (foundBinding === null &&
                bindingType.deviceType === this.activeDeviceType) {
                foundBinding = binding;
            }
        });
        if (foundBinding === null) {
            throw new Error(`No binding registered for active device "${this.activeDeviceType}"`);
        }
        return foundBinding;
    }
    // Find first binding type that suits active device
    getActiveBindingType() {
        let foundBindingType = null;
        this.bindings.forEach((binding, bindingType) => {
            // Null check tells if binding was already selected in prev iterations
            if (foundBindingType === null &&
                bindingType.deviceType === this.activeDeviceType) {
                foundBindingType = bindingType;
            }
        });
        if (foundBindingType === null) {
            throw new Error(`No binding registered for active device "${this.activeDeviceType}"`);
        }
        return foundBindingType;
    }
    listen() {
        this.deviceMap.forEach((devices) => {
            for (const device of devices) {
                device.listen();
            }
        });
    }
    unlisten() {
        this.deviceMap.forEach((devices) => {
            for (const device of devices) {
                device.unlisten();
            }
        });
    }
    update() {
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
    reset() {
        this.deviceMap.forEach((devices) => {
            for (const device of devices) {
                device.reset();
            }
        });
    }
    loadAllBindings() {
        this.bindings.forEach((binding, bindingType) => {
            const key = this.getBindingStorageKey(bindingType);
            const json = this.storage.get(key);
            binding.fromJSON(json);
        });
    }
    saveBinding(bindingType) {
        const binding = this.getBinding(bindingType);
        const key = this.getBindingStorageKey(bindingType);
        const json = binding.toJSON();
        this.storage.set(key, json);
        this.storage.save();
    }
    getDisplayedControlCode(bindingType, control) {
        const binding = this.getBinding(bindingType);
        const presenter = this.getPresenter(bindingType.deviceType);
        const code = binding.get(control);
        const displayedCode = presenter.asString(code);
        return displayedCode;
    }
    getBindingStorageKey(bindingType) {
        const prefix = config.STORAGE_KEY_SETTINGS_INPUT_BINDINGS_PREFIX;
        const key = `${prefix}.${bindingType.serialize()}`;
        return key;
    }
}
exports.InputManager = InputManager;
