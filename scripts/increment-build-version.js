const fs = require('fs');
const path = require('path');

const versionPath = path.resolve(__dirname, '../version.json');
const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));

version.build = Number(version.build || 0) + 1;
fs.writeFileSync(versionPath, `${JSON.stringify(version, null, 2)}\n`);

process.stdout.write(
  `Battle Cities version: ${version.major}.${version.minor}.${version.build}\n`,
);
