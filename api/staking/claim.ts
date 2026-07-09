declare const require: any;

import {
  createJsonResponse,
  createOptionsResponse,
  resolveSessionPlayer,
} from '../_helpers';

const economyStore = require('../../server/economyStore');
const rateLimiter = require('../../server/rateLimiter');
const stakingStore = require('../../server/stakingStore');

export function OPTIONS(request: Request): Response {
  return createOptionsResponse(request);
}

// Claims every matured unstake position back to the economy token balance.
// Epoch REWARD claiming stays disabled until the revenue split ships real
// pools (plan: no payout promises before that's decided).
export async function POST(request: Request): Promise<Response> {
  const player = await resolveSessionPlayer(request);
  if (player === null) {
    return createJsonResponse(request, { ok: false, error: 'Not logged in' }, 401);
  }

  if (!rateLimiter.allow('staking-action', player.id)) {
    return createJsonResponse(request, { ok: false, error: 'Too many requests' }, 429);
  }

  const result = await stakingStore.claimUnstaked(player);
  if (result.ok && result.amount > 0) {
    await economyStore.creditRewards(player, { token: result.amount });
  }

  const account = await economyStore.readAccount(player.id);
  return createJsonResponse(request, {
    ...result,
    account: account === null ? null : economyStore.toPublicAccount(account),
  });
}
