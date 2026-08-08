"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameStorage = void 0;
const LocalStorage_1 = require("../core/storage/LocalStorage");
class GameStorage extends LocalStorage_1.LocalStorage {
    setBoolean(key, value) {
        this.set(key, value.toString());
    }
    getBoolean(key, defaultValue = null) {
        const json = this.get(key);
        let value = defaultValue;
        try {
            value = JSON.parse(json);
        }
        catch (err) {
            // Not parse-able
        }
        if (typeof value !== 'boolean') {
            return defaultValue;
        }
        return value;
    }
    setNumber(key, value) {
        this.set(key, value.toString());
    }
    getNumber(key, defaultValue = null) {
        const json = this.get(key);
        let value = defaultValue;
        try {
            value = JSON.parse(json);
        }
        catch (err) {
            // Not parse-able
        }
        if (typeof value !== 'number') {
            return defaultValue;
        }
        return value;
    }
}
exports.GameStorage = GameStorage;
