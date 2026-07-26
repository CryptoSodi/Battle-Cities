import { PlayerSlot } from './match';

export const DIRECT_MATCH_FUEL_COST = 1 as const;
export const DEFAULT_EVENT_ENTRY_FUEL_COST = 1 as const;

export type MultiplayerMatchCategory = 'direct' | 'event';
export type MultiplayerMatchStatus =
  | 'waiting'
  | 'ready'
  | 'live'
  | 'completed'
  | 'closed';

export interface MultiplayerPlayerSummary {
  playerId: string;
  displayName: string;
  slot: PlayerSlot;
}

export interface MultiplayerMatchSummary {
  id: string;
  category: MultiplayerMatchCategory;
  eventId: string | null;
  status: MultiplayerMatchStatus;
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
