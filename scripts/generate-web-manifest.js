const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');
const serviceWorkerPath = path.join(distDir, 'service-worker.js');
const manifestPath = path.join(distDir, 'web-version.json');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(distDir)) {
  throw new Error('dist directory does not exist; run webpack first');
}

// Point index.html at the content-hashed main bundle. Because the filename
// embeds the content hash, every release gets a fresh URL -- the core of the
// over-the-air (no APK rebuild) update path. Fall back to the previous plain
// name if the hashed file is unexpectedly absent.
const mainEntry = fs
  .readdirSync(distDir)
  .find((file) => /^main\.[a-f0-9]{16,32}\.js$/.test(file)) || 'main.js';
if (fs.existsSync(indexPath)) {
  const html = fs
    .readFileSync(indexPath, 'utf8')
    .replace('src="main.js"', `src="${mainEntry}"`);
  fs.writeFileSync(indexPath, html);
}

if (fs.existsSync(serviceWorkerPath)) {
  const buildSeed =
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    String(Date.now());
  const source = fs
    .readFileSync(serviceWorkerPath, 'utf8')
    .replace(/__BUILD_VERSION__/g, buildSeed.slice(0, 20));
  fs.writeFileSync(serviceWorkerPath, source);
}

const files = listFiles(distDir)
  // Config-only files that are consumed by the hosting platform (_headers,
  // _redirects) and the manifest itself are not app assets: they are never
  // served to clients, so the Android OTA updater must not try to download
  // them (a failed download would abort the whole bundle update).
  .filter(
    (file) =>
      file !== 'web-version.json' && file !== '_headers' && file !== '_redirects',
  )
  .map((file) => {
    const contents = fs.readFileSync(path.join(distDir, file));
    return {
      path: file.replace(/\\/g, '/'),
      size: contents.length,
      sha256: crypto.createHash('sha256').update(contents).digest('hex'),
    };
  })
  .sort((left, right) => left.path.localeCompare(right.path));

const versionHash = crypto.createHash('sha256');
files.forEach((file) => {
  versionHash.update(file.path);
  versionHash.update('\0');
  versionHash.update(file.sha256);
  versionHash.update('\0');
});

const manifest = {
  version: versionHash.digest('hex').slice(0, 20),
  generatedAt: new Date().toISOString(),
  files,
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated web-version.json (${manifest.version}, ${files.length} files)`);

function listFiles(directory, prefix = '') {
  const result = [];
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const relativePath = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      result.push(...listFiles(path.join(directory, entry.name), relativePath));
    } else if (entry.isFile()) {
      result.push(relativePath);
    }
  });
  return result;
}
