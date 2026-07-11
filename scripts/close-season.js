// Admin script (Milestone 7): freeze a season's gaming leaderboard into an
// immutable snapshot. Run AFTER the season's end date:
//
//   node scripts/close-season.js season-1
//
// Uses the same storage config as the server (Postgres when configured,
// server-data/ JSON otherwise). Refuses to snapshot a season that is still
// live, and never overwrites an existing snapshot.

require('../server/loadLocalEnv').loadLocalEnv();

const seasonStore = require('../server/seasonStore');
const matchResultStore = require('../server/matchResultStore');
const leaderboardSnapshotStore = require('../server/leaderboardSnapshotStore');
const perkBadges = require('../server/perkBadges');

async function main() {
  const seasonId = process.argv[2];
  if (!seasonId) {
    console.error('Usage: node scripts/close-season.js <seasonId>');
    process.exit(1);
  }

  const season = await seasonStore.readSeason(seasonId);
  if (season === null) {
    console.error(`Season not found: ${seasonId}`);
    process.exit(1);
  }

  if (Date.now() < Date.parse(season.endsAt)) {
    console.error(
      `Season ${seasonId} is still live (ends ${season.endsAt}); refusing to close.`,
    );
    process.exit(1);
  }

  // Resolve perk badges NOW so they freeze with the board — a closed season
  // shows the perks players held when it closed, not their current ones.
  const rows = await matchResultStore.getLeaderboard(seasonId, 100);
  const badges = await perkBadges.getPerkBadges(rows.map((row) => row.playerId));
  const rowsWithPerks = rows.map((row) => ({
    ...row,
    perks: badges[row.playerId] || [],
  }));

  const result = await leaderboardSnapshotStore.writeSnapshot(
    'gaming',
    seasonId,
    rowsWithPerks,
  );

  if (!result.ok) {
    console.error(`Snapshot failed: ${result.error}`);
    process.exit(1);
  }

  console.log(
    `Closed ${seasonId}: froze ${result.rows} gaming leaderboard rows.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
