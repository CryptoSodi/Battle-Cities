"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArrayUtils = void 0;
class ArrayUtils {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static flatten(array) {
        let result = [];
        array.forEach((item) => {
            if (Array.isArray(item)) {
                result = result.concat(item);
            }
            else {
                result.push(item);
            }
        });
        return result;
    }
}
exports.ArrayUtils = ArrayUtils;
