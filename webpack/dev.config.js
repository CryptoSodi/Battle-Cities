const path = require('path');
const { merge } = require('webpack-merge');

require('../server/loadLocalEnv').loadLocalEnv();
process.env.BATTLECITY_STORAGE_MODE = 'local';

const baseConfig = require('./base.config');
const replayIdentity = require('../server/replayIdentity');
const replayStore = require('../server/replayStore');
const sessionIdentity = require('../server/sessionIdentity');
const sessionStore = require('../server/sessionStore');
const playerStore = require('../server/playerStore');
const economyStore = require('../server/economyStore');
const seasonStore = require('../server/seasonStore');
const matchResultStore = require('../server/matchResultStore');
const eventStore = require('../server/eventStore');
const leaderboardSnapshotStore = require('../server/leaderboardSnapshotStore');
const perkBadges = require('../server/perkBadges');
const playerPolicy = require('../server/playerPolicy');
const rateLimiter = require('../server/rateLimiter');
const { attachDevApiExtras } = require('../server/devApiExtras');
const walletAuth = require('../server/walletAuth');
const googleAuth = require('../server/googleAuth');

const WEBRTC_SIGNAL_TTL_MS = 5 * 60 * 1000;
const WEBRTC_SIGNAL_MAX_BYTES = 256 * 1024;
const webrtcSignals = new Map();
let nextWebRtcSignalId = 1;

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

// Session-cookie -> player record, or null when not logged in.
async function resolveSessionPlayer(request) {
  const sessionId = sessionIdentity.resolveSession(request.headers.cookie || '');
  if (sessionId === null) {
    return null;
  }

  const session = await sessionStore.readSession(sessionId);
  if (session === null || session.playerId === null) {
    return null;
  }

  return playerStore.readPlayer(session.playerId);
}

function webRtcSignalKey(matchId, playerIndex, kind) {
  return `${matchId}:${playerIndex}:${kind}`;
}

function cleanupWebRtcSignals(now = Date.now()) {
  for (const [key, signal] of webrtcSignals.entries()) {
    if (now - signal.createdAt > WEBRTC_SIGNAL_TTL_MS) {
      webrtcSignals.delete(key);
    }
  }
}

function isValidWebRtcMatchId(value) {
  return typeof value === 'string' && /^[0-9A-Za-z_-]{1,64}$/.test(value);
}

function isValidWebRtcPlayerIndex(value) {
  return value === '0' || value === '1';
}

