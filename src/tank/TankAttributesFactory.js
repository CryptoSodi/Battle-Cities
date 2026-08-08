"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TankAttributesFactory = void 0;
const TankBulletWallDamage_1 = require("./TankBulletWallDamage");
const TankParty_1 = require("./TankParty");
const TankTier_1 = require("./TankTier");
var BulletRapidFireDelay;
(function (BulletRapidFireDelay) {
    BulletRapidFireDelay[BulletRapidFireDelay["Slow"] = 0.16] = "Slow";
    BulletRapidFireDelay[BulletRapidFireDelay["Fast"] = 0.04] = "Fast";
})(BulletRapidFireDelay || (BulletRapidFireDelay = {}));
var BulletSpeed;
(function (BulletSpeed) {
    BulletSpeed[BulletSpeed["Slow"] = 600] = "Slow";
    BulletSpeed[BulletSpeed["Fast"] = 900] = "Fast";
})(BulletSpeed || (BulletSpeed = {}));
var MoveSpeed;
(function (MoveSpeed) {
    MoveSpeed[MoveSpeed["Slow"] = 120] = "Slow";
    MoveSpeed[MoveSpeed["Medium"] = 180] = "Medium";
    MoveSpeed[MoveSpeed["Fast"] = 240] = "Fast";
})(MoveSpeed || (MoveSpeed = {}));
// TODO: move configuration to json
const config = {
    list: [
        {
            selector: {
                party: TankParty_1.TankParty.Player,
                tier: TankTier_1.TankTier.A,
            },
            attributes: {
                bulletMaxCount: 1,
                bulletRapidFireDelay: BulletRapidFireDelay.Slow,
                bulletSpeed: BulletSpeed.Slow,
                bulletTankDamage: 1,
                bulletWallDamage: TankBulletWallDamage_1.TankBulletWallDamage.Low,
                health: 1,
                moveSpeed: MoveSpeed.Medium,
            },
        },
        {
            selector: {
                party: TankParty_1.TankParty.Player,
                tier: TankTier_1.TankTier.B,
            },
            attributes: {
                bulletMaxCount: 1,
                bulletRapidFireDelay: BulletRapidFireDelay.Slow,
                bulletSpeed: BulletSpeed.Fast,
                bulletTankDamage: 1,
                bulletWallDamage: TankBulletWallDamage_1.TankBulletWallDamage.Low,
                health: 1,
                moveSpeed: MoveSpeed.Medium,
            },
        },
        {
            selector: {
                party: TankParty_1.TankParty.Player,
                tier: TankTier_1.TankTier.C,
            },
            attributes: {
                bulletMaxCount: 2,
                bulletRapidFireDelay: BulletRapidFireDelay.Fast,
                bulletSpeed: BulletSpeed.Fast,
                bulletTankDamage: 1,
                bulletWallDamage: TankBulletWallDamage_1.TankBulletWallDamage.Low,
                health: 1,
                moveSpeed: MoveSpeed.Medium,
            },
        },
        {
            selector: {
                party: TankParty_1.TankParty.Player,
                tier: TankTier_1.TankTier.D,
            },
            attributes: {
                bulletMaxCount: 2,
                bulletRapidFireDelay: BulletRapidFireDelay.Fast,
                bulletSpeed: BulletSpeed.Fast,
                bulletTankDamage: 1,
                bulletWallDamage: TankBulletWallDamage_1.TankBulletWallDamage.High,
                health: 1,
                moveSpeed: MoveSpeed.Medium,
            },
        },
        {
            selector: {
                party: TankParty_1.TankParty.Enemy,
                tier: TankTier_1.TankTier.A,
            },
            attributes: {
                bulletMaxCount: 1,
                bulletRapidFireDelay: BulletRapidFireDelay.Slow,
                bulletSpeed: BulletSpeed.Slow,
                bulletTankDamage: 1,
                bulletWallDamage: TankBulletWallDamage_1.TankBulletWallDamage.Low,
                health: 1,
                moveSpeed: MoveSpeed.Slow,
            },
        },
        {
            selector: {
                party: TankParty_1.TankParty.Enemy,
                tier: TankTier_1.TankTier.B,
            },
            attributes: {
                bulletMaxCount: 1,
                bulletRapidFireDelay: BulletRapidFireDelay.Slow,
                bulletSpeed: BulletSpeed.Slow,
                bulletTankDamage: 1,
                bulletWallDamage: TankBulletWallDamage_1.TankBulletWallDamage.Low,
                health: 1,
                moveSpeed: MoveSpeed.Fast,
            },
        },
        {
            selector: {
                party: TankParty_1.TankParty.Enemy,
                tier: TankTier_1.TankTier.C,
            },
            attributes: {
                bulletMaxCount: 1,
                bulletRapidFireDelay: BulletRapidFireDelay.Slow,
                bulletSpeed: BulletSpeed.Fast,
                bulletTankDamage: 1,
                bulletWallDamage: TankBulletWallDamage_1.TankBulletWallDamage.Low,
                health: 1,
                moveSpeed: MoveSpeed.Slow,
            },
        },
        {
            selector: {
                party: TankParty_1.TankParty.Enemy,
                tier: TankTier_1.TankTier.D,
            },
            attributes: {
                bulletMaxCount: 1,
                bulletRapidFireDelay: BulletRapidFireDelay.Slow,
                bulletSpeed: BulletSpeed.Slow,
                bulletTankDamage: 1,
                bulletWallDamage: TankBulletWallDamage_1.TankBulletWallDamage.Low,
                health: 4,
                moveSpeed: MoveSpeed.Slow,
            },
        },
    ],
};
class TankAttributesFactory {
    static create(type) {
        const foundItem = config.list.find((item) => {
            const { selector } = item;
            return selector.party === type.party && selector.tier === type.tier;
        });
        if (foundItem === undefined) {
            throw new Error(`Tank attributes not found for type = "${type.serialize()}"`);
        }
        // TODO: ugly, to prevent changing object by reference
        const attributes = Object.assign({}, foundItem.attributes);
        return attributes;
    }
}
exports.TankAttributesFactory = TankAttributesFactory;
