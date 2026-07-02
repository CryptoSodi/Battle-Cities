import { DeviceInputFrame } from '../core';
import { GameStorage, SessionRunConsumables } from '../game';
import { InputDeviceType } from '../input';
import * as config from '../config';

import { EnemyMovementFrame } from './EnemyMovementFrame';
import { PowerupSpawnFrame } from './PowerupSpawnFrame';

// Everything needed to reproduce a match: the level it was played on, the
// Prng seed the simulation started with, every input device's per-tick log
// (keyed the same way InputManager.startRecording()/startReplay() key their
// Record<string, DeviceInputFrame[]>), which device single-player input was
// reading from when recording began (see InputManager.activeDeviceType -- it
// isn't derivable from the device logs alone, since it's an InputManager-
// level routing decision, not part of any one device's own state), each
// enemy's recorded movement (keyed by partyIndex) -- see EnemyMovementFrame
// -- and every powerup spawn's chosen type/position in order -- see
// PowerupSpawnFrame. Plain data -- round-trips through JSON.stringify/parse
// with no custom (de)serialization.
export interface SavedReplay {
  seed: number;
  levelNumber: number;
  deviceFrames: Record<string, DeviceInputFrame[]>;
  activeDeviceType: InputDeviceType;
  runConsumables: SessionRunConsumables;
  enemyTraces: Record<number, EnemyMovementFrame[]>;
  powerupSpawns: PowerupSpawnFrame[];
}

export function saveReplay(gameStorage: GameStorage, replay: SavedReplay): void {
  gameStorage.set(config.STORAGE_KEY_DEBUG_LAST_REPLAY, JSON.stringify(replay));
  gameStorage.save();
}

// Returns null if nothing has been recorded yet, or what's stored doesn't
// look like a SavedReplay (e.g. an older/incompatible format).
export function loadReplay(gameStorage: GameStorage): SavedReplay | null {
  const json = gameStorage.get(config.STORAGE_KEY_DEBUG_LAST_REPLAY);

  if (json === undefined || json === null) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  const isValid =
    typeof parsed === 'object' &&
    parsed !== null &&
    typeof parsed.seed === 'number' &&
    typeof parsed.levelNumber === 'number' &&
    typeof parsed.deviceFrames === 'object' &&
    parsed.deviceFrames !== null &&
    typeof parsed.activeDeviceType === 'number' &&
    typeof parsed.enemyTraces === 'object' &&
    parsed.enemyTraces !== null &&
    Array.isArray(parsed.powerupSpawns);

  if (!isValid) {
    return null;
  }

  if (parsed.runConsumables === undefined) {
    parsed.runConsumables = createEmptyRunConsumables();
  }

  if (!isValidRunConsumables(parsed.runConsumables)) {
    return null;
  }

  return parsed as SavedReplay;
}

function createEmptyRunConsumables(): SessionRunConsumables {
  return {
    powerups: [],
    powerupItems: [],
    powerupCounts: [],
    extraLives: 0,
  };
}

function isValidRunConsumables(value: any): boolean {
  if (
    typeof value !== 'object' ||
    value === null ||
    !Array.isArray(value.powerups) ||
    !Array.isArray(value.powerupItems) ||
    typeof value.extraLives !== 'number'
  ) {
    return false;
  }

  if (value.powerupCounts === undefined) {
    value.powerupCounts = value.powerupItems.map(() => 1);
  }

  return Array.isArray(value.powerupCounts);
}
