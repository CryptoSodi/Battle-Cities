"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.State = void 0;
class State {
    constructor(initialValue) {
        this.value = initialValue;
        this.previousValue = null;
    }
    get() {
        return this.value;
    }
    set(newValue) {
        this.previousValue = this.value;
        this.value = newValue;
        return this;
    }
    update() {
        this.previousValue = this.value;
        this.value = this.value;
        return this;
    }
    is(value) {
        return this.value === value;
    }
    not(value) {
        return this.value !== value;
    }
    hasChanged() {
        return this.value !== this.previousValue;
    }
    hasChangedTo(toValue) {
        return this.value !== this.previousValue && this.value === toValue;
    }
    hasChangedFrom(fromValue) {
        return this.previousValue === fromValue;
    }
    hasChangedFromTo(fromValue, toValue) {
        return this.previousValue === fromValue && this.value === toValue;
    }
}
exports.State = State;
