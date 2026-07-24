const fs = require('fs').promises;
const path = require('path');
const storageConfig = require('./storageConfig');

const TABLE_NAME = 'battlecity_webrtc_signals';
const SIGNAL_TTL_MS = 5 * 60 * 1000;
const SIGNAL_MAX_BYTES = 256 * 1024;

let pgPool = null;

function getDataDir() {
  return (
    process.env.BATTLECITY_WEBRTC_SIGNAL_DIR ||
    path.join(process.cwd(), 'server-data', 'webrtc-signals')
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
      match_id TEXT NOT NULL,
      player_index INTEGER NOT NULL,
      kind TEXT NOT NULL,
      code TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revision BIGSERIAL PRIMARY KEY
    );

    CREATE UNIQUE INDEX IF NOT EXISTS battlecity_webrtc_signals_latest_idx
      ON ${TABLE_NAME} (match_id, player_index, kind);
    CREATE INDEX IF NOT EXISTS battlecity_webrtc_signals_created_idx
      ON ${TABLE_NAME} (created_at);
  `);
}

async function cleanupExpired(now = Date.now()) {
  if (hasPersistentConfig()) {
    await ensureSchema();
    await getPgPool().query(
      `DELETE FROM ${TABLE_NAME} WHERE created_at < NOW() - INTERVAL '5 minutes'`,
    );
    return;
  }

  await ensureDataDir();
  const files = await fs.readdir(getDataDir());
  await Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .map(async (file) => {
        const filePath = path.join(getDataDir(), file);
        try {
          const signal = JSON.parse(await fs.readFile(filePath, 'utf8'));
          if (now - Date.parse(signal.createdAt) > SIGNAL_TTL_MS) {
            await fs.unlink(filePath);
          }
        } catch {
          await fs.unlink(filePath).catch(() => {});
        }
      }),
  );
}

async function publishSignal(matchId, playerIndex, kind, code) {
  validateSignalRoute(matchId, playerIndex, kind);
  if (
    typeof code !== 'string' ||
    code.length === 0 ||
    Buffer.byteLength(code, 'utf8') > SIGNAL_MAX_BYTES
  ) {
    throw new Error('Invalid signal code');
  }

  if (hasPersistentConfig()) {
    await ensureSchema();
    await cleanupExpired();
    const result = await getPgPool().query(
      `
        INSERT INTO ${TABLE_NAME}
          (match_id, player_index, kind, code, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (match_id, player_index, kind)
        DO UPDATE SET
          code = EXCLUDED.code,
          created_at = NOW(),
          revision = nextval(pg_get_serial_sequence('${TABLE_NAME}', 'revision'))
        RETURNING revision, created_at
      `,
      [matchId, Number(playerIndex), kind, code],
    );
    const row = result.rows[0];
    return {
      id: Number(row.revision),
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  await ensureDataDir();
  await cleanupExpired();
  const createdAt = new Date().toISOString();
  const previous = await readLocalSignal(matchId, playerIndex, kind);
  const id = previous === null ? 1 : previous.id + 1;
  const signal = {
    id,
    matchId,
    playerIndex: Number(playerIndex),
    kind,
    code,
    createdAt,
  };
  await fs.writeFile(
    getSignalPath(matchId, playerIndex, kind),
    JSON.stringify(signal),
    'utf8',
  );
  return { id, createdAt };
}

async function readSignal(matchId, playerIndex, kind, after = 0) {
  validateSignalRoute(matchId, playerIndex, kind);
  const minRevision = Number.isFinite(Number(after)) ? Number(after) : 0;

  if (hasPersistentConfig()) {
    await ensureSchema();
    await cleanupExpired();
    const result = await getPgPool().query(
      `
        SELECT revision, match_id, player_index, kind, code, created_at
        FROM ${TABLE_NAME}
        WHERE match_id = $1
          AND player_index = $2
          AND kind = $3
          AND revision > $4
        LIMIT 1
      `,
      [matchId, Number(playerIndex), kind, minRevision],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return rowToSignal(result.rows[0]);
  }

  await cleanupExpired();
  const signal = await readLocalSignal(matchId, playerIndex, kind);
  if (signal === null || signal.id <= minRevision) {
    return null;
  }
  return signal;
}

async function readLocalSignal(matchId, playerIndex, kind) {
  try {
    return JSON.parse(
      await fs.readFile(getSignalPath(matchId, playerIndex, kind), 'utf8'),
    );
  } catch {
    return null;
  }
}

function rowToSignal(row) {
  return {
    id: Number(row.revision),
    matchId: row.match_id,
    playerIndex: Number(row.player_index),
    kind: row.kind,
    code: row.code,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function ensureDataDir() {
  await fs.mkdir(getDataDir(), { recursive: true });
}

function getSignalPath(matchId, playerIndex, kind) {
  return path.join(getDataDir(), `${safePathPart(matchId)}-${playerIndex}-${kind}.json`);
}

function safePathPart(value) {
  return String(value).replace(/[^0-9A-Za-z_-]/g, '_');
}

function validateSignalRoute(matchId, playerIndex, kind) {
  if (
    !isValidMatchId(matchId) ||
    !isValidPlayerIndex(String(playerIndex)) ||
    !isValidSignalKind(kind)
  ) {
    throw new Error('Invalid signal route');
  }
}

function isValidMatchId(value) {
  return typeof value === 'string' && /^[0-9A-Za-z_-]{1,64}$/.test(value);
}

function isValidPlayerIndex(value) {
  return value === '0' || value === '1';
}

function isValidSignalKind(value) {
  return value === 'offer' || value === 'answer';
}

module.exports = {
  SIGNAL_MAX_BYTES,
  isValidMatchId,
  isValidPlayerIndex,
  isValidSignalKind,
  publishSignal,
  readSignal,
};
