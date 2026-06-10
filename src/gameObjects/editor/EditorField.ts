import { BoxCollider, GameObject } from '../../core';
import { GameUpdateArgs, Rotation, Tag } from '../../game';
import { Base } from '../../gameObjects';
import { MapConfig } from '../../map';
import { TankColor, TankColorFactory, TankType } from '../../tank';
import * as config from '../../config';

import { EditorTankDummy } from './EditorTankDummy';

export class EditorField extends GameObject {
  private base: Base;
  private mapConfig: MapConfig;
  private playerDummies: EditorTankDummy[] = [];
  private enemyDummies: EditorTankDummy[] = [];

  constructor(mapConfig: MapConfig) {
    super(mapConfig.getFieldWidth(), mapConfig.getFieldHeight());

    this.mapConfig = mapConfig;
  }

  protected setup({ collisionSystem }: GameUpdateArgs): void {
    this.base = new Base();
    this.base.collider = new BoxCollider(this.base, false);
    this.base.position.copyFrom(this.mapConfig.getBasePosition());
    collisionSystem.register(this.base.collider);
    this.add(this.base);

    this.mapConfig.getPlayerSpawnPositions().forEach((location, index) => {
      const dummy = new EditorTankDummy(
        TankType.PlayerA(),
        TankColorFactory.createPlayerColor(index),
        Rotation.Up,
        false,
      );
      dummy.position.set(location.x, location.y);
      this.add(dummy);
      this.playerDummies[index] = dummy;
    });

    this.mapConfig.getEnemySpawnPositions().forEach((location, index) => {
      const dummy = new EditorTankDummy(
        TankType.EnemyA(),
        TankColor.Default,
        Rotation.Down,
        false,
      );
      dummy.position.set(location.x, location.y);
      this.add(dummy);
      this.enemyDummies[index] = dummy;
    });
  }

  protected update(): void {
    this.base.collider.update();
  }

  public setPlayerSpawnPosition(index: number, x: number, y: number): void {
    const dummy = this.playerDummies[index];
    if (dummy === undefined) {
      return;
    }

    dummy.dirtyPaintBox();
    dummy.position.set(x, y);
    dummy.updateMatrix(true);
    dummy.setNeedsPaint();
  }

  public setEnemySpawnPosition(index: number, x: number, y: number): void {
    const dummy = this.enemyDummies[index];
    if (dummy === undefined) {
      return;
    }

    dummy.dirtyPaintBox();
    dummy.position.set(x, y);
    dummy.updateMatrix(true);
    dummy.setNeedsPaint();
  }

  public setBasePosition(x: number, y: number): void {
    this.base.dirtyPaintBox();
    this.base.position.set(x, y);
    this.base.updateMatrix(true);
    this.base.setNeedsPaint();
  }
}
