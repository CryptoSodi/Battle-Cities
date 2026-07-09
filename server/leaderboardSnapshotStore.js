const fs = require('fs').promises;
const path = require('path');
const storageConfig = require('./storageConfig');

// Frozen leaderboard rows (plan: "Store snapshots so reward calculations
// cannot shift after a season closes"). Written once per (scope, season) by
// the season-close script; rankings served from a snapshot are immutable.

const TABLE_NAME = 'battlecity_leaderboard_rows';

let pgPool = null;

function getDataDir() {
  return (
    process.env.BATTLECITY_SNAPSHOT_DIR ||
    path.join(process.cwd(), 'server-data', 'leaderboard-snapshots')
  );
}

function hasPersistentConfig() {
  return storageConfig.hasDatabaseConfig();
}

function getPgPool() {
  if (pgPool !== null) {
    return pgPool;
  }

  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: storageConfig.getDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
  });

  return pgPool;
}

async function ensureSchema() {
  await getPgPool().query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      scope TEXT NOT NULL,
      season_id TEXT NOT NULL,
      rank INTEGER NOT NULL,
      player_id TEXT NOT NULL,
      wallet_address TEXT NULL,
      display_name TEXT NOT NULL,
      points BIGINT NOT NULL,
      perk_badges_json JSONB NOT NULL,
      snapshot_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (scope, season_id, rank)
    );
  `);
}

function getSnapshotPath(scope, seasonId) {
  return path.join(getDataDir(), `${scope}-${seasonId}.json`);
}

// Writes the frozen rows. Refuses to overwrite an existing snapshot — a
// closed season's board must never change.
async function writeSnapshot(scope, seasonId, rows) {
  const existing = await readSnapshot(scope, seasonId);
  if (existing !== null) {
    return { ok: false, error: 'Snapshot already exists' };
  }

  const snapshotAt = new Date().toISOString();
  const frozen = rows.map((row) => ({
    rank: row.rank,
    playerId: row.playerId,
    walletAddress: row.walletAddress || null,
    displayName: row.displayName,
    points: row.totalPoints,
    perks: Array.isArray(row.perks) ? row.perks : [],
    snapshotAt,
  }));

  if (hasPersistentConfig()) {
    await ensureSchema();
    for (const row of frozen) {
      await getPgPool().query(
        `
          INSERT INTO ${TABLE_NAME}
            (
              scope, season_id, rank, player_id, wallet_address,
              display_name, points, perk_badges_json, snapshot_at
            )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
          ON CONFLICT (scope, season_id, rank) DO NOTHING
        `,
        [
          scope,
          seasonId,
          row.rank,
          row.playerId,
          row.walletAddress,
          row.displayName,
          row.points,
          JSON.stringify(row.perks),
          row.snapshotAt,
        ],
      );
    }
    return { ok: true, rows: frozen.length };
  }

  await fs.mkdir(getDataDir(), { recursive: true });
  await fs.writeFile(
    getSnapshotPath(scope, seasonId),
    JSON.stringify(frozen),
    'utf8',
  );
  return { ok: true, rows: frozen.length };
}

async function readSnapshot(scope, seasonId) {
  if (hasPersistentConfig()) {
    await ensureSchema();
    const result = await getPgPool().query(
      `
        SELECT rank, player_id, wallet_address, display_name, points,
          perk_badges_json, snapshot_at
        FROM ${TABLE_NAME}
        WHERE scope = $1 AND season_id = $2
        ORDER BY rank ASC
      `,
      [scope, seasonId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return result.rows.map((row) => ({
      rank: Number(row.rank),
      playerId: row.player_id,
      walletAddress: row.wallet_address,
      displayName: row.display_name,
      totalPoints: Number(row.points),
      perks: Array.isArray(row.perk_badges_json) ? row.perk_badges_json : [],
      snapshotAt: new Date(row.snapshot_at).toISOString(),
    }));
  }

  try {
    const raw = await fs.readFile(getSnapshotPath(scope, seasonId), 'utf8');
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) {
      return null;
    }
    return rows.map((row) => ({
      rank: row.rank,
      playerId: row.playerId,
      walletAddress: row.walletAddress,
      displayName: row.displayName,
      totalPoints: row.points,
      perks: Array.isArray(row.perks) ? row.perks : [],
      snapshotAt: row.snapshotAt,
    }));
  } catch {
    return null;
  }
}

module.exports = {
  readSnapshot,
  writeSnapshot,
  isPersistentStoreConfigured: hasPersistentConfig,
};
