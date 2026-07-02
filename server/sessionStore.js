const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const TABLE_NAME = 'battlecity_sessions';

let pgPool = null;

function getDataDir() {
  return (
    process.env.BATTLECITY_SESSION_DIR ||
    path.join(process.cwd(), 'server-data', 'sessions')
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
  return getDatabaseUrl() !== '';
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

async function ensureSchema() {
  await getPgPool().query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL,
      player_id TEXT NULL,
      wallet_address TEXT NULL
    );

    ALTER TABLE ${TABLE_NAME}
      ADD COLUMN IF NOT EXISTS wallet_address TEXT NULL;

    CREATE INDEX IF NOT EXISTS battlecity_sessions_provider_created_idx
      ON ${TABLE_NAME} (provider, created_at DESC);
  `);
}

async function ensureDataDir() {
  await fs.mkdir(getDataDir(), { recursive: true });
}

function getSessionPath(id) {
  return path.join(getDataDir(), `${id}.json`);
}

async function createGuestSession() {
  return createSession('guest', null);
}

async function createWalletSession(walletAddress) {
  if (!isValidWalletAddress(walletAddress)) {
    throw new Error('Invalid wallet address');
  }

  return createSession('wallet', walletAddress);
}

async function createSession(provider, walletAddress) {
  const now = new Date().toISOString();
  const session = {
    id: createSessionId(),
    provider,
    createdAt: now,
    lastSeenAt: now,
    playerId: walletAddress === null ? null : `wallet:${walletAddress}`,
    walletAddress,
  };

  if (hasPersistentConfig()) {
    await ensureSchema();
    await getPgPool().query(
      `
        INSERT INTO ${TABLE_NAME}
          (id, provider, created_at, last_seen_at, player_id, wallet_address)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        session.id,
        session.provider,
        session.createdAt,
        session.lastSeenAt,
        session.playerId,
        session.walletAddress,
      ],
    );
    return session;
  }

  await ensureDataDir();
  await fs.writeFile(getSessionPath(session.id), JSON.stringify(session), 'utf8');

  return session;
}

async function readSession(id) {
  if (!isValidSessionId(id)) {
    return null;
  }

  if (hasPersistentConfig()) {
    await ensureSchema();
    const result = await getPgPool().query(
      `
        SELECT id, provider, created_at, last_seen_at, player_id
          , wallet_address
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
    const session = {
      id: row.id,
      provider: row.provider,
      createdAt: new Date(row.created_at).toISOString(),
      lastSeenAt: new Date(row.last_seen_at).toISOString(),
      playerId: row.player_id,
      walletAddress: row.wallet_address,
    };
    await touchSession(session.id);
    return session;
  }

  try {
    const raw = await fs.readFile(getSessionPath(id), 'utf8');
    const session = JSON.parse(raw);
    if (!isValidSession(session)) {
      return null;
    }
    await touchSession(session.id);
    return session;
  } catch {
    return null;
  }
}

async function touchSession(id) {
  const lastSeenAt = new Date().toISOString();

  if (hasPersistentConfig()) {
    await getPgPool().query(
      `UPDATE ${TABLE_NAME} SET last_seen_at = $1 WHERE id = $2`,
      [lastSeenAt, id],
    );
    return;
  }

  try {
    const raw = await fs.readFile(getSessionPath(id), 'utf8');
    const session = JSON.parse(raw);
    session.lastSeenAt = lastSeenAt;
    await fs.writeFile(getSessionPath(id), JSON.stringify(session), 'utf8');
  } catch {
    // Best-effort only; readSession still controls validity.
  }
}

function toPublicSession(session) {
  return {
    authenticated: true,
    provider: session.provider,
    playerId: session.playerId,
    walletAddress: session.walletAddress || null,
    createdAt: session.createdAt,
  };
}

function createSessionId() {
  return `sess-${Date.now().toString(36)}-${crypto
    .randomBytes(12)
    .toString('hex')}`;
}

function isValidSessionId(value) {
  return typeof value === 'string' && /^sess-[a-z0-9-]+$/i.test(value);
}

function isValidSession(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    isValidSessionId(value.id) &&
    (value.provider === 'guest' || value.provider === 'wallet') &&
    typeof value.createdAt === 'string' &&
    typeof value.lastSeenAt === 'string' &&
    (value.walletAddress === null ||
      typeof value.walletAddress === 'undefined' ||
      isValidWalletAddress(value.walletAddress))
  );
}

function isValidWalletAddress(value) {
  return (
    typeof value === 'string' &&
    value.length >= 32 &&
    value.length <= 64 &&
    /^[1-9A-HJ-NP-Za-km-z]+$/.test(value)
  );
}

module.exports = {
  createGuestSession,
  createWalletSession,
  isPersistentStoreConfigured: hasPersistentConfig,
  isValidWalletAddress,
  readSession,
  toPublicSession,
};
