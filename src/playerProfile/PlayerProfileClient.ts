import { getApiUrl } from '../network/api';
import { SavedReplay } from '../replay';

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
  replayAvailable: boolean;
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
  recentMatchesPage: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export class PlayerProfileRequestError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export class PlayerProfileClient {
  public async getProfile(
    playerId: string,
    page = 1,
  ): Promise<PublicProfile> {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const response = await fetch(
      getApiUrl(
        `/api/players/${encodeURIComponent(playerId)}/profile?page=${safePage}`,
      ),
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

  public async getReplay(
    playerId: string,
    matchId: string,
  ): Promise<SavedReplay[]> {
    const response = await fetch(
      getApiUrl(
        `/api/players/${encodeURIComponent(playerId)}/profile/matches/${encodeURIComponent(matchId)}/replay`,
      ),
      { credentials: 'include' },
    );
    if (!response.ok) {
      throw new PlayerProfileRequestError(
        `Replay request failed (${response.status})`,
        response.status,
      );
    }

    const replays = (await response.json())?.item?.replays;
    if (!Array.isArray(replays) || replays.length === 0 || replays.some(
      (replay) => typeof replay !== 'object' || replay === null ||
        !Number.isInteger(replay.levelNumber),
    )) {
      throw new PlayerProfileRequestError(
        'Replay response is incomplete',
        response.status,
      );
    }
    return replays as SavedReplay[];
  }

}
