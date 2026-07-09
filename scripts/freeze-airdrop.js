// Admin script (Milestone 6): snapshot eligibility weights for every known
// player and freeze a campaign's allocations. Idempotent — refuses to
// re-freeze.
//
//   node scripts/freeze-airdrop.js founding-commanders

require('../server/loadLocalEnv').loadLocalEnv();

const fs = require('fs').promises;
const path = require('path');
const storageConfig = require('../server/storageConfig');
const airdropStore = require('../server/airdropStore');
const matchResultStore = require('../server/matchResultStore');
const stakingStore = require('../server/stakingStore');
const tradingStore = require('../server/tradingStore');

async function listAllPlayerIds() {
  if (storageConfig.hasDatabaseConfig()) {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: storageConfig.getDatabaseUrl(),
      ssl: { rejectUnauthorized: false },
    });
    const result = await pool.query('SELECT id FROM battlecity_players');
    await pool.end();
    return result.rows.map((row) => row.id);
  }

  const dir =
    process.env.BATTLECITY_PLAYER_DIR ||
    path.join(process.cwd(), 'server-data', 'players');
  try {
    const files = await fs.readdir(dir);
    return files
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node scripts/freeze-airdrop.js <campaignSlug>');
    process.exit(1);
  }

  const campaign = airdropStore.findCampaignBySlug(slug);
  if (campaign === null) {
    console.error(`Campaign not found: ${slug}`);
    process.exit(1);
  }

  const playerIds = await listAllPlayerIds();
  const weights = {};

  for (const playerId of playerIds) {
    const { weight } = await airdropStore.computeWeight(campaign, playerId, {
      getAllTimeGamePoints: async (id) => {
        const rank = await matchResultStore.getPlayerRank(id, null);
        return rank === null ? 0 : rank.totalPoints;
      },
      getTotalStakingSp: async (id) => {
        const summary = await stakingStore.getSummary(id);
        return summary.me.totalSp;
      },
      getTradingVolumeUsd: async (id) => {
        const status = await tradingStore.getBoostStatus(id);
        return status.totalVolumeUsd;
      },
    });

    if (weight > 0) {
      weights[playerId] = weight;
    }
  }

  const result = await airdropStore.freezeAllocations(slug, weights);
  if (!result.ok) {
    console.error(`Freeze failed: ${result.error}`);
    process.exit(1);
  }

  console.log(
    `Froze ${slug}: ${result.players} players, total weight ${result.totalWeight}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
