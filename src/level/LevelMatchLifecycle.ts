import { Session } from '../game';
import { PowerupType } from '../powerup';
import { TankDeathReason } from '../tank';

import { LevelEventBus } from './LevelEventBus';
import {
  LevelEnemyDiedEvent,
  LevelPlayerDiedEvent,
  LevelPowerupPickedEvent,
} from './events';
import { LevelGameOverScript } from './scripts/LevelGameOverScript';
import { LevelPauseScript } from './scripts/LevelPauseScript';
import { LevelPlayerOverScript } from './scripts/LevelPlayerOverScript';
import { LevelPlayerScript } from './scripts/LevelPlayerScript';
import { LevelWinScript } from './scripts/LevelWinScript';

export type LevelMatchResult = 'win' | 'loss';

interface LevelMatchLifecycleScripts {
  gameOver: LevelGameOverScript;
  pause?: LevelPauseScript;
  playerOver: LevelPlayerOverScript;
  player: LevelPlayerScript;
  win: LevelWinScript;
}

export function prepareLevelSession(
  session: Session,
  enemyTotal: number,
): void {
  session.startLevelStats(enemyTotal);
  const extraLives = session.consumeInitialExtraLives();
  for (let index = 0; index < extraLives; index += 1) {
    session.primaryPlayer.addLife();
    if (session.isMultiplayer()) {
      session.secondaryPlayer.addLife();
    }
  }
}

export class LevelMatchLifecycle {
  private result: LevelMatchResult | null = null;
  private completed = false;

  public constructor(
    private readonly eventBus: LevelEventBus,
    private readonly session: Session,
    private readonly scripts: LevelMatchLifecycleScripts,
  ) {
    eventBus.baseDied.addListener(this.handleBaseDied);
    eventBus.enemyAllDied.addListener(this.handleEnemyAllDied);
    eventBus.enemyDied.addListener(this.handleEnemyDied);
    eventBus.playerDied.addListener(this.handlePlayerDied);
    eventBus.powerupPicked.addListener(this.handlePowerupPicked);
    eventBus.levelGameOverCompleted.addListener(() => {
      this.result = 'loss';
      this.completed = true;
    });
    eventBus.levelWinCompleted.addListener(() => {
      if (!this.session.isGameOver()) {
        this.result = 'win';
        this.completed = true;
      }
    });
  }

  public isComplete(): boolean {
    return this.completed;
  }

  public getResult(): LevelMatchResult | null {
    return this.result;
  }

  public loseMatch(): void {
    this.activateGameOver();
  }

  private handleBaseDied = (): void => {
    this.activateGameOver();
  };

  private handleEnemyAllDied = (): void => {
    this.scripts.pause?.disable();
    this.scripts.win.enable();
  };

  private handleEnemyDied = (event: LevelEnemyDiedEvent): void => {
    if (event.networkMirror === true) {
      return;
    }
    this.session.recordEnemyDefeated();
    if (
      event.reason === TankDeathReason.WipeoutPowerup ||
      event.hitterPartyIndex === null ||
      event.hitterPartyIndex === undefined
    ) {
      return;
    }
    this.session
      .getPlayer(event.hitterPartyIndex)
      .addKillPoints(event.type.tier);
  };

  private handlePlayerDied = (event: LevelPlayerDiedEvent): void => {
    const playerSession = this.session.getPlayer(event.partyIndex);
    playerSession.removeLife();

    if (this.session.isAnyPlayerAlive()) {
      if (!playerSession.isAlive()) {
        this.scripts.playerOver.setPlayerIndex(event.partyIndex);
        this.scripts.playerOver.enable();
      }
      return;
    }

    this.activateGameOver();
  };

  private handlePowerupPicked = (event: LevelPowerupPickedEvent): void => {
    const playerSession = this.session.getPlayer(event.partyIndex);
    if (!playerSession.isAlive()) {
      return;
    }
    playerSession.addPowerupPoints(event.type);
    if (event.type === PowerupType.Life) {
      playerSession.addLife();
    }
  };

  private activateGameOver(): void {
    this.result = 'loss';
    this.completed = false;
    this.session.setGameOver();
    this.scripts.pause?.disable();
    this.scripts.player.disable();
    this.scripts.gameOver.enable();
    this.scripts.win.disable();
  }
}
