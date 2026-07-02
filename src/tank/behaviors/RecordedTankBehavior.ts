import { Tank } from '../../gameObjects';
import { EnemyMovementFrame } from '../../replay';

import { TankBehavior } from '../TankBehavior';

// Replays a recorded enemy's movement verbatim instead of deciding anything:
// each tick, teleport the tank straight to that tick's recorded position/
// rotation and re-fire if the original did. This drives the tank's real
// transform, so its real collider still sees it in the right place each tick
// (Tank.update() refreshes the collider right after the behavior runs) --
// other tanks and bullets interact with it exactly as they would with a live
// AiTankBehavior-driven tank.
//
// Ticks are counted from this behavior's own first update() call, which must
// line up with the tick the matching trace was recorded from (i.e. this
// enemy's own spawn) -- see LevelEnemyScript's recording/replay wiring.
export class RecordedTankBehavior extends TankBehavior {
  private readonly trace: EnemyMovementFrame[];
  private tickIndex = 0;

  constructor(trace: EnemyMovementFrame[]) {
    super();

    this.trace = trace;
  }

  public update(tank: Tank): void {
    const frame = this.trace[this.tickIndex];
    this.tickIndex += 1;

    // Recording ended before this tick (e.g. the original tank had already
    // died by now) -- nothing left to re-enact.
    if (frame === undefined) {
      return;
    }

    // Set rotation directly rather than via tank.rotate(): that method snaps
    // position to the movement grid on a rotation change, which would
    // override the exact recorded position set below.
    tank.rotation = frame.rotation;
    tank.position.set(frame.x, frame.y);
    tank.updateMatrix(true);

    if (frame.fired) {
      tank.fire();
    }
  }
}
