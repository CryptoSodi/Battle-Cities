import { DeviceInputFrame } from '../core';
import {
  createEmptyRunBoosts,
  GameStorage,
  SessionRunBoosts,
  SessionRunConsumables,
} from '../game';
import { InputDeviceType } from '../input';
import { apiFetch, apiFetchDirect } from '../network/api';
import { TankTier } from '../tank';

import { EnemyMovementFrame } from './EnemyMovementFrame';
import { PowerupSpawnFrame } from './PowerupSpawnFrame';

export type SavedReplayMatchStatus = 'pending' | 'verified' | 'rejected';
export type SavedReplayResult = 'win' | 'loss';

export interface SavedReplayMetadata {
  matchStatus: SavedReplayMatchStatus;
  score: number;
  kills: number;
  gameResult: SavedReplayResult;
  durationTicks: number;
}

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
  metadata: SavedReplayMetadata;
  deviceFrames: Record<string, DeviceInputFrame[]>;
  activeDeviceType: InputDeviceType;
  playerTankTiers: TankTier[];
  runConsumables: SessionRunConsumables;
  // Trait boosts the run was played with — they alter the sim (player
  // health/speed, powerup duration), so replays must re-enact them.
  runBoosts: SessionRunBoosts;
  enemyTraces: Record<number, EnemyMovementFrame[]>;
  powerupSpawns: PowerupSpawnFrame[];
}

export interface SavedReplaySummary {
  id: string;
  createdAt: string;
  levelNumber: number;
  matchStatus: SavedReplayMatchStatus;
  score: number;
  kills: number;
  gameResult: SavedReplayResult;
  durationTicks: number;
}

export interface SavedReplayRecord extends SavedReplaySummary {
  replay: SavedReplay;
}

const REPLAY_SUMMARY_CACHE_TTL_MS = 30 * 1000;

let replaySummaryCache: SavedReplaySummary[] = null;
let replaySummaryCacheTime = 0;

// Id of the most recently uploaded replay this session, so the match-result
// submission can reference the artifact a validation worker would re-simulate
// (see docs/mattle-inspired-infrastructure-plan.md, Milestones 2/7). Best
// effort: null when no replay was recorded or the upload hasn't finished.
let lastSavedReplayId: string = null;

export function getLastSavedReplayId(): string {
  return lastSavedReplayId;
}

export async function saveReplay(
  _gameStorage: GameStorage,
  replay: SavedReplay,
): Promise<void> {
  // A single-player replay is produced by the browser's local simulation.
  // Upload it directly to the API; it is never a headless match request.
  const response = await apiFetchDirect('/api/replays', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      replay,
      metadata: replay.metadata,
    }),
  });

  if (!response.ok) {
    throw new Error('Replay could not be saved.');
  }

  try {
    const body = await response.json();
    if (typeof body?.item?.id === 'string') {
      lastSavedReplayId = body.item.id;
    }
  } catch {
    // Response body is informational only; the save itself succeeded.
  }

  replaySummaryCache = null;
  replaySummaryCacheTime = 0;
}

export async function listReplaySummaries(
  _gameStorage: GameStorage,
): Promise<SavedReplaySummary[]> {
  if (
    replaySummaryCache !== null &&
    Date.now() - replaySummaryCacheTime < REPLAY_SUMMARY_CACHE_TTL_MS
  ) {
    return replaySummaryCache.slice();
  }

  try {
    const response = await apiFetch('/api/replays');
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const body = await response.json();
    if (Array.isArray(body.items)) {
      replaySummaryCache = body.items.filter(isValidReplaySummary);
      replaySummaryCacheTime = Date.now();
      return replaySummaryCache.slice();
    }
  } catch {
    return replaySummaryCache === null ? [] : replaySummaryCache.slice();
  }
}

export async function loadReplayRecord(
  _gameStorage: GameStorage,
  id: string,
): Promise<SavedReplay | null> {
  try {
    const response = await apiFetch(`/api/replays?id=${encodeURIComponent(id)}`);
    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const body = await response.json();
    const record = body.item;
    if (
      record !== undefined &&
      isValidReplayRecord(record) &&
      isValidReplay(record.replay)
    ) {
      return record.replay as SavedReplay;
    }
  } catch {
    return null;
  }

  return null;
}

function isValidReplaySummary(value): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.levelNumber === 'number' &&
    isValidMatchStatus(value.matchStatus) &&
    typeof value.score === 'number' &&
    typeof value.kills === 'number' &&
    isValidReplayResult(value.gameResult) &&
    typeof value.durationTicks === 'number'
  );
}

function isValidReplayRecord(value): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const matchStatus = value.validationStatus ?? value.matchStatus;
  return (
    typeof value.id === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.levelNumber === 'number' &&
    isValidMatchStatus(matchStatus) &&
    typeof value.score === 'number' &&
    typeof value.kills === 'number' &&
    isValidReplayResult(value.gameResult) &&
    typeof value.durationTicks === 'number' &&
    typeof value.replay === 'object' &&
    value.replay !== null
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

  if (value.playerTankTiers === undefined) {
    value.playerTankTiers = [TankTier.A, TankTier.A];
  }

  // Replays recorded before trait boosts existed re-enact with zeros.
  if (value.runBoosts === undefined) {
    value.runBoosts = createEmptyRunBoosts();
  }

  if (value.metadata === undefined) {
    value.metadata = {
      matchStatus: 'pending',
      score: 0,
      kills: 0,
      gameResult: 'loss',
      durationTicks: 0,
    };
  }

  return (
    isValidPlayerTankTiers(value.playerTankTiers) &&
    isValidRunConsumables(value.runConsumables) &&
    isValidReplayMetadata(value.metadata)
  );
}

function isValidPlayerTankTiers(value: any): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (tier) =>
        tier === TankTier.A ||
        tier === TankTier.B ||
        tier === TankTier.C ||
        tier === TankTier.D,
    )
  );
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

function isValidReplayMetadata(value: any): value is SavedReplayMetadata {
  return (
    typeof value === 'object' &&
    value !== null &&
    isValidMatchStatus(value.matchStatus) &&
    typeof value.score === 'number' &&
    typeof value.kills === 'number' &&
    isValidReplayResult(value.gameResult) &&
    typeof value.durationTicks === 'number'
  );
}

function isValidMatchStatus(value: any): value is SavedReplayMatchStatus {
  return value === 'pending' || value === 'verified' || value === 'rejected';
}

function isValidReplayResult(value: any): value is SavedReplayResult {
  return value === 'win' || value === 'loss';
}
