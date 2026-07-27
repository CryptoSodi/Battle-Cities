import { Rotation } from '../../game';
import { PlayerTank } from '../../gameObjects';

export interface RemotePlayerInput {
  seq: number;
  direction: Rotation | null;
  moving: boolean;
  fire: boolean;
}

export function applyRemotePlayerInput(
  tank: PlayerTank,
  input: RemotePlayerInput,
  deltaTime: number,
  lastFireSeq: number,
): number {
  let appliedFireSeq = lastFireSeq;
  if (input.fire && input.seq > lastFireSeq) {
    appliedFireSeq = input.seq;
    tank.fire();
  }

  if (tank.isStunned()) {
    tank.idle(false);
    return appliedFireSeq;
  }

  if (input.direction !== null) {
    tank.rotate(input.direction);
  }
  if (input.moving && input.direction !== null) {
    tank.move(deltaTime);
    return appliedFireSeq;
  }

  tank.idle();
  return appliedFireSeq;
}
