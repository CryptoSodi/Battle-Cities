"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RandomUtils = void 0;
class RandomUtils {
    static arrayElement(values) {
        const index = this.number(0, values.length);
        return values[index];
    }
    // [min, max) - min inclusive, max exclusive
    static number(min = 0, max = 100) {
        // TODO: use custom algorithm
        return min + Math.floor(Math.random() * (max - min));
    }
    static probability(chancePercent) {
        const num = this.number(1, 100);
        const hasChance = num <= chancePercent;
        return hasChance;
    }
}
exports.RandomUtils = RandomUtils;
