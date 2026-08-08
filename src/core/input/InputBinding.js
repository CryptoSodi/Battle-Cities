"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputBinding = void 0;
class InputBinding {
    constructor() {
        this.default = new Map();
        this.custom = new Map();
    }
    setDefault(control, code) {
        this.default.set(control, code);
    }
    setCustom(control, code) {
        this.custom.set(control, code);
    }
    get(control) {
        if (this.custom.has(control)) {
            return this.custom.get(control);
        }
        return this.default.get(control);
    }
    getControl(codeToFind) {
        let foundControl = null;
        this.custom.forEach((code, control) => {
            if (foundControl === null && code === codeToFind) {
                foundControl = control;
                return;
            }
        });
        if (foundControl === null) {
            this.default.forEach((code, control) => {
                if (foundControl === null && code === codeToFind) {
                    foundControl = control;
                    return;
                }
            });
        }
        return foundControl;
    }
    resetAllToDefault() {
        this.custom.clear();
    }
    toJSON() {
        const pairs = [];
        // Save only custom bindings
        this.custom.forEach((code, control) => {
            pairs.push([control, code]);
        });
        const json = JSON.stringify(pairs);
        return json;
    }
    fromJSON(json) {
        let pairs = [];
        try {
            pairs = JSON.parse(json);
        }
        catch (err) {
            // Ignore parse error
        }
        if (!Array.isArray(pairs)) {
            return;
        }
        pairs.forEach((pair) => {
            if (!Array.isArray(pair)) {
                return;
            }
            const [control, code] = pair;
            this.custom.set(control, code);
        });
    }
}
exports.InputBinding = InputBinding;
