declare const require: any;

import {
  createJsonResponse,
  createOptionsResponse,
  resolveSessionPlayer,
} from '../_helpers';

const playerPolicy = require('../../server/playerPolicy');
const economyStore = require('../../server/economyStore');
const eventStore = require('../../server/eventStore');
const rateLimiter = require('../../server/rateLimiter');

export function OPTIONS(request: Request): Response {
  return createOptionsResponse(request);
}

// Claims a completed quest: event currency is credited by the event store,
// soft rewards (fuel/token) land on the economy account, everything hits the
// ledger. Idempotent per quest.
export async function POST(request: Request): Promise<Response> {
  const player = await resolveSessionPlayer(request);
  if (player === null) {
    return createJsonResponse(request, { ok: false, error: 'Not logged in' }, 401);
  }

  if (playerPolicy.isVirtualPlayer(player)) {
    return createJsonResponse(
      request,
      { ok: false, error: playerPolicy.VIRTUAL_PLAYER_MESSAGE },
      403,
    );
  }


  if (!rateLimiter.allow('quest-claim', player.id)) {
    return createJsonResponse(request, { ok: false, error: 'Too many requests' }, 429);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return createJsonResponse(request, { ok: false, error: 'Invalid JSON' }, 400);
  }

  const result = await eventStore.claimQuest(player, body?.questId);
  if (!result.ok) {
    return createJsonResponse(request, result, 400);
  }

  if (result.reward.fuel > 0 || result.reward.token > 0) {
    await economyStore.creditRewards(player, {
      fuel: result.reward.fuel,
      token: result.reward.token,
    });
  }

  const account = await economyStore.readAccount(player.id);
  return createJsonResponse(request, {
    ...result,
    account: account === null ? null : economyStore.toPublicAccount(account),
  });
}
