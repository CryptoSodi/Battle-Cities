const economyStore = require('./economyStore');
const eventStore = require('./eventStore');
const ledgerStore = require('./ledgerStore');
const phaseStore = require('./phaseStore');
const airdropStore = require('./airdropStore');
const matchResultStore = require('./matchResultStore');
const rateLimiter = require('./rateLimiter');
const stakingStore = require('./stakingStore');
const tradingStore = require('./tradingStore');

// Express mirrors of the Milestone 3-6 Vercel handlers (api/events*, quests*,
// phases, staking/*, trading/*, boost/status, airdrops/*) for the webpack dev
// server. Same request/response contracts as the api/ files — keep both in
// sync when a contract changes.

function attachDevApiExtras(app, { readJsonBody, resolveSessionPlayer, sendJson }) {
  // ---------- events / quests / phases (Milestone 3) ----------

  app.get('/api/events', (request, response) => {
    sendJson(response, 200, { items: eventStore.listEvents() });
  });

  app.get('/api/events/detail', async (request, response) => {
    const slug = typeof request.query.slug === 'string' ? request.query.slug : '';
    if (eventStore.findEventBySlug(slug) === null) {
      sendJson(response, 404, { error: 'Event not found' });
      return;
    }

    const player = await resolveSessionPlayer(request);
    const boards = await eventStore.getQuestBoard(player, slug);
    const me =
      player === null
        ? null
        : await eventStore.getPlayerEventRank(player.id, slug);
    sendJson(response, 200, { item: boards[0], me });
  });

  app.get('/api/events/leaderboard', async (request, response) => {
    const slug = typeof request.query.slug === 'string' ? request.query.slug : '';
    const rows = await eventStore.getEventLeaderboard(slug, 20);
    if (rows === null) {
      sendJson(response, 404, { error: 'Event not found' });
      return;
    }
    sendJson(response, 200, { rows });
  });

  app.get('/api/phases', (request, response) => {
    sendJson(response, 200, { items: phaseStore.listPhases() });
  });

  app.get('/api/quests', async (request, response) => {
    const player = await resolveSessionPlayer(request);
    sendJson(response, 200, { items: await eventStore.getQuestBoard(player, null) });
  });

  app.post('/api/quests/claim', async (request, response) => {
    const player = await resolveSessionPlayer(request);
    if (player === null) {
      sendJson(response, 401, { ok: false, error: 'Not logged in' });
      return;
    }
    if (!rateLimiter.allow('quest-claim', player.id)) {
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

    const result = await eventStore.claimQuest(player, body.questId);
    if (!result.ok) {
      sendJson(response, 400, result);
      return;
    }

    if (result.reward.fuel > 0 || result.reward.token > 0) {
      await economyStore.creditRewards(player, {
        fuel: result.reward.fuel,
        token: result.reward.token,
      });
    }

    const account = await economyStore.readAccount(player.id);
    sendJson(response, 200, {
      ...result,
      account: account === null ? null : economyStore.toPublicAccount(account),
    });
  });

  app.get('/api/economy/ledger', async (request, response) => {
    const player = await resolveSessionPlayer(request);
    if (player === null) {
      sendJson(response, 401, { authenticated: false });
      return;
    }

    const entries = await ledgerStore.listEntriesForPlayer(player.id, 20);
    sendJson(response, 200, { authenticated: true, entries });
  });

  // ---------- staking (Milestone 4) ----------

  app.get('/api/staking/summary', async (request, response) => {
    const player = await resolveSessionPlayer(request);
    sendJson(
      response,
      200,
      await stakingStore.getSummary(player === null ? null : player.id),
    );
  });

  app.get('/api/staking/leaderboard', async (request, response) => {
    sendJson(response, 200, { rows: await stakingStore.getLeaderboard(20) });
  });

  app.post('/api/staking/stake', async (request, response) => {
    const player = await resolveSessionPlayer(request);
    if (player === null) {
      sendJson(response, 401, { ok: false, error: 'Not logged in' });
      return;
    }
    if (!rateLimiter.allow('staking-action', player.id)) {
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

    const amount = Math.floor(Number(body.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      sendJson(response, 400, { ok: false, error: 'Invalid amount' });
      return;
    }

    const debited = await economyStore.debitTokens(player, amount);
    if (debited === null) {
      sendJson(response, 400, { ok: false, error: 'Not enough tokens' });
      return;
    }

    const result = await stakingStore.stake(player, amount);
    if (!result.ok) {
      await economyStore.creditRewards(player, { token: amount });
      sendJson(response, 400, result);
      return;
    }

    sendJson(response, 200, {
      ...result,
      account: economyStore.toPublicAccount(
        await economyStore.readAccount(player.id),
      ),
    });
  });

  app.post('/api/staking/unstake', async (request, response) => {
    const player = await resolveSessionPlayer(request);
    if (player === null) {
      sendJson(response, 401, { ok: false, error: 'Not logged in' });
      return;
    }
    if (!rateLimiter.allow('staking-action', player.id)) {
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

    const result = await stakingStore.unstake(player, body.amount);
    sendJson(response, result.ok ? 200 : 400, result);
  });

  app.post('/api/staking/claim', async (request, response) => {
    const player = await resolveSessionPlayer(request);
    if (player === null) {
      sendJson(response, 401, { ok: false, error: 'Not logged in' });
      return;
    }
    if (!rateLimiter.allow('staking-action', player.id)) {
      sendJson(response, 429, { ok: false, error: 'Too many requests' });
      return;
    }

    const result = await stakingStore.claimUnstaked(player);
    if (result.ok && result.amount > 0) {
      await economyStore.creditRewards(player, { token: result.amount });
    }

    const account = await economyStore.readAccount(player.id);
    sendJson(response, 200, {
      ...result,
      account: account === null ? null : economyStore.toPublicAccount(account),
    });
  });

  // ---------- trading / boost (Milestone 5) ----------

  app.get('/api/trading/tokens', (request, response) => {
    sendJson(response, 200, {
      items: tradingStore.listTokens(),
      verifyMode: tradingStore.getVerifyMode(),
    });
  });

  app.post('/api/trading/verify-swap', async (request, response) => {
    const player = await resolveSessionPlayer(request);
    if (player === null) {
      sendJson(response, 401, { ok: false, error: 'Not logged in' });
      return;
    }
    if (!rateLimiter.allow('swap-verify', player.id)) {
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

    const result = await tradingStore.recordSwap(player, body);
    sendJson(response, result.ok ? 200 : 400, result);
  });

  app.get('/api/boost/status', async (request, response) => {
    const player = await resolveSessionPlayer(request);
    if (player === null) {
      sendJson(response, 200, { authenticated: false });
      return;
    }

    const [trading, stakingSummary] = await Promise.all([
      tradingStore.getBoostStatus(player.id),
      stakingStore.getSummary(player.id),
    ]);

    sendJson(response, 200, {
      authenticated: true,
      appliesTo: ['ranked', 'events', 'arcade'],
      rankedAffected: true,
      trading,
      staking: {
        tier: stakingSummary.me.perkTier,
        staked: stakingSummary.me.staked,
        nextTier:
          stakingSummary.perkTiers.find(
            (tier) => tier.stake > stakingSummary.me.staked,
          ) || null,
      },
      shopPerks: [],
    });
  });

  // ---------- airdrops (Milestone 6) ----------

  app.get('/api/airdrops/eligibility', async (request, response) => {
    const slug = typeof request.query.slug === 'string' ? request.query.slug : '';

    if (slug === '') {
      sendJson(response, 200, { items: airdropStore.listCampaigns() });
      return;
    }

    const player = await resolveSessionPlayer(request);
    if (player === null) {
      sendJson(response, 401, { authenticated: false });
      return;
    }

    const eligibility = await airdropStore.getEligibility(slug, player.id, {
      getAllTimeGamePoints: async (id) => {
        const rank = await matchResultStore.getPlayerRank(id, null);
        return rank === null ? 0 : rank.totalPoints;
      },
      getTotalStakingSp: async (id) => {
        const summary = await stakingStore.getSummary(id);
        return summary.me.totalSp;
      },
      getTradingVolumeUsd: async (id) => {
        const status = await tradingStore.getBoostStatus(id);
        return status.totalVolumeUsd;
      },
    });

    if (eligibility === null) {
      sendJson(response, 404, { error: 'Campaign not found' });
      return;
    }

    sendJson(response, 200, { authenticated: true, eligibility });
  });

  app.post('/api/airdrops/claim', async (request, response) => {
    const player = await resolveSessionPlayer(request);
    if (player === null) {
      sendJson(response, 401, { ok: false, error: 'Not logged in' });
      return;
    }

    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, { ok: false, error: 'Invalid JSON' });
      return;
    }

    const result = await airdropStore.claim(String(body.slug || ''), player);
    sendJson(response, result.ok ? 200 : 400, result);
  });
}

module.exports = { attachDevApiExtras };
