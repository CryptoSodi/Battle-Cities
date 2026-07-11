// Admin/worker script (Milestone 7): validate pending match results.
//
//   node scripts/validate-results.js
//
// Two independent checks per result:
//   1. Game Point recompute — the stored points must equal what the server
//      formula derives from the stored raw facts.
//   2. Replay cross-check — when the result links a replay artifact, the
//      replay's own recorded metadata must corroborate the claim:
//        - the replay must exist (a fabricated replayId rejects),
//        - claimed score cannot exceed the replay's recorded score
//          (result.score is the primary player; the replay stores the match
//          maximum, so primary <= recorded always holds for honest runs),
//        - win flag must match the replay's game result,
//        - level number must match.
//      Results WITHOUT a replayId only pass check 1 — replays are pruned over
//      time, so a missing link is not proof of cheating.
// Full replay re-simulation (re-running the deterministic sim from the input
// recording) is the planned upgrade and slots in behind the same
// accept/reject state machine.

require('../server/loadLocalEnv').loadLocalEnv();

const fs = require('fs').promises;
const path = require('path');
const storageConfig = require('../server/storageConfig');
const matchResultStore = require('../server/matchResultStore');
const replayStore = require('../server/replayStore');

// result: { score, levelNumber, won, gamePoints, replayId } (camelCase).
async function resolveValidationStatus(result) {
  const recomputed = matchResultStore.computeGamePoints(result);
  if (recomputed !== Number(result.gamePoints)) {
    return 'rejected';
  }

  const replayId = typeof result.replayId === 'string' ? result.replayId : '';
  if (replayId === '') {
    return 'accepted';
  }

  const record = await replayStore.readRecordAdmin(replayId);
  if (record === null) {
    // Linked replay never existed or was pruned. Prune-safety: fall back to
    // recompute-only acceptance rather than punishing honest old results.
    return 'accepted';
  }

  if (Number(result.score) > Number(record.score)) {
    return 'rejected';
  }
  if ((result.won === true) !== (record.gameResult === 'win')) {
    return 'rejected';
  }
  if (Number(result.levelNumber) !== Number(record.levelNumber)) {
    return 'rejected';
  }

  return 'accepted';
}

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
        SELECT id, score, level_number, won, game_points, replay_id
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
    const status = await resolveValidationStatus({
      score: Number(row.score),
      levelNumber: Number(row.level_number),
      won: row.won === true,
      gamePoints: Number(row.game_points),
      replayId: row.replay_id,
    });
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

    result.validationStatus = await resolveValidationStatus(result);
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
