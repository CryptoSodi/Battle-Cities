import { Subject, Timer } from '../core';
import { GameUpdateArgs, SessionRunBoosts, Tag } from '../game';
import {
  TankAttributesFactory,
  TankColor,
  TankColorFactory,
  TankDeathReason,
  TankSkinAnimation,
  TankTier,
  TankType,
} from '../tank';
import * as config from '../config';

import { Tank } from './Tank';

export class PlayerTank extends Tank {
  public upgraded = new Subject<{ tier: TankTier }>();
  public tags = [Tag.Tank, Tag.Player];
  public zIndex = config.PLAYER_TANK_Z_INDEX;
  private tierSkinAnimations = new Map<TankTier, TankSkinAnimation>();
  private colors: TankColor[] = [];
  private speedBoostTimer = new Timer();
  private speedBoostMultiplier = 1;
  // Run-long trait boosts (trading/staking), applied deterministically:
  // hull/armor add flat bonus health, engine multiplies move speed for the
  // whole run (unlike the temporary powerup speedBoostMultiplier). Values
  // come from the session at spawn (or from the replay being re-enacted).
  private runBoostBonusHealth = 0;
  private runBoostSpeedMultiplier = 1;

  protected setup(updateArgs: GameUpdateArgs): void {
    const { spriteLoader } = updateArgs;

    // Give the player tank momentum (a short acceleration ramp to full speed).
    // Enemies keep the default instant response.
    this.moveAcceleration = config.PLAYER_MOVE_ACCELERATION;

    // Player only has one color
    this.colors.push(TankColorFactory.createPlayerColor(this.partyIndex));

    this.tierSkinAnimations.set(
      TankTier.A,
      new TankSkinAnimation(spriteLoader, TankType.PlayerA(), this.colors),
    );
    this.tierSkinAnimations.set(
      TankTier.B,
      new TankSkinAnimation(spriteLoader, TankType.PlayerB(), this.colors),
    );
    this.tierSkinAnimations.set(
      TankTier.C,
      new TankSkinAnimation(spriteLoader, TankType.PlayerC(), this.colors),
    );
    this.tierSkinAnimations.set(
      TankTier.D,
      new TankSkinAnimation(spriteLoader, TankType.PlayerD(), this.colors),
    );

    this.skinAnimation = this.tierSkinAnimations.get(this.type.tier);

    super.setup(updateArgs);

    this.speedBoostTimer.done.addListener(this.handleSpeedBoostTimer);
  }

  protected update(updateArgs: GameUpdateArgs): void {
    super.update(updateArgs);

    this.speedBoostTimer.update(updateArgs.deltaTime);
  }

  // If tier is provided - it means that specific tier needs to be activated
  // when transitioning to the next level.next
  // If not - then most likely powerup has been picked up and we simply need
  // to upgrade the tank one tier up.
  public upgrade(targetTier: TankTier = null, notify = true): void {
    if (this.type.isMaxTier()) {
      return;
    }

    this.type.increaseTier(targetTier);

    this.applyTier(notify);
  }

  public activateSpeedBoost(duration: number, multiplier: number): void {
    this.speedBoostMultiplier = multiplier;
    this.applySpeedBoost();
    this.speedBoostTimer.reset(duration);
  }

  // Call right after creation (before the first update). Every +10% hull and
  // every +15% armor grant one bonus hit; engine % maps directly to speed.
  public setRunBoosts(boosts: SessionRunBoosts): void {
    this.runBoostBonusHealth =
      Math.floor((boosts?.hull || 0) / 10) + Math.floor((boosts?.armor || 0) / 15);
    this.runBoostSpeedMultiplier = 1 + (boosts?.engine || 0) / 100;

    this.attributes.health += this.runBoostBonusHealth;
    this.applySpeedBoost();
  }

  protected receiveHit(damage: number, hitterPartyIndex: number): void {
    const wasMaxTier = this.type.isMaxTier();

    this.attributes.health = Math.max(0, this.attributes.health - damage);
    this.hit.notify(null);

    if (this.isAlive()) {
      return;
    }

    if (wasMaxTier) {
      this.type.increaseTier(TankTier.C);
      this.applyTier(true);
      return;
    }

    this.die(TankDeathReason.Bullet, hitterPartyIndex);
  }

  private applyTier(notify: boolean): void {
    this.attributes = TankAttributesFactory.create(this.type);
    this.attributes.health += this.runBoostBonusHealth;
    this.applySpeedBoost();
    this.skinAnimation = this.tierSkinAnimations.get(this.type.tier);

    if (notify === true) {
      this.upgraded.notify({ tier: this.type.tier });
    }
  }

  private applySpeedBoost(): void {
    const baseAttributes = TankAttributesFactory.create(this.type);
    this.attributes.moveSpeed =
      baseAttributes.moveSpeed *
      this.speedBoostMultiplier *
      this.runBoostSpeedMultiplier;
  }

  private handleSpeedBoostTimer = (): void => {
    this.speedBoostMultiplier = 1;
    this.applySpeedBoost();
  };
}
