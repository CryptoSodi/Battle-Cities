"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputBindingType = void 0;
const InputDeviceType_1 = require("./InputDeviceType");
class InputBindingType {
    constructor(bindingIndex, deviceType) {
        this.bindingIndex = bindingIndex;
        this.deviceType = deviceType;
        // Avoid creating multiple instance with the same properties
        for (const instance of InputBindingType.instances) {
            if (instance.equals(this)) {
                return instance;
            }
        }
        InputBindingType.instances.push(this);
    }
    equals(other) {
        return (this.bindingIndex === other.bindingIndex &&
            this.deviceType === other.deviceType);
    }
    // It should be backwards-compatible because it will be used as a key
    // for storage.
    serialize() {
        const bindingIndexPart = this.serializeBindingIndex();
        const deviceTypePart = this.serializeDeviceType();
        const serialized = `${bindingIndexPart}_${deviceTypePart}`;
        return serialized;
    }
    serializeBindingIndex() {
        switch (this.bindingIndex) {
            case 0:
                return 'primary';
            case 1:
                return 'secondary';
            case 2:
                return 'tertiary';
        }
        return 'unknown';
    }
    serializeDeviceType() {
        switch (this.deviceType) {
            case InputDeviceType_1.InputDeviceType.Keyboard:
                return '0';
            case InputDeviceType_1.InputDeviceType.Gamepad:
                return '1';
            case InputDeviceType_1.InputDeviceType.MobileGamepad:
                return '2';
        }
        return '?';
    }
}
exports.InputBindingType = InputBindingType;
InputBindingType.instances = [];
InputBindingType.PrimaryKeyboard = new InputBindingType(0, InputDeviceType_1.InputDeviceType.Keyboard);
InputBindingType.PrimaryGamepad = new InputBindingType(0, InputDeviceType_1.InputDeviceType.Gamepad);
InputBindingType.SecondaryKeyboard = new InputBindingType(1, InputDeviceType_1.InputDeviceType.Keyboard);
InputBindingType.SecondaryGamepad = new InputBindingType(1, InputDeviceType_1.InputDeviceType.Gamepad);
InputBindingType.PrimaryMobileGamepad = new InputBindingType(0, InputDeviceType_1.InputDeviceType.MobileGamepad);
InputBindingType.SecondaryMobileGamepad = new InputBindingType(1, InputDeviceType_1.InputDeviceType.MobileGamepad);
InputBindingType.TertiaryKeyboard = new InputBindingType(2, InputDeviceType_1.InputDeviceType.Keyboard);
