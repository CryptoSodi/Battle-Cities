declare const require: any;

import {
  createJsonResponse,
  createOptionsResponse,
  resolveSessionPlayer,
} from '../_helpers';

const playerPolicy = require('../../server/playerPolicy');
const economyStore = require('../../server/economyStore');
const rateLimiter = require('../../server/rateLimiter');
const stakingStore = require('../../server/stakingStore');

export function OPTIONS(request: Request): Response {
  return createOptionsResponse(request);
}

// Dev/off-chain staking: locks SOFT tokens from the economy account. The
// balance debit happens first; on any staking failure it is refunded. On-chain
// staking replaces this handler's internals later (Milestone 4 note).
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


  if (!rateLimiter.allow('staking-action', player.id)) {
    return createJsonResponse(request, { ok: false, error: 'Too many requests' }, 429);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return createJsonResponse(request, { ok: false, error: 'Invalid JSON' }, 400);
  }

  const amount = Math.floor(Number(body?.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return createJsonResponse(request, { ok: false, error: 'Invalid amount' }, 400);
  }

  const debited = await economyStore.debitTokens(player, amount);
  if (debited === null) {
    return createJsonResponse(request, { ok: false, error: 'Not enough tokens' }, 400);
  }

  const result = await stakingStore.stake(player, amount);
  if (!result.ok) {
    await economyStore.creditRewards(player, { token: amount });
    return createJsonResponse(request, result, 400);
  }

  return createJsonResponse(request, {
    ...result,
    account: economyStore.toPublicAccount(
      await economyStore.readAccount(player.id),
    ),
  });
}
