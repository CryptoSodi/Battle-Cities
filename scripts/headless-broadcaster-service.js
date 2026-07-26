const { spawn } = require('child_process');
const { randomBytes } = require('crypto');
const {
  createReadStream,
  existsSync,
  mkdtempSync,
  rmSync,
  statSync,
} = require('fs');
const { createServer } = require('http');
const { tmpdir } = require('os');
const { extname, join, resolve, sep } = require('path');

const host = process.env.BROADCASTER_HOST || '127.0.0.1';
const port = Number.parseInt(process.env.BROADCASTER_PORT || '7777', 10);
const publicUrl = new URL(
  process.env.BROADCASTER_PUBLIC_URL ||
    'https://broadcaster.battlecities.com',
);
const clientUrl = new URL(
  process.env.BATTLECITY_CLIENT_URL || 'https://battlecities.com',
);
const apiUrl = new URL(
  process.env.BATTLECITY_API_URL || 'https://api.battlecities.com',
);
const serviceToken = process.env.BROADCASTER_SERVICE_TOKEN || '';
const distRoot = resolve(__dirname, '..', 'dist');
const matches = new Map();

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
};

function json(response, status, body) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

function authorized(request) {
  if (serviceToken === '') {
    return true;
  }
  return request.headers.authorization === `Bearer ${serviceToken}`;
}

function normalizeMatchId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 64);
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

function clientMatchUrl(matchId, level, role) {
  const url = new URL(clientUrl);
  url.searchParams.set('mode', 'webrtc');
  url.searchParams.set('match', matchId);
  url.searchParams.set('level', level.toString());
  if (role === 'observer') {
    url.searchParams.set('observer', '1');
  } else {
    url.searchParams.set('player', role.toString());
  }
  return url.toString();
}

function matchResponse(match) {
  return {
    matchId: match.id,
    level: match.level,
    status: match.status,
    startedAt: match.startedAt,
    endedAt: match.endedAt,
    statusUrl: new URL(`/matches/${match.id}`, publicUrl).toString(),
    playerOneUrl: clientMatchUrl(match.id, match.level, 1),
    playerTwoUrl: clientMatchUrl(match.id, match.level, 2),
    observerUrl: clientMatchUrl(match.id, match.level, 'observer'),
  };
}

