import { DeviceInputFrame } from '../core';
import { GameStorage } from '../game';
import * as config from '../config';

// Everything needed to reproduce a match: the level it was played on, the
// Prng seed the simulation started with, and every input device's per-tick
// log (keyed the same way InputManager.startRecording()/startReplay() key
// their Record<string, DeviceInputFrame[]>). Plain data -- round-trips
// through JSON.stringify/parse with no custom (de)serialization.
export interface SavedReplay {
  seed: number;
  levelNumber: number;
  deviceFrames: Record<string, DeviceInputFrame[]>;
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
    parsed.deviceFrames !== null;

  return isValid ? (parsed as SavedReplay) : null;
}
