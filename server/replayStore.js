const fs = require('fs').promises;
const path = require('path');

const MAX_REPLAYS_PER_GUEST = 20;

function getDataDir() {
  return (
    process.env.BATTLECITY_REPLAY_DIR ||
    path.join(process.cwd(), 'server-data', 'replays')
  );
}

async function ensureDataDir() {
  await fs.mkdir(getDataDir(), { recursive: true });
}

function getRecordPath(id) {
  return path.join(getDataDir(), `${id}.json`);
}

async function listRecords() {
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

async function listSummaries(guestId) {
  const records = await listRecords();

  return records
    .filter((record) => record.guestId === guestId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toSummary);
}

async function readRecord(id) {
  if (!isSafeId(id)) {
    return null;
  }

  try {
    const raw = await fs.readFile(getRecordPath(id), 'utf8');
    const record = JSON.parse(raw);
    return isValidRecord(record) ? record : null;
  } catch {
    return null;
  }
}

async function createRecord(guestId, replay) {
  normalizeReplay(replay);

  const record = {
    id: createReplayId(),
    guestId,
    createdAt: new Date().toISOString(),
    levelNumber: replay.levelNumber,
    replay,
  };

  await ensureDataDir();
  await fs.writeFile(getRecordPath(record.id), JSON.stringify(record), 'utf8');
  await pruneGuestRecords(record.guestId);

  return record;
}

async function pruneGuestRecords(guestId) {
  const records = (await listRecords())
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
  isValidGuestId,
  isValidReplay,
  listSummaries,
  readRecord,
  toSummary,
};
