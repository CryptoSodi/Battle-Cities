import { Rotation } from '../../game';
import { PlayerTank } from '../../gameObjects';

export interface RemotePlayerInput {
  seq: number;
  direction: Rotation | null;
  moving: boolean;
  fire: boolean;
}

function applyPlayerInputCommand(
  tank: PlayerTank,
  input: RemotePlayerInput,
  deltaTime: number,
  checkIce = true,
): void {
  if (tank.isStunned()) {
    tank.idle(false);
    return;
  }

  if (input.direction !== null) {
    tank.rotate(input.direction);
  }
  if (input.moving && input.direction !== null) {
    tank.move(deltaTime);
    return;
  }

  tank.idle(checkIce);
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

  applyPlayerInputCommand(tank, input, deltaTime);
  return appliedFireSeq;
}
