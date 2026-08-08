"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NumberUtils = void 0;
class NumberUtils {
    static clamp(value, min, max) {
        return Math.max(Math.min(value, max), min);
    }
}
exports.NumberUtils = NumberUtils;
