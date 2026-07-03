const fs = require('fs').promises;
const path = require('path');

const MAX_REPLAYS_PER_GUEST = 50;
const TABLE_NAME = 'battlecity_replays';

let pgPool = null;
let blobClient = null;

function getDataDir() {
  return (
    process.env.BATTLECITY_REPLAY_DIR ||
    path.join(process.cwd(), 'server-data', 'replays')
  );
}

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    ''
  );
}

function hasPersistentConfig() {
  return getDatabaseUrl() !== '' && process.env.BLOB_READ_WRITE_TOKEN !== '';
}

function getPgPool() {
  if (pgPool !== null) {
    return pgPool;
  }

  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: getDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
  });

  return pgPool;
}

function getBlobClient() {
  if (blobClient !== null) {
    return blobClient;
  }

  blobClient = require('@vercel/blob');
  return blobClient;
}

async function ensureSchema() {
  await getPgPool().query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id TEXT PRIMARY KEY,
      guest_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      level_number INTEGER NOT NULL,
      replay_blob_path TEXT NOT NULL,
      replay_blob_url TEXT NOT NULL,
      validation_status TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE INDEX IF NOT EXISTS battlecity_replays_guest_created_idx
      ON ${TABLE_NAME} (guest_id, created_at DESC);
  `);
}

async function ensureDataDir() {
  await fs.mkdir(getDataDir(), { recursive: true });
}

function getRecordPath(id) {
  return path.join(getDataDir(), `${id}.json`);
}

async function listSummaries(guestId) {
  if (hasPersistentConfig()) {
    return listPersistentSummaries(guestId);
  }

  return listFileSummaries(guestId);
}

async function readRecord(id, guestId) {
  if (!isSafeId(id) || !isValidGuestId(guestId)) {
    return null;
  }

  if (hasPersistentConfig()) {
    return readPersistentRecord(id, guestId);
  }

  return readFileRecord(id, guestId);
}

async function createRecord(guestId, replay) {
  normalizeReplay(replay);

  const record = {
    id: createReplayId(),
    guestId,
    createdAt: new Date().toISOString(),
    levelNumber: replay.levelNumber,
    replay,
    validationStatus: 'pending',
  };

  if (hasPersistentConfig()) {
    return createPersistentRecord(record);
  }

  return createFileRecord(record);
}

async function listPersistentSummaries(guestId) {
  await ensureSchema();

  const result = await getPgPool().query(
    `
      SELECT id, created_at, level_number, validation_status
      FROM ${TABLE_NAME}
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [MAX_REPLAYS_PER_GUEST],
  );

  return result.rows.map((row) => ({
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    levelNumber: row.level_number,
    validationStatus: row.validation_status,
  }));
}

async function readPersistentRecord(id, guestId) {
  await ensureSchema();

  const result = await getPgPool().query(
    `
      SELECT id, guest_id, created_at, level_number, replay_blob_path,
        validation_status
      FROM ${TABLE_NAME}
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  const replay = await readReplayBlob(row.replay_blob_path);
  if (!isValidReplay(replay)) {
    return null;
  }

  return {
    id: row.id,
    guestId: row.guest_id,
    createdAt: new Date(row.created_at).toISOString(),
    levelNumber: row.level_number,
    validationStatus: row.validation_status,
    replay,
  };
}

async function createPersistentRecord(record) {
  await ensureSchema();

  const blobPath = `replays/${record.guestId}/${record.id}.json`;
  const blob = await getBlobClient().put(
    blobPath,
    JSON.stringify(record.replay),
    {
      access: 'private',
      addRandomSuffix: false,
      contentType: 'application/json',
    },
  );

  await getPgPool().query(
    `
      INSERT INTO ${TABLE_NAME}
        (id, guest_id, created_at, level_number, replay_blob_path,
          replay_blob_url, validation_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      record.id,
      record.guestId,
      record.createdAt,
      record.levelNumber,
      blobPath,
      blob.url,
      record.validationStatus,
    ],
  );

  await prunePersistentRecords(record.guestId);

  return record;
}

async function readReplayBlob(pathname) {
  const { get } = getBlobClient();
  const result = await get(pathname, { access: 'private' });

  if (result?.statusCode !== 200 || result.stream === null) {
    return null;
  }

  return new Response(result.stream).json();
}