function isValidWebRtcSignalKind(value) {
  return value === 'offer' || value === 'answer';
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

  app.get('/api/economy/account', async (request, response) => {
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

    const account = await economyStore.ensureAccountForPlayer(player);
    sendJson(response, 200, {
      authenticated: true,
      player: playerStore.toPublicPlayer(player),
      account: economyStore.toPublicAccount(account),
    });
  });

  app.put('/api/economy/account', async (request, response) => {
    const sessionId = sessionIdentity.resolveSession(
      request.headers.cookie || '',
    );

    if (sessionId === null) {
      sendJson(response, 401, { authenticated: false });
      return;
    }

    const session = await sessionStore.readSession(sessionId);
    if (session === null || session.playerId === null) {
      sendJson(response, 401, { authenticated: false });
      return;
    }

    const player = await playerStore.readPlayer(session.playerId);
    if (player === null) {
      sendJson(response, 401, { authenticated: false });
      return;
    }

    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: 'Invalid JSON' });
      return;
    }

    let account;
    try {
      account = await economyStore.upsertAccountForPlayer(
        player,
        body.account || body,
      );
    } catch (error) {
      sendJson(response, 400, { error: 'Invalid account snapshot' });
      return;
    }

    sendJson(response, 200, {
      authenticated: true,
      player: playerStore.toPublicPlayer(player),
      account: economyStore.toPublicAccount(account),
    });
  });

  app.post('/api/economy/purchase', async (request, response) => {
    const sessionId = sessionIdentity.resolveSession(
      request.headers.cookie || '',
    );

    if (sessionId === null) {
      sendJson(response, 401, { ok: false, statusText: 'NOT LOGGED IN' });
      return;
    }

    const session = await sessionStore.readSession(sessionId);
    if (session === null || session.playerId === null) {
      sendJson(response, 401, { ok: false, statusText: 'NOT LOGGED IN' });
      return;
    }

    const player = await playerStore.readPlayer(session.playerId);
    if (player === null) {
      sendJson(response, 404, { ok: false, statusText: 'PLAYER NOT FOUND' });
      return;
    }

    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { ok: false, statusText: 'INVALID JSON' });
      return;
    }

    const result = await economyStore.purchaseItemForPlayer(
      player,
      body.itemId,
      body.currency,
    );
    sendJson(response, result.ok ? 200 : 400, result);
  });

  app.get('/api/seasons/current', async (request, response) => {
    const season = await seasonStore.getCurrentSeason();
    sendJson(response, 200, { season: seasonStore.toPublicSeason(season) });
  });

  app.post('/api/matches/submit', async (request, response) => {
    const player = await resolveSessionPlayer(request);
    if (player === null) {
      sendJson(response, 401, { ok: false, error: 'Not logged in' });
      return;
    }

    if (!rateLimiter.allow('matches-submit', player.id)) {
      sendJson(response, 429, { ok: false, error: 'Too many requests' });
      return;
    }

    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { ok: false, error: 'Invalid JSON' });
      return;
    }

    const season = await seasonStore.getCurrentSeason();
    const result = await matchResultStore.submitResult(player, season, body);

    // Server-derived facts drive event quest progress (Milestone 3). Guests
    // are virtual players: stored provider-tagged (never ranked), and they
    // don't progress quests or touch the event economy.
    if (!playerPolicy.isVirtualPlayer(player)) {
      await eventStore.applyMatchResult(player, result);
    }

    sendJson(response, 200, {
      ok: true,
      result: matchResultStore.toPublicResult(result),
    });
  });

  app.post(
    '/api/webrtc/matches/:matchId/players/:playerIndex/signals/:kind',
    async (request, response) => {
      const { matchId, playerIndex, kind } = request.params;
      if (
        !isValidWebRtcMatchId(matchId) ||
        !isValidWebRtcPlayerIndex(playerIndex) ||
        !isValidWebRtcSignalKind(kind)
      ) {
        sendJson(response, 400, { ok: false, error: 'Invalid signal route' });
        return;
      }

      let body;
      try {
        body = await readJsonBody(request);
      } catch (error) {
        sendJson(response, 400, { ok: false, error: 'Invalid JSON' });
        return;
      }

      if (
        typeof body.code !== 'string' ||
        body.code.length === 0 ||
        Buffer.byteLength(body.code, 'utf8') > WEBRTC_SIGNAL_MAX_BYTES
      ) {
        sendJson(response, 400, { ok: false, error: 'Invalid signal code' });
        return;
      }

      cleanupWebRtcSignals();
      const createdAt = Date.now();
      const signal = {
        id: nextWebRtcSignalId,
        matchId,
        playerIndex: Number(playerIndex),
        kind,
        code: body.code,
        createdAt,
      };
      nextWebRtcSignalId += 1;
      webrtcSignals.set(webRtcSignalKey(matchId, playerIndex, kind), signal);
      sendJson(response, 201, { ok: true, id: signal.id, createdAt });
    },
  );

  app.get(
    '/api/webrtc/matches/:matchId/players/:playerIndex/signals/:kind',
    (request, response) => {
      const { matchId, playerIndex, kind } = request.params;
      if (
        !isValidWebRtcMatchId(matchId) ||
        !isValidWebRtcPlayerIndex(playerIndex) ||
        !isValidWebRtcSignalKind(kind)
      ) {
        sendJson(response, 400, { ok: false, error: 'Invalid signal route' });
        return;
      }

      cleanupWebRtcSignals();
      const after =
        typeof request.query.after === 'string'
          ? Number(request.query.after)
          : 0;
      const signal = webrtcSignals.get(
        webRtcSignalKey(matchId, playerIndex, kind),
      );
      if (signal === undefined || signal.id <= after) {
        sendJson(response, 200, { ok: true, signal: null });
        return;
      }

      sendJson(response, 200, {
        ok: true,
        signal: {
          id: signal.id,
          matchId: signal.matchId,
          playerIndex: signal.playerIndex,
          kind: signal.kind,
          code: signal.code,
          createdAt: signal.createdAt,
        },
      });
    },
  );

  app.get('/api/rankings', async (request, response) => {
    const scope = request.query.scope === 'trading' ? 'trading' : 'gaming';
    const requestedSeasonId =
      typeof request.query.seasonId === 'string' ? request.query.seasonId : '';

    const currentSeason = await seasonStore.getCurrentSeason();
    const seasons = await seasonStore.listSeasons();
    const seasonId =
      requestedSeasonId === 'all'
        ? null
        : requestedSeasonId === ''
        ? currentSeason.id
        : requestedSeasonId;

    // Trading rows stay empty until Milestone 5 lands trading volume. A
    // closed season serves its immutable snapshot (frozen perks included);
    // live scopes compute fresh and resolve perk badges now.
    let rows = [];
    if (scope === 'gaming') {
      const snapshot =
        seasonId === null
          ? null
          : await leaderboardSnapshotStore.readSnapshot('gaming', seasonId);

      if (snapshot !== null) {
        rows = snapshot;
      } else {
        rows = await matchResultStore.getLeaderboard(seasonId, 20);
        const badges = await perkBadges.getPerkBadges(
          rows.map((row) => row.playerId),
        );
        rows = rows.map((row) => ({
          ...row,
          perks: badges[row.playerId] || [],
        }));
      }
    }

    let me = null;
    const player = await resolveSessionPlayer(request);
    if (player !== null) {
      if (playerPolicy.isVirtualPlayer(player)) {
        // Guests are virtual players — permanently unranked.
        me = {
          displayName: player.displayName,
          rank: null,
          totalPoints: 0,
          matches: 0,
          guest: true,
        };
      } else if (scope === 'gaming') {
        const rank = await matchResultStore.getPlayerRank(player.id, seasonId);
        me = {
          displayName: player.displayName,
          rank: rank === null ? null : rank.rank,
          totalPoints: rank === null ? 0 : rank.totalPoints,
          matches: rank === null ? 0 : rank.matches,
        };
      } else {
        me = { displayName: player.displayName, rank: null, totalPoints: 0 };
      }
    }

    sendJson(response, 200, {
      scope,
      seasonId,
      currentSeason: seasonStore.toPublicSeason(currentSeason),
      seasons: seasons.map((season) => seasonStore.toPublicSeason(season)),
      rows: rows.map((row) => ({
        rank: row.rank,
        displayName: row.displayName,
        walletAddress: row.walletAddress,
        totalPoints: row.totalPoints,
        matches: row.matches,
        perks: [],
      })),
      me,
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

  app.post('/api/replays/validate', async (request, response) => {
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

    if (typeof body.id !== 'string' || body.id.length === 0) {
      sendJson(response, 400, { error: 'Replay id is required' });
      return;
    }

    const record = await replayStore.verifyRecord(
      body.id,
      replayGuest.guestId,
    );
    if (record === null) {
      sendJson(response, 404, { error: 'Replay not found' });
      return;
    }

    sendJson(response, 200, { item: replayStore.toSummary(record) });
  });

  // Milestone 3-6 routes (events, quests, phases, staking, trading, boost,
  // airdrops) live in server/devApiExtras.js to keep this file readable.
  attachDevApiExtras(app, { readJsonBody, resolveSessionPlayer, sendJson });
}

module.exports = merge(baseConfig, {
  mode: 'development',

  devtool: 'source-map',

  devServer: {
    client: {
      overlay: false,
    },
    static: {
      directory: path.resolve(__dirname, '../dist'),
    },
    host: '0.0.0.0',
    server: 'https',
    allowedHosts: 'all',
    proxy: [
      {
        context: ['/local-game'],
        target: 'ws://127.0.0.1:8787',
        ws: true,
        pathRewrite: { '^/local-game': '/ws' },
      },
    ],
    setupMiddlewares: (middlewares, devServer) => {
      attachReplayApi(devServer.app);
      return middlewares;
    },
  },
});
