import {
  GameObject,
  SpriteAlignment,
  SpritePainter,
  SpriteLoader,
} from '../core';
import { Rotation } from '../game';
import {
  TankColor,
  TankColorFactory,
  TankSkinAnimation,
  TankTier,
  TankType,
} from '../tank';
import * as config from '../config';

import { GhostBullet } from './GhostBullet';
import { TankState } from './Tank';

const GHOST_OPACITY = 0.5;
const GHOST_TINT = 'rgb(120, 200, 255)';
const GHOST_SMOOTHING = 0.45;

export class GhostTank extends GameObject {
  public partyIndex = 0;
  public state = TankState.Idle;
  public type = TankType.PlayerA();
  public rotation = Rotation.Up;
  private targetX = 0;
  private targetY = 0;
  private hasTarget = false;
  private tierSkinAnimations = new Map<TankTier, TankSkinAnimation>();

  constructor(partyIndex: number) {
    super(64, 64);

    this.partyIndex = partyIndex;
    this.pivot.set(0.5, 0.5);
    this.setZIndex(config.PLAYER_TANK_Z_INDEX + 1);
  }

  public applySnapshot(
    x: number,
    y: number,
    rotation: Rotation,
    state: TankState,
    tier: TankTier,
  ): void {
    this.targetX = x;
    this.targetY = y;
    if (!this.hasTarget) {
      this.position.set(x, y);
      this.hasTarget = true;
    }
    this.rotation = rotation;
    this.state = state;
    this.type = this.getType(tier);
    this.updateMatrix(true);
    this.setVisible(true);
  }

  public spawnGhostFire(): void {
    const bullet = new GhostBullet();
    bullet.updateMatrix();
    bullet.setCenter(this.getSelfCenter());
    bullet.translateY(this.size.height / 2 - bullet.size.height / 2);
    bullet.updateMatrix();
    this.add(bullet);
    this.parent.attach(bullet);
  }

  protected setup({ spriteLoader }: { spriteLoader: SpriteLoader }): void {
    const colors = [TankColorFactory.createPlayerColor(this.partyIndex)];

    this.tierSkinAnimations.set(
      TankTier.A,
      new TankSkinAnimation(spriteLoader, TankType.PlayerA(), colors),
    );
    this.tierSkinAnimations.set(
      TankTier.B,
      new TankSkinAnimation(spriteLoader, TankType.PlayerB(), colors),
    );
    this.tierSkinAnimations.set(
      TankTier.C,
      new TankSkinAnimation(spriteLoader, TankType.PlayerC(), colors),
    );
    this.tierSkinAnimations.set(
      TankTier.D,
      new TankSkinAnimation(spriteLoader, TankType.PlayerD(), colors),
    );

    const layer = new GameObject();
    layer.size.copyFrom(this.size);

    const painter = new SpritePainter(null, SpriteAlignment.MiddleCenter);
    painter.opacity = GHOST_OPACITY;
    painter.tintColor = GHOST_TINT;
    painter.tintAlpha = 0.35;

    layer.painter = painter;
    this.add(layer);
  }

  protected update({ deltaTime }: { deltaTime: number }): void {
    if (this.hasTarget) {
      const nextX = this.position.x + (this.targetX - this.position.x) * GHOST_SMOOTHING;
      const nextY = this.position.y + (this.targetY - this.position.y) * GHOST_SMOOTHING;
      if (this.position.x !== nextX || this.position.y !== nextY) {
        this.dirtyPaintBox();
        this.position.set(nextX, nextY);
        this.updateMatrix(true);
        this.setNeedsPaint();
      }
    }

    const animation = this.tierSkinAnimations.get(this.type.tier);
    if (animation === undefined) {
      return;
    }

    animation.update(this as any, deltaTime);
    const sprite = animation.getCurrentFrame().getSprite(0);

    this.children.forEach((layer) => {
      const painter = layer.painter as SpritePainter;
      painter.sprite = sprite;
    });
  }

  private getType(tier: TankTier): TankType {
    switch (tier) {
      case TankTier.B:
        return TankType.PlayerB();
      case TankTier.C:
        return TankType.PlayerC();
      case TankTier.D:
        return TankType.PlayerD();
      case TankTier.A:
      default:
        return TankType.PlayerA();
    }
  }
}
