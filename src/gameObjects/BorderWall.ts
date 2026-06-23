import {
  Animation,
  BoxCollider,
  GameObject,
  Sprite,
  SpritePainter,
} from '../core';
import { GameUpdateArgs, Tag } from '../game';
import * as config from '../config';

export class BorderWall extends GameObject {
  public collider = new BoxCollider(this);
  public tags = [Tag.Wall, Tag.Border, Tag.BlockMove];
  public zIndex = config.BORDER_WALL_Z_INDEX;

  private animation: Animation<Sprite>;
  private tilePainters: SpritePainter[] = [];

  protected setup({ collisionSystem, spriteLoader }: GameUpdateArgs): void {
    collisionSystem.register(this.collider);

    // Data-driven frame count: animates terrain.water.1..N (8 today).
    this.animation = new Animation(spriteLoader.loadSequence('terrain.water'), {
      delay: 0.333,
      loop: true,
    });

    const tileSize = config.WATER_TILE_SIZE;
    const columns = Math.ceil(this.size.width / tileSize);
    const rows = Math.ceil(this.size.height / tileSize);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const tile = new GameObject(tileSize, tileSize);
        const painter = new SpritePainter(this.animation.getCurrentFrame());

        tile.position.set(column * tileSize, row * tileSize);
        tile.painter = painter;

        this.tilePainters.push(painter);
        this.add(tile);
      }
    }
  }

  protected update(updateArgs: GameUpdateArgs): void {
    this.collider.update();

    this.animation.update(updateArgs.deltaTime);
    const frame = this.animation.getCurrentFrame();

    this.tilePainters.forEach((painter) => {
      painter.sprite = frame;
    });
    this.setNeedsPaint();
  }
}
