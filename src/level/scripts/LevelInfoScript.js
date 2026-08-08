"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelInfoScript = void 0;
const gameObjects_1 = require("../../gameObjects");
const LevelScript_1 = require("../LevelScript");
class LevelInfoScript extends LevelScript_1.LevelScript {
    constructor() {
        super(...arguments);
        this.localElapsedSeconds = 0;
        this.handlePlayerDied = (event) => {
            const playerIndex = event.partyIndex;
            const playerSession = this.session.getPlayer(playerIndex);
            this.info.setLivesCount(playerIndex, playerSession.getLivesCount());
        };
        this.handleEnemySpawnRequested = (event) => {
            this.info.setEnemyCount(event.unspawnedCount);
        };
    }
    setup(updateArgs) {
        this.eventBus.playerDied.addListener(this.handlePlayerDied);
        this.eventBus.enemySpawnRequested.addListener(this.handleEnemySpawnRequested);
        this.info = new gameObjects_1.LevelInfo(this.world.sceneRoot.size.width, this.session.isMultiplayer(), true);
        this.info.position.set(0, 0);
        this.world.sceneRoot.add(this.info);
        this.info.setLevelNumber(this.session.getLevelNumber());
        this.info.setScore(this.session.getMaxGamePoints());
        this.session.players.forEach((playerSession, playerIndex) => {
            playerSession.lifeup.addListener(() => {
                this.info.setLivesCount(playerIndex, playerSession.getLivesCount());
            });
            this.info.setLivesCount(playerIndex, playerSession.getLivesCount());
        });
    }
    update(updateArgs) {
        const webRtcMatch = updateArgs.webRtcMatch;
        if (webRtcMatch.isEnabled() &&
            !webRtcMatch.isBroadcaster() &&
            !webRtcMatch.isObserver()) {
            const playerIndex = webRtcMatch.getLocalPlayerIndex();
            this.info.setScore(webRtcMatch.getPlayerScore(playerIndex) ??
                this.session.getPlayer(playerIndex).getGamePoints());
        }
        else {
            this.info.setScore(this.session.getMaxGamePoints());
        }
        if (webRtcMatch.isEnabled()) {
            this.info.setBattleTime(webRtcMatch.getSharedElapsedSeconds());
        }
        else {
            this.localElapsedSeconds += updateArgs.deltaTime;
            this.info.setBattleTime(this.localElapsedSeconds);
        }
    }
}
exports.LevelInfoScript = LevelInfoScript;
