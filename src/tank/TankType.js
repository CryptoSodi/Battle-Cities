"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TankType = void 0;
const TankParty_1 = require("./TankParty");
const TankTier_1 = require("./TankTier");
class TankType {
    constructor(party, tier, hasDrop = false) {
        this.party = party;
        this.tier = tier;
        this.hasDrop = hasDrop;
    }
    setHasDrop(hasDrop) {
        this.hasDrop = hasDrop;
        return this;
    }
    clone() {
        return new TankType(this.party, this.tier);
    }
    increaseTier(targetTier = null) {
        if (targetTier !== null) {
            this.tier = targetTier;
            return this;
        }
        switch (this.tier) {
            case TankTier_1.TankTier.A:
                this.tier = TankTier_1.TankTier.B;
                break;
            case TankTier_1.TankTier.B:
                this.tier = TankTier_1.TankTier.C;
                break;
            case TankTier_1.TankTier.C:
                this.tier = TankTier_1.TankTier.D;
            default:
                break;
        }
        return this;
    }
    isMaxTier() {
        return this.tier === TankTier_1.TankTier.D;
    }
    equals(other) {
        return (this.party === other.party &&
            this.tier === other.tier &&
            this.hasDrop === other.hasDrop);
    }
    serialize() {
        return `${this.party}-${this.tier}-${this.hasDrop}`;
    }
    toString() {
        return this.serialize();
    }
    static PlayerA() {
        return new TankType(TankParty_1.TankParty.Player, TankTier_1.TankTier.A);
    }
    static PlayerB() {
        return new TankType(TankParty_1.TankParty.Player, TankTier_1.TankTier.B);
    }
    static PlayerC() {
        return new TankType(TankParty_1.TankParty.Player, TankTier_1.TankTier.C);
    }
    static PlayerD() {
        return new TankType(TankParty_1.TankParty.Player, TankTier_1.TankTier.D);
    }
    static EnemyA() {
        return new TankType(TankParty_1.TankParty.Enemy, TankTier_1.TankTier.A);
    }
    static EnemyB() {
        return new TankType(TankParty_1.TankParty.Enemy, TankTier_1.TankTier.B);
    }
    static EnemyC() {
        return new TankType(TankParty_1.TankParty.Enemy, TankTier_1.TankTier.C);
    }
    static EnemyD() {
        return new TankType(TankParty_1.TankParty.Enemy, TankTier_1.TankTier.D);
    }
}
exports.TankType = TankType;
