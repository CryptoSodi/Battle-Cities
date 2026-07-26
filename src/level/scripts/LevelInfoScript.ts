import { LevelInfo } from '../../gameObjects';
import { GameUpdateArgs } from '../../game';
import * as config from '../../config';

import { LevelScript } from '../LevelScript';
import { LevelEnemySpawnRequestedEvent, LevelPlayerDiedEvent } from '../events';

export class LevelInfoScript extends LevelScript {
  private info: LevelInfo;
  private localElapsedSeconds = 0;

  protected setup(updateArgs: GameUpdateArgs): void {
    this.eventBus.playerDied.addListener(this.handlePlayerDied);
    this.eventBus.enemySpawnRequested.addListener(
      this.handleEnemySpawnRequested,
    );

    this.info = new LevelInfo(
      this.world.sceneRoot.size.width,
      this.session.isMultiplayer(),
      true,
    );
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

  protected update(updateArgs: GameUpdateArgs): void {
    const webRtcMatch = updateArgs.webRtcMatch;
    if (
      webRtcMatch.isEnabled() &&
      !webRtcMatch.isBroadcaster() &&
      !webRtcMatch.isObserver()
    ) {
      const playerIndex = webRtcMatch.getLocalPlayerIndex() as 0 | 1;
      this.info.setScore(
        webRtcMatch.getPlayerScore(playerIndex) ??
          this.session.getPlayer(playerIndex).getGamePoints(),
      );
    } else {
      this.info.setScore(this.session.getMaxGamePoints());
    }

    if (webRtcMatch.isEnabled()) {
      this.info.setBattleTime(
        webRtcMatch.getSharedElapsedSeconds(),
      );
    } else {
      this.localElapsedSeconds += updateArgs.deltaTime;
      this.info.setBattleTime(this.localElapsedSeconds);
    }
  }

  private handlePlayerDied = (event: LevelPlayerDiedEvent): void => {
    const playerIndex = event.partyIndex;
    const playerSession = this.session.getPlayer(playerIndex);

    this.info.setLivesCount(playerIndex, playerSession.getLivesCount());
  };

  private handleEnemySpawnRequested = (
    event: LevelEnemySpawnRequestedEvent,
  ): void => {
    this.info.setEnemyCount(event.unspawnedCount);
  };
}
