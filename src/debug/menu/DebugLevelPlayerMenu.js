"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugLevelPlayerMenu = void 0;
const core_1 = require("../../core");
const DebugMenu_1 = require("../DebugMenu");
class DebugLevelPlayerMenu extends DebugMenu_1.DebugMenu {
    constructor(options = {}) {
        super('Level Player', options);
        this.deathRequest = new core_1.Subject();
        this.upgradeRequest = new core_1.Subject();
        this.moveSpeedUpRequest = new core_1.Subject();
        this.requestDeath = (partyIndex) => {
            this.deathRequest.notify(partyIndex);
        };
        this.requestMoveSpeedUp = (partyIndex) => {
            this.moveSpeedUpRequest.notify({ partyIndex, speed: 500 });
        };
        this.requestUpgrade = (partyIndex) => {
            this.upgradeRequest.notify(partyIndex);
        };
        this.appendButton('#1 Upgrade', () => this.requestUpgrade(0));
        this.appendButton('#1 Die', () => this.requestDeath(0));
        this.appendButton('#1 Speed +500', () => this.requestMoveSpeedUp(0));
        this.appendButton('#2 Upgrade', () => this.requestUpgrade(1));
        this.appendButton('#2 Die', () => this.requestDeath(1));
        this.appendButton('#2 Speed +500', () => this.requestMoveSpeedUp(1));
    }
}
exports.DebugLevelPlayerMenu = DebugLevelPlayerMenu;
