import { Collision, Sound } from '../core';
import { SpritePainter } from '../core';
import { GameState } from '../game/GameState';
import { GameUpdateArgs } from '../game/GameUpdateArgs';
import { Tag } from '../game/Tag';
import { TankColor } from '../tank/TankColor';
import { TankSkinAnimation } from '../tank/TankSkinAnimation';
import { TankTier } from '../tank/TankTier';
import * as config from '../config';

import { Tank, TankCollisionResolution } from './Tank';

export class EnemyTank extends Tank {
  public tags = [Tag.Tank, Tag.Enemy];
  public zIndex = config.ENEMY_TANK_Z_INDEX;
  private healthSkinAnimations = new Map<number, TankSkinAnimation>();
  private hitSound: Sound;
  private dropBlinkElapsed = 0;
  private networkControlled = false;

  public setNetworkControlled(controlled: boolean): this {
    this.networkControlled = controlled;
    return this;
  }

  public beginNetworkDeathGrace(): void {
    this.tags = [Tag.Enemy];
    this.setVisible(false);
  }

  public finishNetworkRemoval(): void {
    this.collider.unregister();
    this.removeSelf();
  }

  public applyNetworkHealth(health: number): void {
    const wasHit = health < this.attributes.health;
    this.attributes.health = Math.max(0, health);
    const animation = this.healthSkinAnimations.get(this.attributes.health);
    if (animation !== undefined) {
      this.skinAnimation = animation;
    }
    if (wasHit) {
      this.hit.notify(null);
      if (this.type.hasDrop) {
        this.discardDrop();
      }
    }
  }

  protected setup(updateArgs: GameUpdateArgs): void {
    const { audioLoader, spriteLoader } = updateArgs;

    this.hitSound = audioLoader.load('hit.enemy');

    // Tanks with drop should be blinking when paused
    if (this.type.hasDrop) {
      this.ignorePause = true;
    }

    // Currently only tier D tank has more than 1 health
    if (this.type.tier === TankTier.D) {
      this.healthSkinAnimations.set(
        4,
        new TankSkinAnimation(spriteLoader, this.type, [
          TankColor.Default,
          TankColor.Secondary,
        ]),
      );

      this.healthSkinAnimations.set(
        3,
        new TankSkinAnimation(spriteLoader, this.type, [
          TankColor.Default,
          TankColor.Primary,
        ]),
      );

      this.healthSkinAnimations.set(
        2,
        new TankSkinAnimation(spriteLoader, this.type, [
          TankColor.Secondary,
          TankColor.Primary,
        ]),
      );
    }

    this.healthSkinAnimations.set(
      1,
      new TankSkinAnimation(spriteLoader, this.type, [TankColor.Default]),
    );

    this.skinAnimation = this.healthSkinAnimations.get(this.attributes.health);

    super.setup(updateArgs);
  }

  protected update(updateArgs: GameUpdateArgs): void {
    const { gameState } = updateArgs;

    if (this.networkControlled) {
      this.updateCollisionStates();
      this.collider.update();
      this.updateAnimation(updateArgs.deltaTime);
      this.setNeedsPaint();
      return;
    }

    const shouldIdle =
      this.freezeState.hasChangedTo(true) ||
      gameState.hasChangedTo(GameState.Paused);

    if (shouldIdle) {
      this.idle();
    }

    const isIdle = this.freezeState.is(true) || gameState.is(GameState.Paused);

    // Only update animation when idle, other components should not receive
    // updates
    if (isIdle) {
      this.updateCollisionStates();

      // When tank spawns during freeze his collision box should be updated
      this.collider.update();
      this.tankCollisionResolution = TankCollisionResolution.Unknown;

      // Tanks with drop should be blinking when paused or freezed
      this.updateAnimation(updateArgs.deltaTime);
      this.setNeedsPaint();
      return;
    }

    super.update(updateArgs);
  }

  protected receiveHit(damage: number, hitterPartyIndex: number): void {
    if (this.networkControlled) {
      return;
    }
    super.receiveHit(damage, hitterPartyIndex);

    if (!this.isAlive()) {
      return;
    }

    this.hitSound.play();

    // Enemy drop powerup on first hit
    // - for tiers A,B,C - on death, because they have 1 health
    // - for tier D - on first hit, because they have 4 health
    // Make sure tier D won't drop powerup after first hit.
    this.discardDrop();

    // Change skin based on number of health left
    this.skinAnimation = this.healthSkinAnimations.get(this.attributes.health);
  }

  protected collide(collision: Collision): void {
    if (this.networkControlled) {
      this.collideBullets(collision);
      return;
    }
    super.collide(collision);
  }

  public discardDrop(): this {
    this.type.hasDrop = false;
    this.ignorePause = false;
    this.dropBlinkElapsed = 0;

    // Refresh animation state after the drop marker is removed.
    this.healthSkinAnimations.forEach((animation) => {
      animation.updateFrames();
    });

    return this;
  }

  protected updateAnimation(
    deltaTime: number,
    advanceFrames = true,
  ): void {
    super.updateAnimation(deltaTime, advanceFrames);

    const shouldTint = this.type.hasDrop && this.isDropBlinkVisible(deltaTime);

    this.skinLayers.forEach((layer) => {
      const painter = layer.painter as SpritePainter;
      painter.tintColor = shouldTint ? config.ENEMY_DROP_BLINK_COLOR : null;
      painter.tintAlpha = shouldTint ? config.ENEMY_DROP_BLINK_ALPHA : 0;
    });
  }

  private isDropBlinkVisible(deltaTime: number): boolean {
    if (!this.type.hasDrop) {
      this.dropBlinkElapsed = 0;
      return false;
    }

    this.dropBlinkElapsed += deltaTime;

    return (
      Math.floor(this.dropBlinkElapsed / config.ENEMY_DROP_BLINK_INTERVAL) %
        2 ===
      1
    );
  }
}
