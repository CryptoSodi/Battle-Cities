import { getApiUrl } from '../network/api';

export type PublicRank = {
  rank: number | null;
  totalPoints: number;
  matches: number;
};

export type PublicMatch = {
  id: string;
  mode: 'single' | 'multi';
  levelNumber: number;
  score: number;
  gamePoints: number;
  won: boolean;
  createdAt: string;
};

export type PublicProfile = {
  id: string;
  provider: 'guest' | 'wallet' | 'google';
  displayName: string;
  walletAddress: string | null;
  avatarUrl: string | null;
  joinedAt: string;
  highscores: { primary: number; secondary: number };
  stats: {
    allTime: PublicRank;
    currentSeason: PublicRank & { id: string; name: string };
  };
  recentMatches: PublicMatch[];
};

export class PlayerProfileRequestError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export class PlayerProfileClient {
  public async getProfile(playerId: string): Promise<PublicProfile> {
    const response = await fetch(
      getApiUrl(`/api/players/${encodeURIComponent(playerId)}/profile`),
      { credentials: 'include' },
    );
    if (!response.ok) {
      throw new PlayerProfileRequestError(
        `Profile request failed (${response.status})`,
        response.status,
      );
    }

    const body = (await response.json()) as { item?: PublicProfile };
    if (body.item === undefined) {
      throw new PlayerProfileRequestError(
        'Profile response is incomplete',
        response.status,
      );
    }
    return body.item;
  }
}
