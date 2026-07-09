declare const require: any;

import {
  createJsonResponse,
  createOptionsResponse,
  resolveSessionPlayer,
} from '../_helpers';

const airdropStore = require('../../server/airdropStore');
const matchResultStore = require('../../server/matchResultStore');
const stakingStore = require('../../server/stakingStore');
const tradingStore = require('../../server/tradingStore');

export function OPTIONS(request: Request): Response {
  return createOptionsResponse(request);
}

// Eligibility for one campaign (?slug=) or the campaign card list (no slug).
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug') || '';

  if (slug === '') {
    return createJsonResponse(request, { items: airdropStore.listCampaigns() });
  }

  const player = await resolveSessionPlayer(request);
  if (player === null) {
    return createJsonResponse(request, { authenticated: false }, 401);
  }

  const eligibility = await airdropStore.getEligibility(slug, player.id, {
    getAllTimeGamePoints: async (id: string) => {
      const rank = await matchResultStore.getPlayerRank(id, null);
      return rank === null ? 0 : rank.totalPoints;
    },
    getTotalStakingSp: async (id: string) => {
      const summary = await stakingStore.getSummary(id);
      return summary.me.totalSp;
    },
    getTradingVolumeUsd: async (id: string) => {
      const status = await tradingStore.getBoostStatus(id);
      return status.totalVolumeUsd;
    },
  });

  if (eligibility === null) {
    return createJsonResponse(request, { error: 'Campaign not found' }, 404);
  }

  return createJsonResponse(request, { authenticated: true, eligibility });
}
