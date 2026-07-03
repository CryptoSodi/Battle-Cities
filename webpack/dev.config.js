const merge = require('webpack-merge');

require('../server/loadLocalEnv').loadLocalEnv();

const baseConfig = require('./base.config');
const replayIdentity = require('../server/replayIdentity');
const replayStore = require('../server/replayStore');
const sessionIdentity = require('../server/sessionIdentity');
const sessionStore = require('../server/sessionStore');
const playerStore = require('../server/playerStore');
const walletAuth = require('../server/walletAuth');
const googleAuth = require('../server/googleAuth');

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

  app.get('/api/auth/google/start', (request, response) => {
    try {
      const origin = googleAuth.getOriginFromExpressRequest(request);
      response.redirect(googleAuth.createAuthorizationUrl(origin));
    } catch (error) {
      response.redirect('/?authError=google_config');
    }
  });

  app.get('/api/auth/google/callback', async (request, response) => {
    const { code, state } = request.query;

    if (typeof code !== 'string' || typeof state !== 'string') {
      response.redirect('/?authError=google');
      return;
    }

    try {
      const login = await googleAuth.completeLogin({ code, state });
      const session = await sessionStore.createGoogleSession(login.profile);
      response.setHeader(
        'set-cookie',
        sessionIdentity.createSessionCookie(session.id),
      );
      response.redirect('/');
    } catch (error) {
      response.redirect('/?authError=google');
    }
  });

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

    if (body.provider !== 'guest' && body.provider !== 'wallet') {
      sendJson(response, 400, { error: 'Unsupported login provider' });
      return;
    }

    if (
      body.provider === 'wallet' &&
      !(await walletAuth.verifyChallenge({
        walletAddress: body.walletAddress,
        nonce: body.nonce,
        message: body.message,
        signature: body.signature,
      }))
    ) {
      sendJson(response, 401, { error: 'Invalid wallet signature' });
      return;
    }

    const session =
      body.provider === 'wallet'
        ? await sessionStore.createWalletSession(body.walletAddress)
        : await sessionStore.createGuestSession();
    response.setHeader(
      'set-cookie',
      sessionIdentity.createSessionCookie(session.id),
    );
    sendJson(response, 201, sessionStore.toPublicSession(session));
  });

  app.put('/api/session', async (request, response) => {
    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: 'Invalid JSON' });
      return;
    }

    if (!walletAuth.isValidWalletAddress(body.walletAddress)) {
      sendJson(response, 400, { error: 'Invalid wallet address' });
      return;
    }

    const challenge = await walletAuth.createChallenge(body.walletAddress);
    sendJson(response, 201, challenge);
  });

  app.delete('/api/session', async (request, response) => {
    const sessionId = sessionIdentity.resolveSession(
      request.headers.cookie || '',
    );

    if (sessionId !== null) {
      await sessionStore.deleteSession(sessionId);
    }

    response.setHeader(
      'set-cookie',
      sessionIdentity.createClearedSessionCookie(),
    );
    sendJson(response, 200, { authenticated: false });
  });

  app.get('/api/player', async (request, response) => {
    const sessionId = sessionIdentity.resolveSession(
      request.headers.cookie || '',
    );

    if (sessionId === null) {
      sendJson(response, 200, { authenticated: false });
      return;
    }

    const session = await sessionStore.readSession(sessionId);
    if (session === null || session.playerId === null) {
      sendJson(response, 200, { authenticated: false });
      return;
    }

    const player = await playerStore.readPlayer(session.playerId);
    if (player === null) {
      sendJson(response, 200, { authenticated: false });
      return;
    }

    sendJson(response, 200, {
      authenticated: true,
      player: playerStore.toPublicPlayer(player),
    });
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
    host: 'localhost',
    https: true,
    public: 'localhost:8080',
    before: attachReplayApi,
    after: attachReplayApi,
  },
});
