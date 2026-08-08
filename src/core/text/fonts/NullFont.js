"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NullFont = void 0;
const Vector_1 = require("../../Vector");
class NullFont {
    buildCharacter() {
        return null;
    }
    getScale() {
        return new Vector_1.Vector(1, 1);
    }
    getCharacterWidth() {
        return 0;
    }
    getCharacterHeight() {
        return 0;
    }
}
exports.NullFont = NullFont;
