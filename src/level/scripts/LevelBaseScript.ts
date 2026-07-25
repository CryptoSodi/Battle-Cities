import { Rect, Timer } from '../../core';
import { GameUpdateArgs } from '../../game';
import { Base, TerrainTile } from '../../gameObjects';
import { PowerupType } from '../../powerup';
import { TerrainFactory, TerrainType } from '../../terrain';
import * as config from '../../config';
import { LevelScript } from '../LevelScript';
import { LevelPowerupPickedEvent } from '../events';

const WALL_REGIONS = [
  { x: 0, y: 0, width: 128, height: 32 },
  { x: 0, y: 32, width: 32, height: 64 },
  { x: 96, y: 32, width: 32, height: 64 },
] as const;

export class LevelBaseScript extends LevelScript {
  private base: Base;
  private defenceTimer = new Timer();
  private readonly isWebRtcMatch =
    new URLSearchParams(window.location.search).get('mode') === 'webrtc';

  protected setup(): void {
    this.eventBus.powerupPicked.addListener(this.handlePowerupPicked);
    this.defenceTimer.done.addListener(this.restoreBrickWalls);

    this.base = new Base();
    this.base.position.copyFrom(this.mapConfig.getBasePosition());
    this.base.died.addListener(() => {
      this.eventBus.baseDied.notify(null);
    });
    this.world.field.add(this.base);
  }

  protected update(updateArgs: GameUpdateArgs): void {
    if (this.isWebRtcMatch) {
      this.defenceTimer.update(updateArgs.deltaTime);
    }
  }

  private handlePowerupPicked = (event: LevelPowerupPickedEvent): void => {
    const { type: powerupType } = event;

    if (powerupType === PowerupType.BaseDefence) {
      if (this.isWebRtcMatch) {
        this.replaceBaseWalls(TerrainType.Steel);
        this.defenceTimer.reset(config.BASE_DEFENCE_POWERUP_DURATION);
        return;
      }
      this.base.activateDefence(config.BASE_DEFENCE_POWERUP_DURATION);
    }
  };

  private restoreBrickWalls = (): void => {
    this.replaceBaseWalls(TerrainType.Brick);
  };

  private replaceBaseWalls(type: TerrainType): void {
    const basePosition = this.mapConfig.getBasePosition();
    const regions = WALL_REGIONS.map((region) => {
      return new Rect(
        basePosition.x + region.x,
        basePosition.y + region.y,
        region.width,
        region.height,
      );
    });

    [...this.world.field.children].forEach((node) => {
      if (!(node instanceof TerrainTile)) {
        return;
      }
      const isBaseWall = regions.some((region) => {
        return (
          node.position.x >= region.x &&
          node.position.x < region.x + region.width &&
          node.position.y >= region.y &&
          node.position.y < region.y + region.height
        );
      });
      if (isBaseWall) {
        node.destroy(false);
      }
    });

    const baseRect = new Rect(
      basePosition.x,
      basePosition.y,
      config.BASE_DEFAULT_SIZE.width,
      config.BASE_DEFAULT_SIZE.height,
    );
    const tiles = TerrainFactory.createMapFromRegionConfigs(
      regions.map((region) => ({
        type,
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
      })),
      this.world.field.size.width,
      this.world.field.size.height,
      [baseRect],
    );
    tiles.forEach((tile) => {
      tile.destroyed.addListener(() => {
        this.eventBus.mapTileDestroyed.notify({
          type: tile.type,
          position: tile.position.clone(),
          size: tile.size.clone(),
        });
      });
    });
    this.world.field.add(...tiles);
    this.world.field.setNeedsPaint();
  }
}
