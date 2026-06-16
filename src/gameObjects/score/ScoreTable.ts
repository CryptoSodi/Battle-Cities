import { GameObject, Subject, Timer } from '../../core';
import { GameUpdateArgs, Session } from '../../game';
import { PointsRecord } from '../../points';
import { TankTier } from '../../tank/TankTier'; // TODO: circular dep?
import * as config from '../../config';

import { SpriteText } from '../text';

import { ScoreTableCounter } from './ScoreTableCounter';
import { ScoreTableTierIcon } from './ScoreTableTierIcon';
import { ScoreTableUnderline } from './ScoreTableUnderline';

enum State {
  Idle,
  Transitioning,
  Counting,
  Done,
}

const TIERS = [TankTier.A, TankTier.B, TankTier.C, TankTier.D];
const TRANSITION_DELAY = 0.4;
const MULTIPLAYER_WIDTH = 836;
const SINGLE_PLAYER_LABEL_X = 256;
const SINGLE_PLAYER_COUNTER_X = 4;
const SINGLE_PLAYER_TOTAL_X = 256;
const SINGLE_PLAYER_TOTAL_KILLS_X = 348;
const MULTIPLAYER_PRIMARY_LABEL_X = 256;
const MULTIPLAYER_SECONDARY_LABEL_X = 836;
const MULTIPLAYER_PRIMARY_COUNTER_X = 4;
const MULTIPLAYER_SECONDARY_COUNTER_X = 492;
const MULTIPLAYER_TOTAL_X = 256;
const MULTIPLAYER_PRIMARY_TOTAL_KILLS_X = 348;
const MULTIPLAYER_SECONDARY_TOTAL_KILLS_X = 546;

export class ScoreTable extends GameObject {
  public done = new Subject();
  private session: Session;
  private primaryPlayerLabel = new SpriteText('Ⅰ-PLAYER', {
    color: config.COLOR_RED,
  });
  private secondaryPlayerLabel = new SpriteText('Ⅱ-PLAYER', {
    color: config.COLOR_RED,
  });
  private underline = new ScoreTableUnderline();
  private primaryGamePoints = new SpriteText('', {
    color: config.COLOR_YELLOW,
  });
  private secondaryGamePoints = new SpriteText('', {
    color: config.COLOR_YELLOW,
  });
  private totalLabel = new SpriteText('TOTAL', { color: config.COLOR_WHITE });
  private primaryTotalKills = new SpriteText('', { color: config.COLOR_WHITE });
  private secondaryTotalKills = new SpriteText('', {
    color: config.COLOR_WHITE,
  });
  private counters: ScoreTableCounter[][] = [];
  private currentCounterIndex = 0;
  private state = State.Idle;
  private transitionTimer = new Timer();

  constructor(isMultiplayer = false) {
    super(MULTIPLAYER_WIDTH, 544);
  }

