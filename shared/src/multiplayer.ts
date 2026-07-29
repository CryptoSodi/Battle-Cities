import { PlayerSlot } from './match';

export const DIRECT_MATCH_FUEL_COST = 1 as const;
export const DEFAULT_EVENT_ENTRY_FUEL_COST = 1 as const;

export type MultiplayerTankTier = 'a' | 'b' | 'c' | 'd';

export function isMultiplayerTankTier(
  value: unknown,
): value is MultiplayerTankTier {
  return value === 'a' || value === 'b' || value === 'c' || value === 'd';
}

export function getMultiplayerTankFuelCost(tier: MultiplayerTankTier): number {
  switch (tier) {
    case 'b':
      return 2;
    case 'c':
      return 3;
    case 'd':
      return 4;
    default:
      return DIRECT_MATCH_FUEL_COST;
  }
}

export type MultiplayerMatchCategory = 'direct' | 'event';
export type MultiplayerMatchStatus =
  | 'waiting'
  | 'ready'
  | 'live'
  | 'transition'
  | 'completed'
  | 'closed';

export interface MultiplayerPlayerSummary {
  playerId: string;
  displayName: string;
  slot: PlayerSlot;
  tankTier: MultiplayerTankTier;
}

export interface MultiplayerMatchSummary {
  id: string;
  category: MultiplayerMatchCategory;
  eventId: string | null;
  status: MultiplayerMatchStatus;
  stage: number;
  openSlots: PlayerSlot[];
  players: MultiplayerPlayerSummary[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface MultiplayerAssignment {
  match: MultiplayerMatchSummary;
  playerSlot: PlayerSlot;
  joinToken: string;
  fuelCharged: number;
  eventEntryCreated: boolean;
  reconnected: boolean;
}

export interface MultiplayerRuntimeConfig {
  protocolVersion: 1;
  mode: 'webrtc';
  matchId: string;
  role: 'player';
  playerSlot: PlayerSlot;
  tankTier: MultiplayerTankTier;
  level: number;
  signalingBaseUrl: string;
  joinToken: string;
}

export interface MultiplayerStartResponse {
  ok: boolean;
  assignment?: MultiplayerAssignment;
  runtime?: MultiplayerRuntimeConfig;
  error?: string;
}

export interface MultiplayerAuthoritativeScore {
  playerSlot: PlayerSlot;
  score: number;
}

export interface MultiplayerAuthoritativeResultRequest {
  scores: MultiplayerAuthoritativeScore[];
}

export interface MultiplayerObserverResponse {
  ok: boolean;
  match?: MultiplayerMatchSummary;
  observerId?: string;
  error?: string;
}

export interface MultiplayerScoreSubmission {
  score: number;
}

export interface EventBestScoreRow {
  rank: number;
  playerId: string;
  displayName: string;
  score: number;
  matches: number;
}

export interface EventPrizeAllocation {
  playerId: string;
  rank: number;
  amount: number;
  currency: string;
}
