declare const require: any;

import { createJsonResponse, createOptionsResponse } from '../_helpers';

const playerPolicy = require('../../server/playerPolicy');
const eventStore = require('../../server/eventStore');
const matchResultStore = require('../../server/matchResultStore');
const playerStore = require('../../server/playerStore');
const rateLimiter = require('../../server/rateLimiter');
const seasonStore = require('../../server/seasonStore');
const sessionIdentity = require('../../server/sessionIdentity');
const sessionStore = require('../../server/sessionStore');

export function OPTIONS(request: Request): Response {
  return createOptionsResponse(request);
}

export async function POST(request: Request): Promise<Response> {
  const sessionId = sessionIdentity.resolveSession(
    request.headers.get('cookie') || '',
  );

  if (sessionId === null) {
    return json(request, { ok: false, error: 'Not logged in' }, 401);
  }

  const session = await sessionStore.readSession(sessionId);
  if (session === null || session.playerId === null) {
    return json(request, { ok: false, error: 'Not logged in' }, 401);
  }

  const player = await playerStore.readPlayer(session.playerId);
  if (player === null) {
    return json(request, { ok: false, error: 'Player not found' }, 404);
  }

  if (!rateLimiter.allow('matches-submit', player.id)) {
    return json(request, { ok: false, error: 'Too many requests' }, 429);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json(request, { ok: false, error: 'Invalid JSON' }, 400);
  }

  const season = await seasonStore.getCurrentSeason();
  const result = await matchResultStore.submitResult(player, season, body);

  // Feed the SERVER-derived result into live event quests (Milestone 3) —
  // quest progress uses the same trusted facts as the leaderboard. Guests are
  // virtual players: their result is stored (provider-tagged, never ranked)
  // but they don't progress quests or touch the event economy.
  if (!playerPolicy.isVirtualPlayer(player)) {
    await eventStore.applyMatchResult(player, result);
  }

  return json(request, {
    ok: true,
    result: matchResultStore.toPublicResult(result),
  });
}

function json(request: Request, body: any, status = 200): Response {
  return createJsonResponse(request, body, status);
}
