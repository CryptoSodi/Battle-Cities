// DTOs for the event/quest/phase APIs (Milestone 3).

export interface RewardTrack {
  threshold: number;
  reward: Record<string, number>;
  label: string;
}

export interface EventSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  status: 'upcoming' | 'live' | 'ended';
  prizePool: string;
  currency: string;
  rewardTracks: RewardTrack[];
}

export interface QuestState {
  id: string;
  name: string;
  description: string;
  metric: string;
  target: number;
  reward: Record<string, number>;
  value: number;
  completed: boolean;
  claimedAt: string | null;
}

export interface EventBoard extends EventSummary {
  currencyBalance: number;
  quests: QuestState[];
}

export interface EventLeaderboardRow {
  rank: number;
  playerId: string;
  displayName: string;
  amount: number;
}

export interface QuestClaimResult {
  ok: boolean;
  error?: string;
  quest?: { id: string; name: string };
  reward?: {
    currency: string;
    currencyAmount: number;
    fuel: number;
    token: number;
  };
}

export interface PhaseSummary {
  id: string;
  number: number;
  name: string;
  startsAt: string;
  endsAt: string;
  status: 'upcoming' | 'live' | 'ended';
  rewardPool: string;
}
