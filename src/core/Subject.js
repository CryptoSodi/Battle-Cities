"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subject = void 0;
class Subject {
    constructor() {
        this.listeners = [];
        this.notify = (event) => {
            this.listeners.forEach((listener) => {
                // TODO: handle errors
                listener(event);
            });
            return this;
        };
    }
    addListener(listenerToAdd) {
        this.listeners.push(listenerToAdd);
        const unsubscribe = () => {
            this.removeListener(listenerToAdd);
        };
        return unsubscribe;
    }
    addListenerOnce(listenerToAdd) {
        const wrappedListener = (event) => {
            this.removeListener(wrappedListener);
            listenerToAdd(event);
        };
        const unsubscribe = this.addListener(wrappedListener);
        return unsubscribe;
    }
    removeListener(listenerToRemove) {
        this.listeners = this.listeners.filter((listener) => {
            return listener !== listenerToRemove;
        });
        return this;
    }
}
exports.Subject = Subject;
