"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputVariant = void 0;
const InputBindingType_1 = require("./InputBindingType");
class InputVariant {
    constructor(bindingType, deviceIndex) {
        this.bindingType = bindingType;
        this.deviceIndex = deviceIndex;
        // Avoid creating multiple instance with the same properties
        for (const instance of InputVariant.instances) {
            if (instance.equals(this)) {
                return instance;
            }
        }
        InputVariant.instances.push(this);
    }
    equals(other) {
        return (this.bindingType === other.bindingType &&
            this.deviceIndex === other.deviceIndex);
    }
}
exports.InputVariant = InputVariant;
InputVariant.instances = [];
InputVariant.PrimaryKeyboard0 = new InputVariant(InputBindingType_1.InputBindingType.PrimaryKeyboard, 0);
InputVariant.SecondaryKeyboard0 = new InputVariant(InputBindingType_1.InputBindingType.SecondaryKeyboard, 0);
InputVariant.TertiaryKeyboard0 = new InputVariant(InputBindingType_1.InputBindingType.TertiaryKeyboard, 0);
InputVariant.PrimaryGamepad0 = new InputVariant(InputBindingType_1.InputBindingType.PrimaryGamepad, 0);
InputVariant.PrimaryGamepad1 = new InputVariant(InputBindingType_1.InputBindingType.PrimaryGamepad, 1);
InputVariant.SecondaryGamepad0 = new InputVariant(InputBindingType_1.InputBindingType.SecondaryGamepad, 0);
InputVariant.SecondaryGamepad1 = new InputVariant(InputBindingType_1.InputBindingType.SecondaryGamepad, 1);
InputVariant.PrimaryMobileGamepad0 = new InputVariant(InputBindingType_1.InputBindingType.PrimaryMobileGamepad, 0);
InputVariant.PrimaryMobileGamepad1 = new InputVariant(InputBindingType_1.InputBindingType.PrimaryMobileGamepad, 1);
InputVariant.SecondaryMobileGamepad0 = new InputVariant(InputBindingType_1.InputBindingType.SecondaryMobileGamepad, 0);
InputVariant.SecondaryMobileGamepad1 = new InputVariant(InputBindingType_1.InputBindingType.SecondaryMobileGamepad, 1);
