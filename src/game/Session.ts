import { SessionPlayer } from './SessionPlayer';
import { PowerupType } from '../powerup';
import { ShopInventoryItemId } from '../shop';
import { TankTier } from '../tank';

export interface SessionRunConsumables {
  powerups: PowerupType[];
  powerupItems: ShopInventoryItemId[];
  powerupCounts: number[];
  extraLives: number;
}

// Trait boost percentages (trading volume + staking perks) captured at run
// start. They AFFECT the simulation (player health/speed, powerup duration),
// so they are recorded into replays like runConsumables — a replay must
// re-enact the boosts the run was played with, not the viewer's own.
export interface SessionRunBoosts {
  hull: number;
  armor: number;
  engine: number;
  salvage: number;
}

export function createEmptyRunBoosts(): SessionRunBoosts {
  return { hull: 0, armor: 0, engine: 0, salvage: 0 };
}

enum State {
  Idle,
  Playing,
  GameOver,
}

export class Session {
  public primaryPlayer = new SessionPlayer();
  public secondaryPlayer = new SessionPlayer();
  public players: SessionPlayer[] = [];
  private startLevelNumber: number;
  private endLevelNumber: number;
  private currentLevelNumber: number;
  private playtest: boolean;
  private multiplayer: boolean;
  private seenIntro: boolean;
  private state: State;
  private runConsumables: SessionRunConsumables;
  private runExtraLivesApplied: boolean;
  private runBoosts: SessionRunBoosts;
  private playerTankTiers: [TankTier, TankTier];
  private levelEnemyTotal: number;
  private levelEnemiesDefeated: number;
  private levelDurationTicks: number;

  constructor() {
    this.reset();

    this.players.push(this.primaryPlayer, this.secondaryPlayer);
  }

  public start(startLevelNumber: number, endLevelNumber: number): void {
    if (this.state !== State.Idle) {
      return;
    }

    this.startLevelNumber = startLevelNumber;
    this.endLevelNumber = endLevelNumber;
    this.currentLevelNumber = startLevelNumber;
    this.state = State.Playing;
  }

  public reset(): void {
    this.seenIntro = false;
    this.startLevelNumber = 1;
    this.currentLevelNumber = 1;
    this.endLevelNumber = 1;
    this.state = State.Idle;
    this.playtest = false;
    this.multiplayer = false;
    this.runConsumables = {
      powerups: [],
      powerupItems: [],
      powerupCounts: [],
      extraLives: 0,
    };
    this.runExtraLivesApplied = false;
    this.runBoosts = createEmptyRunBoosts();
    this.playerTankTiers = [TankTier.A, TankTier.A];
    this.levelEnemyTotal = 0;
    this.levelEnemiesDefeated = 0;
    this.levelDurationTicks = 0;

    this.primaryPlayer.reset();
    this.secondaryPlayer.reset();
  }

  public getPlayer(playerIndex: number): SessionPlayer {
    return this.players[playerIndex];
  }

  public getPlayers(): SessionPlayer[] {
    return this.players;
  }

  public isAnyPlayerAlive(): boolean {
    if (!this.multiplayer) {
      return this.primaryPlayer.isAlive();
    }

    return this.players.some((player) => {
      return player.isAlive();
    });
  }

  public resetExceptIntro(): void {
    this.startLevelNumber = 1;
    this.currentLevelNumber = 1;
    this.endLevelNumber = 1;
    this.state = State.Idle;
    this.playtest = false;
    this.playerTankTiers = [TankTier.A, TankTier.A];
    this.runExtraLivesApplied = false;

    this.primaryPlayer.reset();
    this.secondaryPlayer.reset();
  }

  public activateNextLevel(): void {
    this.currentLevelNumber += 1;

    this.primaryPlayer.completeLevel();
    this.secondaryPlayer.completeLevel();
  }

  public getMaxLevelPoints(): number {
    let maxPoints = 0;

    for (const player of this.players) {
      const points = player.getLevelPoints();
      if (points > maxPoints) {
        maxPoints = points;
      }
    }

    return maxPoints;
  }

