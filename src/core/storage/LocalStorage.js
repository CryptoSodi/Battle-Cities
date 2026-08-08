"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalStorage = void 0;
class LocalStorage {
    constructor(namespace) {
        this.cache = {};
        this.namespace = namespace;
    }
    set(key, value) {
        this.cache[key] = value;
    }
    get(key) {
        return this.cache[key];
    }
    load() {
        // Returns null if key does no exist
        const json = window.localStorage.getItem(this.namespace);
        let data;
        try {
            data = JSON.parse(json);
        }
        catch (err) {
            // Ignore error
        }
        // In case there is something else stored in that namespace
        if (typeof data !== 'object' || data === null) {
            data = {};
        }
        this.cache = data;
    }
    save() {
        const json = JSON.stringify(this.cache);
        window.localStorage.setItem(this.namespace, json);
    }
}
exports.LocalStorage = LocalStorage;
