import { GameUpdateArgs } from '../game/GameUpdateArgs';
import { Tank } from '../gameObjects/Tank';

export abstract class TankBehavior {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public setup(tank: Tank, updateArgs?: GameUpdateArgs): void {
    // Virtual
  }
  public abstract update(tank: Tank, updateArgs?: GameUpdateArgs): void;
}