  public getMaxGamePoints(): number {
    let maxPoints = 0;

    for (const player of this.players) {
      const points = player.getGamePoints();
      if (points > maxPoints) {
        maxPoints = points;
      }
    }

    return maxPoints;
  }

  public anybodyHasBonusPoints(): boolean {
    return this.players.some((player) => {
      return player.hasBonusPoints();
    });
  }

  public getLevelNumber(): number {
    return this.currentLevelNumber;
  }

  public isLastLevel(): boolean {
    return this.currentLevelNumber === this.endLevelNumber;
  }

  public setGameOver(): void {
    this.state = State.GameOver;
  }

  public isGameOver(): boolean {
    return this.state === State.GameOver;
  }

  public setSeenIntro(seenIntro: boolean): void {
    this.seenIntro = seenIntro;
  }

  public haveSeenIntro(): boolean {
    return this.seenIntro;
  }

  public setPlaytest(): void {
    this.playtest = true;
  }

  public resetPlaytest(): void {
    this.playtest = false;
  }

  public isPlaytest(): boolean {
    return this.playtest;
  }

  public setMultiplayer(): void {
    this.multiplayer = true;
  }

  public isMultiplayer(): boolean {
    return this.multiplayer;
  }

  public setRunConsumables(runConsumables: SessionRunConsumables): void {
    this.runConsumables = runConsumables;
    this.runExtraLivesApplied = false;
  }

  public getRunConsumables(): SessionRunConsumables {
    return this.runConsumables;
  }

  public consumeInitialExtraLives(): number {
    if (this.runExtraLivesApplied) {
      return 0;
    }
    this.runExtraLivesApplied = true;
    return Math.max(0, Math.floor(this.runConsumables.extraLives || 0));
  }

  public clearRunConsumables(): void {
    this.runConsumables = {
      powerups: [],
      powerupItems: [],
      powerupCounts: [],
      extraLives: 0,
    };
    this.runExtraLivesApplied = false;
  }

  public setRunBoosts(runBoosts: SessionRunBoosts): void {
    this.runBoosts = {
      hull: clampBoostPercent(runBoosts?.hull),
      armor: clampBoostPercent(runBoosts?.armor),
      engine: clampBoostPercent(runBoosts?.engine),
      salvage: clampBoostPercent(runBoosts?.salvage),
    };
  }

  public getRunBoosts(): SessionRunBoosts {
    return this.runBoosts;
  }

  public setPlayerTankTier(playerIndex: number, tier: TankTier): void {
    if (playerIndex < 0 || playerIndex >= this.playerTankTiers.length) {
      return;
    }
    this.playerTankTiers[playerIndex] = isTankTier(tier) ? tier : TankTier.A;
  }

  public getPlayerTankTier(playerIndex: number): TankTier {
    return this.playerTankTiers[playerIndex] || TankTier.A;
  }

  public getPlayerTankTiers(): TankTier[] {
    return this.playerTankTiers.slice();
  }

  public startLevelStats(enemyTotal: number): void {
    this.levelEnemyTotal = Math.max(0, Math.floor(enemyTotal));
    this.levelEnemiesDefeated = 0;
    this.levelDurationTicks = 0;
  }

  public recordLevelTick(): void {
    this.levelDurationTicks += 1;
  }

  public recordEnemyDefeated(): void {
    this.levelEnemiesDefeated += 1;
  }

  public getLevelEnemyTotal(): number {
    return this.levelEnemyTotal;
  }

  public getLevelEnemiesDefeated(): number {
    return this.levelEnemiesDefeated;
  }

  public getLevelDurationTicks(): number {
    return this.levelDurationTicks;
  }
}

// Boost effects feed the simulation, so keep inputs sane regardless of what
// the server (or an old replay file) hands over.
function clampBoostPercent(value: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(60, Math.floor(parsed)));
}

function isTankTier(value: TankTier): boolean {
  return (
    value === TankTier.A ||
    value === TankTier.B ||
    value === TankTier.C ||
    value === TankTier.D
  );
}
