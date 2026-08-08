"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputMethod = void 0;
class InputMethod {
    constructor(device, binding) {
        this.device = device;
        this.binding = binding;
    }
    getDevice() {
        return this.device;
    }
    getBinding() {
        return this.binding;
    }
    update() {
        this.device.update();
    }
    isDown(control) {
        const targetCode = this.unmap(control);
        const downCodes = this.device.getDownCodes();
        const isDown = downCodes.includes(targetCode);
        return isDown;
    }
    isDownAny(controls) {
        const targetCodes = this.unmapList(controls);
        const downCodes = this.device.getDownCodes();
        const isDownAny = downCodes.some((code) => targetCodes.includes(code));
        return isDownAny;
    }
    isHold(control) {
        const targetCode = this.unmap(control);
        const holdCodes = this.device.getHoldCodes();
        const isHold = holdCodes.includes(targetCode);
        return isHold;
    }
    isHoldAny(controls) {
        const targetCodes = this.unmapList(controls);
        const holdCodes = this.device.getHoldCodes();
        const isHoldAny = holdCodes.some((code) => targetCodes.includes(code));
        return isHoldAny;
    }
    isNotHoldAll(controls) {
        const targetCodes = this.unmapList(controls);
        const holdCodes = this.device.getHoldCodes();
        const isNotHoldAll = holdCodes.every((code) => !targetCodes.includes(code));
        return isNotHoldAll;
    }
    isHoldFirst(control) {
        const targetCode = this.unmap(control);
        const codes = this.device.getHoldCodes();
        const isHoldFirst = codes[0] === targetCode;
        return isHoldFirst;
    }
    isHoldFirstAny(controls) {
        const targetCodes = this.unmapList(controls);
        const codes = this.device.getHoldCodes();
        const firstCode = codes[0];
        const isHoldFirstAny = targetCodes.includes(firstCode);
        return isHoldFirstAny;
    }
    isHoldLast(control) {
        const targetCode = this.unmap(control);
        const codes = this.device.getHoldCodes();
        const isHoldLast = codes[codes.length - 1] === targetCode;
        return isHoldLast;
    }
    isHoldLastAny(controls) {
        const targetCodes = this.unmapList(controls);
        const codes = this.device.getHoldCodes();
        const lastCode = codes[codes.length - 1];
        const isHoldLastAny = targetCodes.includes(lastCode);
        return isHoldLastAny;
    }
    // Position (in hold order) of the most-recently-held code among `controls`,
    // or -1 if none are held. Lets callers find which of several controls was
    // pressed last while IGNORING other held keys (e.g. fire) in between.
    getHoldLastIndex(controls) {
        const targetCodes = this.unmapList(controls);
        const codes = this.device.getHoldCodes();
        for (let index = codes.length - 1; index >= 0; index -= 1) {
            if (targetCodes.includes(codes[index])) {
                return index;
            }
        }
        return -1;
    }
    isUp(control) {
        const codes = this.device.getUpCodes();
        const isUp = codes.includes(this.unmap(control));
        return isUp;
    }
    isUpAny(controls) {
        const targetCodes = this.unmapList(controls);
        const upCodes = this.device.getUpCodes();
        const isUpAny = upCodes.some((code) => targetCodes.includes(code));
        return isUpAny;
    }
    unmap(control) {
        return this.binding.get(control);
    }
    unmapList(controls) {
        return controls.map((control) => this.unmap(control));
    }
}
exports.InputMethod = InputMethod;
