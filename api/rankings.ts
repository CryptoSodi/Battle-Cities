declare const require: any;

import { createJsonResponse, createOptionsResponse } from './_helpers';

const leaderboardSnapshotStore = require('../server/leaderboardSnapshotStore');
const matchResultStore = require('../server/matchResultStore');
const playerStore = require('../server/playerStore');
const seasonStore = require('../server/seasonStore');
const sessionIdentity = require('../server/sessionIdentity');
const sessionStore = require('../server/sessionStore');

export function OPTIONS(request: Request): Response {
  return createOptionsResponse(request);
}

// Hall of Fame data. scope=gaming|trading; seasonId scopes gaming rows to a
// season ('' or 'all' => all-time). Trading rows are an empty placeholder
// until Milestone 5 lands trading volume — the response shape is final so the
// client tab can ship now.
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') === 'trading' ? 'trading' : 'gaming';
  const requestedSeasonId = url.searchParams.get('seasonId') || '';

  const currentSeason = await seasonStore.getCurrentSeason();
  const seasons = await seasonStore.listSeasons();

  const seasonId =
    requestedSeasonId === '' || requestedSeasonId === 'all'
      ? requestedSeasonId === 'all'
        ? null
        : currentSeason.id
      : requestedSeasonId;

  // A closed season serves its immutable snapshot; live scopes compute fresh.
  let rows = [];
  if (scope === 'gaming') {
    const snapshot =
      seasonId === null
        ? null
        : await leaderboardSnapshotStore.readSnapshot('gaming', seasonId);
    rows =
      snapshot !== null
        ? snapshot
        : await matchResultStore.getLeaderboard(seasonId, 20);
  }

  const me = await resolveMe(request, scope, seasonId);

  return createJsonResponse(request, {
    scope,
    seasonId,
    currentSeason: seasonStore.toPublicSeason(currentSeason),
    seasons: seasons.map((season: any) => seasonStore.toPublicSeason(season)),
    rows: rows.map(toPublicRow),
    me,
  });
}

async function resolveMe(
  request: Request,
  scope: string,
  seasonId: string | null,
): Promise<any> {
  const sessionId = sessionIdentity.resolveSession(
    request.headers.get('cookie') || '',
  );
  if (sessionId === null) {
    return null;
  }

  const session = await sessionStore.readSession(sessionId);
  if (session === null || session.playerId === null) {
    return null;
  }

  const player = await playerStore.readPlayer(session.playerId);
  if (player === null) {
    return null;
  }

  if (scope !== 'gaming') {
    return { displayName: player.displayName, rank: null, totalPoints: 0 };
  }

  const rank = await matchResultStore.getPlayerRank(player.id, seasonId);
  return {
    displayName: player.displayName,
    rank: rank === null ? null : rank.rank,
    totalPoints: rank === null ? 0 : rank.totalPoints,
    matches: rank === null ? 0 : rank.matches,
  };
}

function toPublicRow(row: any): any {
  return {
    rank: row.rank,
    displayName: row.displayName,
    walletAddress: row.walletAddress,
    totalPoints: row.totalPoints,
    matches: row.matches,
    // Perk badges arrive with staking/trading/event systems (Milestones 4-5).
    perks: [],
  };
}
