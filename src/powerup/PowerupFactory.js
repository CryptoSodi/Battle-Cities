"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PowerupFactory = void 0;
const gameObjects_1 = require("../gameObjects");
const PowerupType_1 = require("./PowerupType");
// Configure which powerups can be spawned randomly
const AVAILABLE_TYPES = [
    PowerupType_1.PowerupType.BaseDefence,
    PowerupType_1.PowerupType.Freeze,
    PowerupType_1.PowerupType.Life,
    PowerupType_1.PowerupType.Shield,
    PowerupType_1.PowerupType.Speed,
    PowerupType_1.PowerupType.Upgrade,
    PowerupType_1.PowerupType.ZoomOut,
    PowerupType_1.PowerupType.Wipeout,
];
class PowerupFactory {
    static create(type) {
        const powerup = new gameObjects_1.Powerup(type);
        return powerup;
    }
    static createRandom(rng) {
        const type = rng.arrayElement(AVAILABLE_TYPES);
        const powerup = new gameObjects_1.Powerup(type);
        return powerup;
    }
}
exports.PowerupFactory = PowerupFactory;
