import { GameUpdateArgs, Rotation } from '../../game';
import { PlayerTank, TankState } from '../../gameObjects';
import { LevelPlayInputContext } from '../../input';

import { TankBehavior } from '../TankBehavior';

const MOVE_CONTROLS = [
  ...LevelPlayInputContext.MoveUp,
  ...LevelPlayInputContext.MoveDown,
  ...LevelPlayInputContext.MoveLeft,
  ...LevelPlayInputContext.MoveRight,
];

export class PlayerTankBehavior extends TankBehavior {
  public update(tank: PlayerTank, updateArgs: GameUpdateArgs): void {
    const { deltaTime, inputManager, session } = updateArgs;

    if (updateArgs.webRtcMatch.handlePlayerTank(tank, updateArgs)) {
      return;
    }

    if (tank.partyIndex === 0 && updateArgs.magicBlockMovement.isWatching()) {
      tank.idle(false);
      return;
    }

    if (updateArgs.magicBlockMovement.isRemoteTank(tank.partyIndex)) {
      tank.idle(false);
      return;
    }

    if (updateArgs.magicBlockMovement.isLocalServerMatchWaitingForStart()) {
      tank.idle(false);
      return;
    }

    let inputMethod = inputManager.getActiveMethod();

    // Same-screen multiplayer needs separate input variants. In an online
    // MagicBlock match each browser owns only one tank, so both player one and
    // player two must keep that browser's standard controls.
    if (
      session.isMultiplayer() &&
      !updateArgs.magicBlockMovement.isOnlineMatch() &&
      !updateArgs.webRtcMatch.isEnabled()
    ) {
      const playerSession = session.getPlayer(tank.partyIndex);
      const playerInputVariant = playerSession.getInputVariant();
      inputMethod = inputManager.getMethodByVariant(playerInputVariant);
    }

    // WARNING: order is important. Make sure to keep fire updates before
    // movement updates. Fire places bullet based on tank position.
    // Tank position changes during movement, and later can be corrected by
    // collision resolution algorithm after update phase. This order issue
    // can be fixed by adding some post-collide callback and place fire code
    // in there.
    if (inputMethod.isDownAny(LevelPlayInputContext.Fire)) {
      if (updateArgs.magicBlockMovement.isLocalServerMatch()) {
        updateArgs.magicBlockMovement.recordLocalFire(tank);
      } else if (tank.fire()) {
        this.disableLocalBulletDamageInAuthoritativeMatch(tank, updateArgs);
        updateArgs.magicBlockMovement.recordLocalFire(tank);
      }
    }
    if (inputMethod.isHoldAny(LevelPlayInputContext.RapidFire)) {
      if (updateArgs.magicBlockMovement.isLocalServerMatch()) {
        updateArgs.magicBlockMovement.recordLocalFire(tank);
      } else if (tank.fire()) {
        this.disableLocalBulletDamageInAuthoritativeMatch(tank, updateArgs);
        updateArgs.magicBlockMovement.recordLocalFire(tank);
      }
    }

    if (!tank.isSliding() && !tank.isStunned()) {
      // Drive rotation + movement off the most-recently-held DIRECTION key,
      // ignoring any other held keys (fire, etc.) in between. Using the
      // device's global "last key" here let a fire press freeze rotation and
      // leave the tank moving in a stale direction.
      const directions: [number[], Rotation][] = [
        [LevelPlayInputContext.MoveUp, Rotation.Up],
        [LevelPlayInputContext.MoveDown, Rotation.Down],
        [LevelPlayInputContext.MoveLeft, Rotation.Left],
        [LevelPlayInputContext.MoveRight, Rotation.Right],
      ];

      let bestIndex = -1;
      let bestRotation: Rotation = null;
      for (const [controls, rotation] of directions) {
        const index = inputMethod.getHoldLastIndex(controls);
        if (index > bestIndex) {
          bestIndex = index;
          bestRotation = rotation;
        }
      }

      if (bestRotation !== null) {
        tank.rotate(bestRotation);
        tank.move(deltaTime);
      }
    }

    if (
      inputMethod.isNotHoldAll(MOVE_CONTROLS) &&
      tank.state !== TankState.Idle
    ) {
      tank.idle();
    }
  }

  private disableLocalBulletDamageInAuthoritativeMatch(
    tank: PlayerTank,
    updateArgs: GameUpdateArgs,
  ): void {
    if (!updateArgs.magicBlockMovement.isOnlineMatch()) {
      return;
    }
    tank.bullets[tank.bullets.length - 1]?.setLocalDamageDisabled(true);
  }
}
