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

export interface SavedReplaySummary {
  id: string;
  createdAt: string;
  levelNumber: number;
}

export interface SavedReplayRecord extends SavedReplaySummary {
  replay: SavedReplay;
}

export async function saveReplay(
  gameStorage: GameStorage,
  replay: SavedReplay,
): Promise<void> {
  gameStorage.set(config.STORAGE_KEY_DEBUG_LAST_REPLAY, JSON.stringify(replay));
  gameStorage.save();

  try {
    await fetch('/api/replays', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        guestId: getReplayGuestId(gameStorage),
        replay,
      }),
    });
  } catch {
    // Server replay storage is best-effort for now; localStorage remains the
    // fallback so recording does not break local webpack-dev-server sessions.
  }
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

export async function listReplaySummaries(
  gameStorage: GameStorage,
): Promise<SavedReplaySummary[]> {
  try {
    const response = await fetch(
      `/api/replays?guestId=${encodeURIComponent(getReplayGuestId(gameStorage))}`,
    );
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const body = await response.json();
    if (Array.isArray(body.items)) {
      return body.items.filter(isValidReplaySummary);
    }
  } catch {
    // Fall back below.
  }

  const replay = loadReplay(gameStorage);
  if (replay === null) {
    return [];
  }

  return [
    {
      id: 'local-last',
      createdAt: '',
      levelNumber: replay.levelNumber,
    },
  ];
}

export async function loadReplayRecord(
  gameStorage: GameStorage,
  id: string,
): Promise<SavedReplay | null> {
  if (id === 'local-last') {
    return loadReplay(gameStorage);
  }

  try {
    const response = await fetch(`/api/replays?id=${encodeURIComponent(id)}`);
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const body = await response.json();
    const record = body.item;
    if (
      record !== undefined &&
      isValidReplaySummary(record) &&
      isValidReplay(record.replay)
    ) {
      return record.replay as SavedReplay;
    }
  } catch {
    return null;
  }

  return null;
}

function getReplayGuestId(gameStorage: GameStorage): string {
  let guestId = gameStorage.get(config.STORAGE_KEY_DEBUG_REPLAY_GUEST_ID);
  if (guestId !== undefined && guestId !== null && guestId !== '') {
    return guestId;
  }

  guestId = `guest-${Date.now().toString(36)}-${Math.floor(
    Math.random() * 0xffffff,
  ).toString(36)}`;
  gameStorage.set(config.STORAGE_KEY_DEBUG_REPLAY_GUEST_ID, guestId);
  gameStorage.save();

  return guestId;
}

function isValidReplaySummary(value): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.levelNumber === 'number'
  );
}

function isValidReplay(value): boolean {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof value.seed !== 'number' ||
    typeof value.levelNumber !== 'number' ||
    typeof value.deviceFrames !== 'object' ||
    value.deviceFrames === null ||
    typeof value.activeDeviceType !== 'number' ||
    typeof value.enemyTraces !== 'object' ||
    value.enemyTraces === null ||
    !Array.isArray(value.powerupSpawns)
  ) {
    return false;
  }

  if (value.runConsumables === undefined) {
    value.runConsumables = createEmptyRunConsumables();
  }

  return isValidRunConsumables(value.runConsumables);
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
