// Admin/worker script (Milestone 7): validate pending match results.
//
//   node scripts/validate-results.js
//
// V1 validation recomputes Game Points from the stored raw facts and accepts
// results whose stored points match; mismatches are rejected. Full replay
// re-simulation (running the deterministic sim against the linked replayId)
// is the planned upgrade and slots in right here once a headless sim runner
// exists — the accept/reject state machine stays the same.

require('../server/loadLocalEnv').loadLocalEnv();

const fs = require('fs').promises;
const path = require('path');
const storageConfig = require('../server/storageConfig');
const matchResultStore = require('../server/matchResultStore');

async function main() {
  if (storageConfig.hasDatabaseConfig()) {
    await validatePostgres();
    return;
  }

  await validateLocalFiles();
}

async function validatePostgres() {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: storageConfig.getDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
  });

  let pending;
  try {
    pending = await pool.query(
      `
        SELECT id, score, level_number, won, game_points
        FROM battlecity_match_results
        WHERE validation_status = 'pending'
        LIMIT 1000
      `,
    );
  } catch (error) {
    // 42P01: table does not exist yet — it is created lazily on the first
    // match submission, so there is simply nothing to validate.
    if (error.code === '42P01') {
      await pool.end();
      console.log('No match results table yet - nothing to validate.');
      return;
    }
    throw error;
  }

  let accepted = 0;
  let rejected = 0;
  for (const row of pending.rows) {
    const recomputed = matchResultStore.computeGamePoints({
      score: Number(row.score),
      levelNumber: Number(row.level_number),
      won: row.won === true,
    });
    const status = recomputed === Number(row.game_points) ? 'accepted' : 'rejected';
    await pool.query(
      `UPDATE battlecity_match_results SET validation_status = $1 WHERE id = $2`,
      [status, row.id],
    );
    if (status === 'accepted') {
      accepted += 1;
    } else {
      rejected += 1;
    }
  }

  await pool.end();
  console.log(`Validated ${pending.rowCount} results: ${accepted} accepted, ${rejected} rejected.`);
}

async function validateLocalFiles() {
  const dir =
    process.env.BATTLECITY_MATCH_DIR ||
    path.join(process.cwd(), 'server-data', 'match-results');

  let files;
  try {
    files = await fs.readdir(dir);
  } catch {
    console.log('No match results to validate.');
    return;
  }

  let accepted = 0;
  let rejected = 0;
  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }

    const filePath = path.join(dir, file);
    let result;
    try {
      result = JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch {
      continue;
    }

    if (result.validationStatus !== 'pending') {
      continue;
    }

    const recomputed = matchResultStore.computeGamePoints(result);
    result.validationStatus =
      recomputed === Number(result.gamePoints) ? 'accepted' : 'rejected';
    await fs.writeFile(filePath, JSON.stringify(result), 'utf8');

    if (result.validationStatus === 'accepted') {
      accepted += 1;
    } else {
      rejected += 1;
    }
  }

  console.log(`Validated results: ${accepted} accepted, ${rejected} rejected.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