  protected setup({ session }: GameUpdateArgs): void {
    this.session = session;

    const isMultiplayer = this.session.isMultiplayer();
    const primaryLabelX = isMultiplayer
      ? MULTIPLAYER_PRIMARY_LABEL_X
      : SINGLE_PLAYER_LABEL_X;
    const primaryCounterX = isMultiplayer
      ? MULTIPLAYER_PRIMARY_COUNTER_X
      : SINGLE_PLAYER_COUNTER_X;
    const totalX = isMultiplayer
      ? MULTIPLAYER_TOTAL_X
      : SINGLE_PLAYER_TOTAL_X;
    const primaryTotalKillsX = isMultiplayer
      ? MULTIPLAYER_PRIMARY_TOTAL_KILLS_X
      : SINGLE_PLAYER_TOTAL_KILLS_X;

    this.primaryPlayerLabel.position.set(primaryLabelX, 0);
    this.primaryPlayerLabel.origin.setX(1);
    this.add(this.primaryPlayerLabel);

    if (isMultiplayer) {
      this.secondaryPlayerLabel.position.set(MULTIPLAYER_SECONDARY_LABEL_X, 0);
      this.secondaryPlayerLabel.origin.setX(1);
      this.add(this.secondaryPlayerLabel);
    }

    // For player total points display sum of all levels and current level
    this.primaryGamePoints.setText(
      this.session.primaryPlayer.getGamePoints().toString(),
    );
    this.primaryGamePoints.position.set(primaryLabelX, 64);
    this.primaryGamePoints.origin.set(1, 0);
    this.add(this.primaryGamePoints);

    if (isMultiplayer) {
      this.secondaryGamePoints.setText(
        this.session.secondaryPlayer.getGamePoints().toString(),
      );
      this.secondaryGamePoints.position.set(MULTIPLAYER_SECONDARY_LABEL_X, 64);
      this.secondaryGamePoints.origin.set(1, 0);
      this.add(this.secondaryGamePoints);
    }

    TIERS.forEach((tier, tierIndex) => {
      const icon = new ScoreTableTierIcon(tier, isMultiplayer);
      icon.updateMatrix();
      icon.setCenter(this.getSelfCenter());
      icon.position.setY(136 + 100 * tierIndex);
      this.add(icon);

      const primaryRecord = this.getPrimaryRecord();
      const primaryCost = primaryRecord.getTierKillCost(tier);
      const primaryKills = primaryRecord.getTierKillCount(tier);
      const primaryCounter = new ScoreTableCounter(primaryKills, primaryCost);
      primaryCounter.position.set(primaryCounterX, 152 + 100 * tierIndex);
      this.counters[tierIndex] = this.counters[tierIndex] || [];
      this.counters[tierIndex].push(primaryCounter);
      this.add(primaryCounter);

      if (isMultiplayer) {
        const secondaryRecord = this.getSecondaryRecord();
        const secondaryCost = secondaryRecord.getTierKillCost(tier);
        const secondaryKills = secondaryRecord.getTierKillCount(tier);
        const secondaryCounter = new ScoreTableCounter(
          secondaryKills,
          secondaryCost,
          true,
        );
        secondaryCounter.position.set(
          MULTIPLAYER_SECONDARY_COUNTER_X,
          152 + 100 * tierIndex,
        );
        this.counters[tierIndex] = this.counters[tierIndex] || [];
        this.counters[tierIndex].push(secondaryCounter);
        this.add(secondaryCounter);
      }
    });

    this.underline.updateMatrix();
    this.underline.setCenter(this.getSelfCenter());
    this.underline.position.setY(504);
    this.add(this.underline);

    this.totalLabel.position.set(totalX, 516);
    this.totalLabel.origin.set(1, 0);
    this.add(this.totalLabel);

    this.primaryTotalKills.position.set(primaryTotalKillsX, 516);
    this.primaryTotalKills.origin.set(1, 0);
    this.add(this.primaryTotalKills);

    if (isMultiplayer) {
      this.secondaryTotalKills.position.set(
        MULTIPLAYER_SECONDARY_TOTAL_KILLS_X,
        516,
      );
      this.secondaryTotalKills.origin.set(1, 0);
      this.add(this.secondaryTotalKills);
    }
  }

  protected update(updateArgs: GameUpdateArgs): void {
    if (this.state === State.Idle || this.state === State.Done) {
      return;
    }

    if (this.state === State.Transitioning) {
      if (this.transitionTimer.isDone()) {
        if (this.allCountersDone()) {
          this.finish();
          return;
        }

        const tierCounters = this.getCurrentCounters();
        for (const tierCounter of tierCounters) {
          tierCounter.start();
        }

        this.state = State.Counting;
      }

      this.transitionTimer.update(updateArgs.deltaTime);
      return;
    }

    if (this.state === State.Counting) {
      const tierCounters = this.getCurrentCounters();

      const everyTierCounterDone = tierCounters.every((tierCounter) => {
        return tierCounter.isDone();
      });

      if (everyTierCounterDone) {
        if (this.hasNextCounter()) {
          this.currentCounterIndex += 1;
        }

        this.state = State.Transitioning;
        this.transitionTimer.reset(TRANSITION_DELAY);
        return;
      }
    }
  }

  public start(): void {
    if (this.state !== State.Idle) {
      return;
    }

    this.state = State.Transitioning;
    this.transitionTimer.reset(TRANSITION_DELAY);
  }

  public skip(): void {
    if (this.state === State.Done) {
      return;
    }

    for (const tierCounters of this.counters) {
      for (const tierCounter of tierCounters) {
        tierCounter.skip();
      }
    }

    this.finish();
  }

  private finish(): void {
    this.primaryTotalKills.setText(
      this.getPrimaryRecord()
        .getKillTotalCount()
        .toString(),
    );
    this.secondaryTotalKills.setText(
      this.getSecondaryRecord()
        .getKillTotalCount()
        .toString(),
    );

    this.state = State.Done;
    this.done.notify(null);
  }

  private getCurrentCounters(): ScoreTableCounter[] {
    return this.counters[this.currentCounterIndex];
  }

  private hasNextCounter(): boolean {
    return this.currentCounterIndex < this.counters.length - 1;
  }

  private allCountersDone(): boolean {
    const lastCounters = this.counters[this.counters.length - 1];

    const allDone = lastCounters.every((counter) => {
      return counter.isDone();
    });

    return allDone;
  }

  private getPrimaryRecord(): PointsRecord {
    return this.session.primaryPlayer.getLevelPointsRecord();
  }

  private getSecondaryRecord(): PointsRecord {
    return this.session.secondaryPlayer.getLevelPointsRecord();
  }
}
