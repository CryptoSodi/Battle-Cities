const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');
const serviceWorkerPath = path.join(distDir, 'service-worker.js');
const manifestPath = path.join(distDir, 'web-version.json');

if (!fs.existsSync(distDir)) {
  throw new Error('dist directory does not exist; run webpack first');
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
  .filter((file) => file !== 'web-version.json')
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
