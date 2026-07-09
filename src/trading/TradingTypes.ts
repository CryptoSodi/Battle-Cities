// DTOs for the trading/boost APIs (Milestone 5).

export interface TokenCatalogItem {
  mint: string;
  symbol: string;
  name: string;
  group: 'native' | 'stable' | 'listed' | 'unlisted';
  trait: 'all' | 'hull' | 'armor' | 'engine' | 'salvage' | null;
  featured: boolean;
}

export interface SwapVerifyInput {
  signature: string;
  fromMint: string;
  toMint: string;
  volumeUsd: number;
}

export interface SwapVerifyResult {
  ok: boolean;
  error?: string;
}

export interface BoostStatus {
  authenticated: boolean;
  appliesTo?: string[];
  rankedAffected?: boolean;
  trading?: {
    windowDays: number;
    totalVolumeUsd: number;
    boosts: { hull: number; armor: number; engine: number; salvage: number };
    rows: {
      mint: string;
      symbol: string;
      group: string;
      trait: string;
      volumeUsd: number;
    }[];
  };
  staking?: {
    tier: {
      level: number;
      stake: number;
      hull: number;
      armor: number;
      engine: number;
      salvage: number;
    };
    staked: number;
    nextTier: { level: number; stake: number } | null;
  };
  shopPerks?: string[];
}
