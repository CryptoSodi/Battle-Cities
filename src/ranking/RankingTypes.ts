// DTOs for the season/ranking APIs (see
// docs/mattle-inspired-infrastructure-plan.md, Milestone 2).

export interface SeasonSummary {
  id: string;
  number: number;
  name: string;
  startsAt: string;
  endsAt: string;
  status: 'upcoming' | 'live' | 'ended';
  rewardPool: string | null;
}

export type RankingScope = 'gaming' | 'trading';

export interface RankingRow {
  rank: number;
  displayName: string;
  walletAddress: string | null;
  totalPoints: number;
  matches: number;
  // Perk badge ids; empty until staking/trading/event systems ship.
  perks: string[];
}

export interface RankingMe {
  displayName: string;
  rank: number | null;
  totalPoints: number;
  matches?: number;
  // True for guest accounts: virtual players, permanently unranked.
  guest?: boolean;
}

export interface RankingResponse {
  scope: RankingScope;
  seasonId: string | null;
  currentSeason: SeasonSummary;
  seasons: SeasonSummary[];
  rows: RankingRow[];
  me: RankingMe | null;
}

// Raw match facts submitted to the server. The server clamps these and
// derives Game Points itself — never send points from the client.
export interface MatchResultInput {
  mode: 'single' | 'multi';
  levelNumber: number;
  score: number;
  won: boolean;
  // Server-stored replay artifact for later validation (Milestone 7); null
  // when no replay was recorded for this match.
  replayId?: string | null;
}

export interface MatchResultSummary {
  id: string;
  seasonId: string;
  mode: string;
  levelNumber: number;
  score: number;
  gamePoints: number;
  won: boolean;
  validationStatus: string;
  createdAt: string;
}
