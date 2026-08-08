"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MathUtils = void 0;
class MathUtils {
    // Note: floatinig point errors can be inroduced when calculating.
    // For example:
    //
    //   Math.sin(180 * Math.PI / 180) = 1.2246467991473532e-16
    //
    // which is supposed to be a zero and is very close to zero, but is not
    // exactly a zero. Later on when changing a sign, for zero it would not matter
    // but for this value - it carries on the sign and can influence the
    // calculations when multiplying by this number.
    // Use this method to round possible floating-point errors on the early stages
    // so this errors don't propagate to higher-level code.
    static round(value, precisionExp = 10) {
        const precision = 10 * precisionExp;
        return Math.round(value * precision) / precision;
    }
    static degreesToRadians(degrees) {
        return (degrees * Math.PI) / 180;
    }
    static radiansToDegrees(radians) {
        return (radians * 180) / Math.PI;
    }
    static cosDegrees(degrees) {
        const radians = this.degreesToRadians(degrees);
        const cos = Math.cos(radians);
        const rounded = this.round(cos);
        return rounded;
    }
    static sinDegrees(degrees) {
        const radians = this.degreesToRadians(degrees);
        const sin = Math.sin(radians);
        const rounded = this.round(sin);
        return rounded;
    }
    static atan2Degrees(sin, cos) {
        const radians = Math.atan2(sin, cos);
        const degrees = this.radiansToDegrees(radians);
        return degrees;
    }
}
exports.MathUtils = MathUtils;
