const merge = require('webpack-merge');

require('../server/loadLocalEnv').loadLocalEnv();

const baseConfig = require('./base.config');
const replayIdentity = require('../server/replayIdentity');
const replayStore = require('../server/replayStore');
const sessionIdentity = require('../server/sessionIdentity');
const sessionStore = require('../server/sessionStore');

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';

    request.on('data', (chunk) => {
      raw += chunk;
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function sendJson(response, status, body) {
  response.status(status).json(body);
}

function setReplayCookie(response, replayGuest) {
  if (replayGuest.setCookie !== null) {
    response.setHeader('set-cookie', replayGuest.setCookie);
  }
}

function attachReplayApi(app) {
  if (app.locals?.battleCityReplayApiAttached) {
    return;
  }
  app.locals = app.locals || {};
  app.locals.battleCityReplayApiAttached = true;

  app.get('/api/session', async (request, response) => {
    const sessionId = sessionIdentity.resolveSession(
      request.headers.cookie || '',
    );

    if (sessionId === null) {
      sendJson(response, 200, { authenticated: false });
      return;
    }

    const session = await sessionStore.readSession(sessionId);
    if (session === null) {
      response.setHeader(
        'set-cookie',
        sessionIdentity.createClearedSessionCookie(),
      );
      sendJson(response, 200, { authenticated: false });
      return;
    }

    sendJson(response, 200, sessionStore.toPublicSession(session));
  });

  app.post('/api/session', async (request, response) => {
    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: 'Invalid JSON' });
      return;
    }

    if (body.provider !== 'guest') {
      sendJson(response, 400, { error: 'Unsupported login provider' });
      return;
    }

    const session = await sessionStore.createGuestSession();
    response.setHeader(
      'set-cookie',
      sessionIdentity.createSessionCookie(session.id),
    );
    sendJson(response, 201, sessionStore.toPublicSession(session));
  });

  app.get('/api/replays', async (request, response) => {
    const replayGuest = replayIdentity.resolveReplayGuest(
      request.headers.cookie || '',
    );
    setReplayCookie(response, replayGuest);

    const { id } = request.query;

    if (typeof id === 'string') {
      const record = await replayStore.readRecord(id, replayGuest.guestId);
      if (record === null) {
        sendJson(response, 404, { error: 'Replay not found' });
        return;
      }

      sendJson(response, 200, { item: record });
      return;
    }

    sendJson(response, 200, {
      items: await replayStore.listSummaries(replayGuest.guestId),
    });
  });

  app.post('/api/replays', async (request, response) => {
    const replayGuest = replayIdentity.resolveReplayGuest(
      request.headers.cookie || '',
    );
    setReplayCookie(response, replayGuest);

    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: 'Invalid JSON' });
      return;
    }

    if (!replayStore.isValidReplay(body.replay)) {
      sendJson(response, 400, { error: 'Invalid replay payload' });
      return;
    }

    const record = await replayStore.createRecord(
      replayGuest.guestId,
      body.replay,
    );
    sendJson(response, 201, { item: replayStore.toSummary(record) });
  });
}

module.exports = merge(baseConfig, {
  mode: 'development',

  devtool: 'source-map',

  devServer: {
    contentBase: './dist',
    host: '192.168.100.19',
    https: true,
    public: '192.168.100.19:8080',
    before: attachReplayApi,
    after: attachReplayApi,
  },
});
