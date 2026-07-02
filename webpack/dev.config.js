const merge = require('webpack-merge');

const baseConfig = require('./base.config');
const replayStore = require('../server/replayStore');

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

function attachReplayApi(app) {
  if (app.locals?.battleCityReplayApiAttached) {
    return;
  }
  app.locals = app.locals || {};
  app.locals.battleCityReplayApiAttached = true;

  app.get('/api/replays', async (request, response) => {
    const { id, guestId } = request.query;

    if (typeof id === 'string') {
      const record = await replayStore.readRecord(id);
      if (record === null) {
        sendJson(response, 404, { error: 'Replay not found' });
        return;
      }

      sendJson(response, 200, { item: record });
      return;
    }

    if (!replayStore.isValidGuestId(guestId)) {
      sendJson(response, 400, { error: 'Missing guestId' });
      return;
    }

    sendJson(response, 200, {
      items: await replayStore.listSummaries(guestId),
    });
  });

  app.post('/api/replays', async (request, response) => {
    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { error: 'Invalid JSON' });
      return;
    }

    if (
      !replayStore.isValidGuestId(body.guestId) ||
      !replayStore.isValidReplay(body.replay)
    ) {
      sendJson(response, 400, { error: 'Invalid replay payload' });
      return;
    }

    const record = await replayStore.createRecord(body.guestId, body.replay);
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
