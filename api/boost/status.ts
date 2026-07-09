declare const require: any;

import {
  createJsonResponse,
  createOptionsResponse,
  resolveSessionPlayer,
} from '../_helpers';

const stakingStore = require('../../server/stakingStore');
const tradingStore = require('../../server/tradingStore');

export function OPTIONS(request: Request): Response {
  return createOptionsResponse(request);
}

// The Boost dashboard: 30-day trading boosts, staking perk tier, shop perks
// (empty until the shop sells perk items), and where each perk applies.
// Per the plan's ranked-fairness rule, boosts NEVER apply to Ranked — only
// to Events/Arcade — and the response says so explicitly.
export async function GET(request: Request): Promise<Response> {
  const player = await resolveSessionPlayer(request);

  if (player === null) {
    return createJsonResponse(request, { authenticated: false });
  }

  const [trading, stakingSummary] = await Promise.all([
    tradingStore.getBoostStatus(player.id),
    stakingStore.getSummary(player.id),
  ]);

  return createJsonResponse(request, {
    authenticated: true,
    appliesTo: ['events', 'arcade'],
    rankedAffected: false,
    trading,
    staking: {
      tier: stakingSummary.me.perkTier,
      staked: stakingSummary.me.staked,
      nextTier:
        stakingSummary.perkTiers.find(
          (tier: any) => tier.stake > stakingSummary.me.staked,
        ) || null,
    },
    shopPerks: [],
  });
}
