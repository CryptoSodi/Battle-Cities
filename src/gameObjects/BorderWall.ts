import { BoxCollider, GameObject, SpritePainter } from '../core';
import { GameUpdateArgs, Tag } from '../game';
import * as config from '../config';

export class BorderWall extends GameObject {
  public collider = new BoxCollider(this);
  public tags = [Tag.Wall, Tag.Border, Tag.BlockMove];
  public zIndex = config.BORDER_WALL_Z_INDEX;

  protected setup({ collisionSystem, spriteLoader }: GameUpdateArgs): void {
    collisionSystem.register(this.collider);

    const sprite = spriteLoader.load('terrain.border-steel');
    const tileSize = config.STEEL_TILE_SIZE;
    const columns = Math.ceil(this.size.width / tileSize);
    const rows = Math.ceil(this.size.height / tileSize);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const tile = new GameObject(tileSize, tileSize);

        tile.position.set(column * tileSize, row * tileSize);
        tile.painter = new SpritePainter(sprite);

        this.add(tile);
      }
    }
  }

  protected update(): void {
    this.collider.update();
  }
}
