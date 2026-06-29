import { Subject, Timer } from '../core';
import { GameUpdateArgs, Tag } from '../game';
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

  protected setup(updateArgs: GameUpdateArgs): void {
    const { spriteLoader } = updateArgs;

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
    this.applySpeedBoost();
    this.skinAnimation = this.tierSkinAnimations.get(this.type.tier);

    if (notify === true) {
      this.upgraded.notify({ tier: this.type.tier });
    }
  }

  private applySpeedBoost(): void {
    const baseAttributes = TankAttributesFactory.create(this.type);
    this.attributes.moveSpeed =
      baseAttributes.moveSpeed * this.speedBoostMultiplier;
  }

  private handleSpeedBoostTimer = (): void => {
    this.speedBoostMultiplier = 1;
    this.applySpeedBoost();
  };
}