async function prunePersistentRecords(guestId) {
  const result = await getPgPool().query(
    `
      SELECT id, replay_blob_path
      FROM ${TABLE_NAME}
      WHERE guest_id = $1
      ORDER BY created_at DESC
      OFFSET $2
    `,
    [guestId, MAX_REPLAYS_PER_GUEST],
  );

  if (result.rowCount === 0) {
    return;
  }

  await getPgPool().query(
    `DELETE FROM ${TABLE_NAME} WHERE id = ANY($1::text[])`,
    [result.rows.map((row) => row.id)],
  );

  const { del } = getBlobClient();
  await Promise.all(
    result.rows.map((row) => del(row.replay_blob_path).catch(() => undefined)),
  );
}

async function listFileRecords() {
  await ensureDataDir();

  const files = await fs.readdir(getDataDir());
  const records = await Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .map(async (file) => {
        try {
          const raw = await fs.readFile(path.join(getDataDir(), file), 'utf8');
          const record = JSON.parse(raw);
          return isValidRecord(record) ? record : null;
        } catch {
          return null;
        }
      }),
  );

  return records.filter((record) => record !== null);
}

async function listFileSummaries(guestId) {
  const records = await listFileRecords();

  return records
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_REPLAYS_PER_GUEST)
    .map(toSummary);
}

async function readFileRecord(id, guestId) {
  try {
    const raw = await fs.readFile(getRecordPath(id), 'utf8');
    const record = JSON.parse(raw);
    if (!isValidRecord(record)) {
      return null;
    }

    return record;
  } catch {
    return null;
  }
}

async function createFileRecord(record) {
  await ensureDataDir();
  await fs.writeFile(getRecordPath(record.id), JSON.stringify(record), 'utf8');
  await pruneFileRecords(record.guestId);

  return record;
}

async function pruneFileRecords(guestId) {
  const records = (await listFileRecords())
    .filter((record) => record.guestId === guestId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  await Promise.all(
    records.slice(MAX_REPLAYS_PER_GUEST).map((record) => {
      return fs.unlink(getRecordPath(record.id)).catch(() => undefined);
    }),
  );
}

function toSummary(record) {
  return {
    id: record.id,
    createdAt: record.createdAt,
    levelNumber: record.levelNumber,
    validationStatus: record.validationStatus || 'pending',
  };
}

function createReplayId() {
  return `${Date.now().toString(36)}-${Math.floor(
    Math.random() * 0xffffff,
  ).toString(36)}`;
}

function isValidGuestId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 96;
}

function isSafeId(value) {
  return typeof value === 'string' && /^[a-z0-9-]+$/i.test(value);
}

function isValidRecord(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    isSafeId(value.id) &&
    isValidGuestId(value.guestId) &&
    typeof value.createdAt === 'string' &&
    typeof value.levelNumber === 'number' &&
    isValidReplay(value.replay)
  );
}

function isValidReplay(value) {
  normalizeReplay(value);

  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.seed === 'number' &&
    typeof value.levelNumber === 'number' &&
    typeof value.deviceFrames === 'object' &&
    value.deviceFrames !== null &&
    typeof value.activeDeviceType === 'number' &&
    typeof value.enemyTraces === 'object' &&
    value.enemyTraces !== null &&
    typeof value.runConsumables === 'object' &&
    value.runConsumables !== null &&
    Array.isArray(value.runConsumables.powerups) &&
    Array.isArray(value.runConsumables.powerupItems) &&
    Array.isArray(value.runConsumables.powerupCounts) &&
    typeof value.runConsumables.extraLives === 'number' &&
    Array.isArray(value.powerupSpawns)
  );
}

function normalizeReplay(value) {
  if (typeof value !== 'object' || value === null) {
    return;
  }

  if (value.runConsumables === undefined) {
    value.runConsumables = {
      powerups: [],
      powerupItems: [],
      powerupCounts: [],
      extraLives: 0,
    };
  }

  if (
    typeof value.runConsumables === 'object' &&
    value.runConsumables !== null &&
    value.runConsumables.powerupCounts === undefined &&
    Array.isArray(value.runConsumables.powerupItems)
  ) {
    value.runConsumables.powerupCounts = value.runConsumables.powerupItems.map(
      () => 1,
    );
  }
}

module.exports = {
  createRecord,
  isPersistentStoreConfigured: hasPersistentConfig,
  isValidGuestId,
  isValidReplay,
  listSummaries,
  readRecord,
  toSummary,
};
