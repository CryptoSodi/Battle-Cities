"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelPauseScript = void 0;
const game_1 = require("../../game");
const gameObjects_1 = require("../../gameObjects");
const input_1 = require("../../input");
const LevelScript_1 = require("../LevelScript");
class LevelPauseScript extends LevelScript_1.LevelScript {
    setup() {
        this.notice = new gameObjects_1.PauseNotice();
        this.notice.updateMatrix();
        this.notice.setCenter(this.world.field.getSelfCenter());
        this.notice.position.y += 18;
        this.notice.setVisible(false);
        this.world.field.add(this.notice);
    }
    update(updateArgs) {
        const { gameState, inputManager, session } = updateArgs;
        const activeMethod = inputManager.getActiveMethod();
        // By default check single-player active input
        let inputMethods = [activeMethod];
        if (session.isMultiplayer()) {
            const playerSessions = session.getPlayers();
            // Get input variants for all players
            inputMethods = playerSessions.map((playerSession) => {
                const playerVariant = playerSession.getInputVariant();
                const playerMethod = inputManager.getMethodByVariant(playerVariant);
                return playerMethod;
            });
        }
        const anybodyPaused = inputMethods.some((inputMethod) => {
            return inputMethod.isDownAny(input_1.LevelPlayInputContext.Pause);
        });
        if (anybodyPaused) {
            if (gameState.is(game_1.GameState.Playing)) {
                gameState.set(game_1.GameState.Paused);
                this.activate();
            }
            else {
                gameState.set(game_1.GameState.Playing);
                this.deactivate();
            }
        }
    }
    activate() {
        this.notice.setVisible(true);
        this.notice.restart();
        this.eventBus.levelPaused.notify(null);
    }
    deactivate() {
        this.notice.dirtyPaintBox();
        this.notice.setVisible(false);
        this.eventBus.levelUnpaused.notify(null);
    }
}
exports.LevelPauseScript = LevelPauseScript;
