function normalizeEnv(value) {
  return String(value || '').trim().toLowerCase();
}

function isLocalStorageForced() {
  const mode = normalizeEnv(process.env.BATTLECITY_STORAGE_MODE);
  const forceLocal = normalizeEnv(process.env.BATTLECITY_FORCE_LOCAL_STORE);

  return (
    mode === 'local' ||
    forceLocal === '1' ||
    forceLocal === 'true' ||
    forceLocal === 'yes'
  );
}

function getDatabaseUrl() {
  if (isLocalStorageForced()) {
    return '';
  }

  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    ''
  );
}

function hasDatabaseConfig() {
  return getDatabaseUrl() !== '';
}

module.exports = {
  getDatabaseUrl,
  hasDatabaseConfig,
  isLocalStorageForced,
};
