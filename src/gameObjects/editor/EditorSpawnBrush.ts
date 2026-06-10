import { Rotation } from '../../game';
import { TankColor, TankColorFactory, TankType } from '../../tank';
import * as config from '../../config';

import { EditorTankDummy } from './EditorTankDummy';

export enum EditorSpawnType {
  Player0,
  Player1,
  Enemy0,
  Enemy1,
  Enemy2,
}

export class EditorSpawnBrush extends EditorTankDummy {
  public readonly spawnType: EditorSpawnType;
  public zIndex = config.EDITOR_BRUSH_Z_INDEX;

  constructor(spawnType: EditorSpawnType) {
    super(
      EditorSpawnBrush.getTankType(spawnType),
      EditorSpawnBrush.getTankColor(spawnType),
      EditorSpawnBrush.getRotation(spawnType),
    );

    this.spawnType = spawnType;
  }

  private static getTankType(spawnType: EditorSpawnType): TankType {
    if (
      spawnType === EditorSpawnType.Player0 ||
      spawnType === EditorSpawnType.Player1
    ) {
      return TankType.PlayerA();
    }

    return TankType.EnemyA();
  }

  private static getTankColor(spawnType: EditorSpawnType): TankColor {
    if (spawnType === EditorSpawnType.Player0) {
      return TankColorFactory.createPlayerColor(0);
    }
    if (spawnType === EditorSpawnType.Player1) {
      return TankColorFactory.createPlayerColor(1);
    }

    return TankColor.Default;
  }

  private static getRotation(spawnType: EditorSpawnType): Rotation {
    if (
      spawnType === EditorSpawnType.Player0 ||
      spawnType === EditorSpawnType.Player1
    ) {
      return Rotation.Up;
    }

    return Rotation.Down;
  }
}
