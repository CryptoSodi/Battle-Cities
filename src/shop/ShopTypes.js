"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPowerupTypeForInventoryItem = exports.ShopCurrency = exports.ShopLoadoutSlot = exports.ShopInventoryItemId = exports.ShopItemId = void 0;
const powerup_1 = require("../powerup");
var ShopItemId;
(function (ShopItemId) {
    ShopItemId["FuelOne"] = "fuel-one";
    ShopItemId["FuelFive"] = "fuel-five";
    ShopItemId["FuelTwenty"] = "fuel-twenty";
    ShopItemId["Shield"] = "shield";
    ShopItemId["BaseDefence"] = "base-defence";
    ShopItemId["Freeze"] = "freeze";
    ShopItemId["Speed"] = "speed";
    ShopItemId["Upgrade"] = "upgrade";
    ShopItemId["ZoomOut"] = "zoom-out";
    ShopItemId["Wipeout"] = "wipeout";
    ShopItemId["ExtraLife"] = "extra-life";
    ShopItemId["StarterPack"] = "starter-pack";
})(ShopItemId = exports.ShopItemId || (exports.ShopItemId = {}));
var ShopInventoryItemId;
(function (ShopInventoryItemId) {
    ShopInventoryItemId["Shield"] = "shield";
    ShopInventoryItemId["BaseDefence"] = "base-defence";
    ShopInventoryItemId["Freeze"] = "freeze";
    ShopInventoryItemId["Speed"] = "speed";
    ShopInventoryItemId["Upgrade"] = "upgrade";
    ShopInventoryItemId["ZoomOut"] = "zoom-out";
    ShopInventoryItemId["Wipeout"] = "wipeout";
    ShopInventoryItemId["ExtraLife"] = "extra-life";
})(ShopInventoryItemId = exports.ShopInventoryItemId || (exports.ShopInventoryItemId = {}));
var ShopLoadoutSlot;
(function (ShopLoadoutSlot) {
    ShopLoadoutSlot["ActiveOne"] = "active-one";
    ShopLoadoutSlot["ActiveTwo"] = "active-two";
    ShopLoadoutSlot["ActiveThree"] = "active-three";
    ShopLoadoutSlot["ActiveFour"] = "active-four";
    ShopLoadoutSlot["Passive"] = "passive";
})(ShopLoadoutSlot = exports.ShopLoadoutSlot || (exports.ShopLoadoutSlot = {}));
var ShopCurrency;
(function (ShopCurrency) {
    ShopCurrency["Token"] = "token";
    ShopCurrency["Sol"] = "sol";
})(ShopCurrency = exports.ShopCurrency || (exports.ShopCurrency = {}));
function getPowerupTypeForInventoryItem(itemId) {
    switch (itemId) {
        case ShopInventoryItemId.Shield:
            return powerup_1.PowerupType.Shield;
        case ShopInventoryItemId.BaseDefence:
            return powerup_1.PowerupType.BaseDefence;
        case ShopInventoryItemId.Freeze:
            return powerup_1.PowerupType.Freeze;
        case ShopInventoryItemId.Speed:
            return powerup_1.PowerupType.Speed;
        case ShopInventoryItemId.Upgrade:
            return powerup_1.PowerupType.Upgrade;
        case ShopInventoryItemId.ZoomOut:
            return powerup_1.PowerupType.ZoomOut;
        case ShopInventoryItemId.Wipeout:
            return powerup_1.PowerupType.Wipeout;
        case ShopInventoryItemId.ExtraLife:
            return powerup_1.PowerupType.Life;
        default:
            return null;
    }
}
exports.getPowerupTypeForInventoryItem = getPowerupTypeForInventoryItem;
