"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMatchId = exports.isPlayerSlot = exports.BATTLECITIES_PROTOCOL_VERSION = void 0;
exports.BATTLECITIES_PROTOCOL_VERSION = 1;
function isPlayerSlot(value) {
    return value === 0 || value === 1;
}
exports.isPlayerSlot = isPlayerSlot;
function isMatchId(value) {
    return typeof value === 'string' && /^[0-9A-Za-z_-]{1,64}$/.test(value);
}
exports.isMatchId = isMatchId;
