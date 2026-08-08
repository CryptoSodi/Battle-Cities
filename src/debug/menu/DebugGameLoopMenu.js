"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugGameLoopMenu = void 0;
const DebugMenu_1 = require("../DebugMenu");
class DebugGameLoopMenu extends DebugMenu_1.DebugMenu {
    constructor(gameLoop, options = {}) {
        super('Game loop', options);
        this.handleStart = () => {
            this.gameLoop.start();
        };
        this.handleStop = () => {
            this.gameLoop.stop();
        };
        this.handleNextFrame = () => {
            this.gameLoop.next();
        };
        this.handleNextFrame10 = () => {
            this.gameLoop.next(10);
        };
        this.gameLoop = gameLoop;
        this.appendButton('Start', this.handleStart);
        this.appendButton('Stop', this.handleStop);
        this.appendButton('Next frame', this.handleNextFrame);
        this.appendButton('Next 10 frames', this.handleNextFrame10);
    }
}
exports.DebugGameLoopMenu = DebugGameLoopMenu;
