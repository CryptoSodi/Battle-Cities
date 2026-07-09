// DTOs for the staking APIs (Milestone 4).

export interface StakingPerkTier {
  level: number;
  stake: number;
  hull: number;
  armor: number;
  engine: number;
  salvage: number;
}

export interface StakingSummary {
  epoch: {
    id: string;
    number: number;
    day: number;
    lengthDays: number;
    startsAt: string;
    endsAt: string;
    rewardPool: number;
    totalSp: number;
  };
  community: { lockedTokens: number };
  me: {
    staked: number;
    latestSp: number;
    totalSp: number;
    estimatedReward: number;
    perkTier: StakingPerkTier;
  };
  unstakes: {
    id: string;
    amount: number;
    claimableAt: string;
    claimable: boolean;
  }[];
  perkTiers: StakingPerkTier[];
}

export interface StakingLeaderboardRow {
  rank: number;
  playerId: string;
  displayName: string;
  staked: number;
  totalSp: number;
}

export interface StakingActionResult {
  ok: boolean;
  error?: string;
  staked?: number;
  amount?: number;
}
