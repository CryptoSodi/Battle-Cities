export const BATTLECITIES_PROTOCOL_VERSION = 1 as const;

export type BattleCitiesProtocolVersion =
  typeof BATTLECITIES_PROTOCOL_VERSION;

export type MatchRole = 'player' | 'observer' | 'server';
export type PlayerSlot = 0 | 1;
export type MatchPhase = 'waiting' | 'starting' | 'running' | 'finished';

export interface MatchInputCommand<TInput = unknown> {
  type: 'match-input';
  version: BattleCitiesProtocolVersion;
  matchId: string;
  playerSlot: PlayerSlot;
  sequence: number;
  input: TInput;
}

export interface MatchSnapshot<TState = unknown> {
  type: 'match-snapshot';
  version: BattleCitiesProtocolVersion;
  matchId: string;
  tick: number;
  phase: MatchPhase;
  state: TState;
}

export function isPlayerSlot(value: unknown): value is PlayerSlot {
  return value === 0 || value === 1;
}

export function isMatchId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9A-Za-z_-]{1,64}$/.test(value);
}
