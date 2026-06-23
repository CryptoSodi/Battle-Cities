import { GameObject } from '../core';
import { Painter } from '../core/Painter';
import { RenderContext } from '../core/render';
import { RenderObject } from '../core/RenderObject';
import { TerrainType } from '../terrain';

import { Base } from './Base';
import { EnemyTank } from './EnemyTank';
import { PlayerTank } from './PlayerTank';
import { TerrainTile } from './TerrainTile';

const BG_COLOR = 'rgba(8, 10, 14, 0.62)';
const FRAME_COLOR = 'rgba(150, 162, 138, 0.5)';
const PLAYER_COLOR = '#e3c25e';
const ENEMY_COLOR = '#d6402c';
const BASE_COLOR = '#9bbd55';

// Terrain is drawn dim so the bright unit dots read on top of it.
function terrainColor(type: TerrainType): string {
  switch (type) {
    case TerrainType.Brick:
      return '#7a3a22';
    case TerrainType.Steel:
      return '#5a6470';
    case TerrainType.Water:
      return '#27517f';
    case TerrainType.Jungle:
      return '#2f5a2f';
    case TerrainType.Ice:
      return '#9fc2d6';
    default:
      // BrickSuper (invisible container) and menu/editor bricks: skip.
      return null;
  }
}

// Reads live entity + terrain positions from the field every paint, so it stays
// in sync (destroyed walls vanish here too) without any per-tick update.
// Positions are field-local (world center minus the field's world origin) so
// the minimap is unaffected by camera scrolling. Cosmetic only.
class MinimapPainter extends Painter {
  public paint(context: RenderContext, renderObject: RenderObject): void {
    const minimap = renderObject as Minimap;
    const box = minimap.getWorldBoundingBox().toRect();

    context.fillRect(box.x, box.y, box.width, box.height, BG_COLOR);

    const field = minimap.field.getWorldBoundingBox().toRect();
    const scaleX = box.width / minimap.fieldWidth;
    const scaleY = box.height / minimap.fieldHeight;
    const toMiniX = (worldX: number): number => box.x + (worldX - field.x) * scaleX;
    const toMiniY = (worldY: number): number => box.y + (worldY - field.y) * scaleY;

    const tiles: { node: TerrainTile; color: string }[] = [];
    const units: { node: RenderObject; color: string; dot: number }[] = [];

    minimap.field.traverseDescedants((node) => {
      if (node instanceof TerrainTile) {
        const color = terrainColor(node.type);
        if (color !== null) {
          tiles.push({ node, color });
        }
      } else if (node instanceof PlayerTank) {
        units.push({ node, color: PLAYER_COLOR, dot: 4 });
      } else if (node instanceof EnemyTank) {
        units.push({ node, color: ENEMY_COLOR, dot: 3 });
      } else if (node instanceof Base) {
        units.push({ node, color: BASE_COLOR, dot: 5 });
      }
    });

    // Terrain layer.
    tiles.forEach(({ node, color }) => {
      const r = node.getWorldBoundingBox().toRect();
      const mx = Math.round(toMiniX(r.x));
      const my = Math.round(toMiniY(r.y));
      const mw = Math.max(1, Math.ceil(r.width * scaleX));
      const mh = Math.max(1, Math.ceil(r.height * scaleY));
      context.fillRect(mx, my, mw, mh, color);
    });

    // Units on top, as centered dots.
    units.forEach(({ node, color, dot }) => {
      const r = node.getWorldBoundingBox().toRect();
      const mx = toMiniX(r.x + r.width / 2);
      const my = toMiniY(r.y + r.height / 2);
      context.fillRect(
        Math.round(mx - dot / 2),
        Math.round(my - dot / 2),
        dot,
        dot,
        color,
      );
    });

    // Frame on top so it stays crisp over the contents.
    context.strokeRect(box.x, box.y, box.width, box.height, FRAME_COLOR);
  }
}

export class Minimap extends GameObject {
  public zIndex = 1000;
  public readonly painter = new MinimapPainter();
  public readonly field: GameObject;
  public readonly fieldWidth: number;
  public readonly fieldHeight: number;

  constructor(
    field: GameObject,
    fieldWidth: number,
    fieldHeight: number,
    width: number,
    height: number,
  ) {
    super(width, height);

    this.field = field;
    this.fieldWidth = fieldWidth;
    this.fieldHeight = fieldHeight;
  }
}
