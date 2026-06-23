import { Prng } from '../core';
import { Powerup } from '../gameObjects';

import { PowerupType } from './PowerupType';

// Configure which powerups can be spawned randomly
const AVAILABLE_TYPES = [
  PowerupType.BaseDefence,
  PowerupType.Freeze,
  PowerupType.Life,
  PowerupType.Shield,
  PowerupType.Upgrade,
  PowerupType.Wipeout,
];

export class PowerupFactory {
  public static create(type: PowerupType): Powerup {
    const powerup = new Powerup(type);
    return powerup;
  }

  public static createRandom(rng: Prng): Powerup {
    const type = rng.arrayElement(AVAILABLE_TYPES);
    const powerup = new Powerup(type);
    return powerup;
  }
}
