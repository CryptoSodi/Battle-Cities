"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMultiplayerTankFuelCost = exports.isMultiplayerTankTier = exports.DEFAULT_EVENT_ENTRY_FUEL_COST = exports.DIRECT_MATCH_FUEL_COST = void 0;
exports.DIRECT_MATCH_FUEL_COST = 1;
exports.DEFAULT_EVENT_ENTRY_FUEL_COST = 1;
function isMultiplayerTankTier(value) {
    return value === 'a' || value === 'b' || value === 'c' || value === 'd';
}
exports.isMultiplayerTankTier = isMultiplayerTankTier;
function getMultiplayerTankFuelCost(tier) {
    switch (tier) {
        case 'b':
            return 2;
        case 'c':
            return 3;
        case 'd':
            return 4;
        default:
            return exports.DIRECT_MATCH_FUEL_COST;
    }
}
exports.getMultiplayerTankFuelCost = getMultiplayerTankFuelCost;
