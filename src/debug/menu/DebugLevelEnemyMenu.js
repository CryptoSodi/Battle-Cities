"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugLevelEnemyMenu = void 0;
const core_1 = require("../../core");
const DebugMenu_1 = require("../DebugMenu");
class DebugLevelEnemyMenu extends DebugMenu_1.DebugMenu {
    constructor(options = {}) {
        super('Level Enemy', options);
        this.movementToggleRequest = new core_1.Subject();
        this.playerMirrorBulletsToggleRequest = new core_1.Subject();
        this.movementStopped = false;
        this.playerMirrorBulletsHidden = false;
        this.handleMovementToggle = () => {
            this.movementStopped = !this.movementStopped;
            this.movementButton.textContent = this.movementStopped
                ? 'Resume enemy movement'
                : 'Stop enemy movement';
            this.movementButton.setAttribute('aria-pressed', String(this.movementStopped));
            this.movementToggleRequest.notify(this.movementStopped);
        };
        this.handlePlayerMirrorBulletsToggle = () => {
            this.playerMirrorBulletsHidden = !this.playerMirrorBulletsHidden;
            this.playerMirrorBulletsButton.textContent = this.playerMirrorBulletsHidden
                ? 'Show player mirror bullets'
                : 'Hide player mirror bullets';
            this.playerMirrorBulletsButton.setAttribute('aria-pressed', String(this.playerMirrorBulletsHidden));
            this.playerMirrorBulletsToggleRequest.notify(this.playerMirrorBulletsHidden);
        };
        this.movementButton = this.appendButton('Stop enemy movement', this.handleMovementToggle);
        this.movementButton.setAttribute('aria-pressed', 'false');
        this.movementButton.style.minHeight = '40px';
        this.playerMirrorBulletsButton = this.appendButton('Hide player mirror bullets', this.handlePlayerMirrorBulletsToggle);
        this.playerMirrorBulletsButton.setAttribute('aria-pressed', 'false');
        this.playerMirrorBulletsButton.style.minHeight = '40px';
    }
}
exports.DebugLevelEnemyMenu = DebugLevelEnemyMenu;
