import { apiFetch } from '../network/api';

import {
  MatchResultInput,
  MatchResultSummary,
  RankingResponse,
  RankingScope,
  SeasonSummary,
} from './RankingTypes';

// Thin fetch wrapper over the season/ranking/match APIs. All methods are
// best-effort: network or auth failures resolve to null so gameplay flows
// never block on the ranking backend.
export class RankingClient {
  public async getCurrentSeason(): Promise<SeasonSummary | null> {
    try {
      const response = await apiFetch('/api/seasons/current');
      if (!response.ok) {
        return null;
      }

      const body = await response.json();
      return isSeasonSummary(body?.season) ? body.season : null;
    } catch {
      return null;
    }
  }

  public async getRankings(
    scope: RankingScope = 'gaming',
    seasonId: string | null = null,
  ): Promise<RankingResponse | null> {
    try {
      const params = new URLSearchParams({ scope });
      if (seasonId !== null) {
        params.set('seasonId', seasonId);
      }

      const response = await apiFetch(`/api/rankings?${params.toString()}`);
      if (!response.ok) {
        return null;
      }

      const body = await response.json();
      if (!Array.isArray(body?.rows) || !isSeasonSummary(body?.currentSeason)) {
        return null;
      }

      return body as RankingResponse;
    } catch {
      return null;
    }
  }

  public async submitMatchResult(
    input: MatchResultInput,
  ): Promise<MatchResultSummary | null> {
    try {
      const response = await apiFetch('/api/matches/submit', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        return null;
      }

      const body = await response.json();
      return body?.ok === true && body?.result !== undefined
        ? (body.result as MatchResultSummary)
        : null;
    } catch {
      return null;
    }
  }
}

function isSeasonSummary(value: any): value is SeasonSummary {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.startsAt === 'string' &&
    typeof value.endsAt === 'string'
  );
}