function launchMatch(matchId, level) {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error('Chrome/Chromium was not found. Set CHROME_PATH.');
  }

  const runtimeUrl = new URL(`http://${host}:${port}/`);
  runtimeUrl.searchParams.set('mode', 'webrtc');
  runtimeUrl.searchParams.set('broadcaster', '1');
  runtimeUrl.searchParams.set('headless', '1');
  runtimeUrl.searchParams.set('match', matchId);
  runtimeUrl.searchParams.set('level', level.toString());

  const profileDirectory = mkdtempSync(
    join(tmpdir(), `battlecity-${matchId}-`),
  );
  const args = [
    '--headless=new',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-dev-shm-usage',
    '--disable-renderer-backgrounding',
    '--mute-audio',
    '--no-first-run',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDirectory}`,
  ];
  if (process.env.CHROME_NO_SANDBOX === '1') {
    args.push('--no-sandbox');
  }
  args.push(runtimeUrl.toString());

  const child = spawn(chromePath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const match = {
    id: matchId,
    level,
    child,
    profileDirectory,
    status: 'running',
    startedAt: new Date().toISOString(),
    endedAt: null,
  };
  matches.set(matchId, match);

  const forwardLog = (stream, label) => {
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      process[label].write(`[match:${matchId}] ${chunk}`);
    });
  };
  forwardLog(child.stdout, 'stdout');
  forwardLog(child.stderr, 'stderr');

  child.on('error', (error) => {
    match.status = 'failed';
    match.endedAt = new Date().toISOString();
    console.error(`[match:${matchId}] ${error.message}`);
  });
  child.on('exit', (code, signal) => {
    if (match.status === 'running') {
      match.status = code === 0 || signal ? 'stopped' : 'failed';
    }
    match.endedAt = new Date().toISOString();
    rmSync(profileDirectory, { recursive: true, force: true });
    console.log(
      `[match:${matchId}] Chrome exited (code=${code}, signal=${signal}).`,
    );
  });

  return match;
}

function stopMatch(match) {
  if (match.status !== 'running') {
    return;
  }
  match.status = 'stopping';
  match.child.kill('SIGTERM');
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) {
      throw new Error('Request body is too large.');
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function proxyApi(request, response, url) {
  const target = new URL(`${url.pathname}${url.search}`, apiUrl);
  const headers = { ...request.headers };
  delete headers.host;
  delete headers.connection;
  delete headers['content-length'];
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const body = chunks.length === 0 ? undefined : Buffer.concat(chunks);
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body,
    redirect: 'manual',
  });
  const responseHeaders = {};
  upstream.headers.forEach((value, name) => {
    if (name !== 'content-encoding' && name !== 'content-length') {
      responseHeaders[name] = value;
    }
  });
  response.writeHead(upstream.status, responseHeaders);
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

function serveStatic(response, pathname) {
  let relativePath = decodeURIComponent(pathname);
  if (relativePath === '/') {
    relativePath = '/index.html';
  }
  const filePath = resolve(distRoot, `.${relativePath}`);
  if (!filePath.startsWith(`${distRoot}${sep}`)) {
    json(response, 403, { error: 'Invalid path.' });
    return;
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    json(response, 404, { error: 'Not found.' });
    return;
  }
  response.writeHead(200, {
    'cache-control': relativePath === '/index.html' ? 'no-store' : 'public, max-age=300',
    'content-length': statSync(filePath).size,
    'content-type': mimeTypes[extname(filePath).toLowerCase()] ||
      'application/octet-stream',
  });
  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || host}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      await proxyApi(request, response, url);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      json(response, 200, {
        ok: true,
        activeMatches: Array.from(matches.values()).filter(
          (match) => match.status === 'running',
        ).length,
      });
      return;
    }

    if (url.pathname === '/matches' && request.method === 'GET') {
      if (!authorized(request)) {
        json(response, 401, { error: 'Unauthorized.' });
        return;
      }
      json(response, 200, {
        matches: Array.from(matches.values()).map(matchResponse),
      });
      return;
    }

    if (url.pathname === '/matches' && request.method === 'POST') {
      if (!authorized(request)) {
        json(response, 401, { error: 'Unauthorized.' });
        return;
      }
      const body = await readJson(request);
      const matchId = normalizeMatchId(body.matchId) ||
        randomBytes(4).toString('hex');
      const level = Math.max(1, Number.parseInt(body.level, 10) || 1);
      const existing = matches.get(matchId);
      if (existing && existing.status === 'running') {
        json(response, 409, { error: 'Match is already running.' });
        return;
      }
      const match = launchMatch(matchId, level);
      json(response, 201, matchResponse(match));
      return;
    }

    const matchRoute = url.pathname.match(/^\/matches\/([a-z0-9-]+)$/);
    if (matchRoute) {
      if (!authorized(request)) {
        json(response, 401, { error: 'Unauthorized.' });
        return;
      }
      const match = matches.get(matchRoute[1]);
      if (!match) {
        json(response, 404, { error: 'Match not found.' });
        return;
      }
      if (request.method === 'GET') {
        json(response, 200, matchResponse(match));
        return;
      }
      if (request.method === 'DELETE') {
        stopMatch(match);
        json(response, 202, matchResponse(match));
        return;
      }
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      serveStatic(response, url.pathname);
      return;
    }
    json(response, 404, { error: 'Not found.' });
  } catch (error) {
    console.error(error);
    json(response, 500, { error: error.message || 'Internal server error.' });
  }
});

function shutdown() {
  matches.forEach(stopMatch);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (!existsSync(join(distRoot, 'index.html'))) {
  console.error('dist/index.html is missing. Run npm run build first.');
  process.exit(1);
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('BROADCASTER_PORT must be a valid TCP port.');
  process.exit(1);
}
if (serviceToken === '') {
  console.warn(
    'BROADCASTER_SERVICE_TOKEN is unset; match lifecycle endpoints are unprotected.',
  );
}

server.listen(port, host, () => {
  console.log(`Headless broadcaster service: http://${host}:${port}`);
  console.log(`Public broadcaster origin: ${publicUrl}`);
  console.log(`Player frontend origin: ${clientUrl}`);
  console.log(`Vercel API origin: ${apiUrl}`);
});
