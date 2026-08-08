"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadReplayRecord = exports.listReplaySummaries = exports.saveReplay = exports.getLastSavedReplayId = void 0;
const game_1 = require("../game");
const api_1 = require("../network/api");
const tank_1 = require("../tank");
const REPLAY_SUMMARY_CACHE_TTL_MS = 30 * 1000;
let replaySummaryCache = null;
let replaySummaryCacheTime = 0;
// Id of the most recently uploaded replay this session, so the match-result
// submission can reference the artifact a validation worker would re-simulate
// (see docs/mattle-inspired-infrastructure-plan.md, Milestones 2/7). Best
// effort: null when no replay was recorded or the upload hasn't finished.
let lastSavedReplayId = null;
function getLastSavedReplayId() {
    return lastSavedReplayId;
}
exports.getLastSavedReplayId = getLastSavedReplayId;
async function saveReplay(_gameStorage, replay) {
    const response = await (0, api_1.apiFetch)('/api/replays', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            replay,
            metadata: replay.metadata,
        }),
    });
    if (!response.ok) {
        throw new Error('Replay could not be saved.');
    }
    try {
        const body = await response.json();
        if (typeof body?.item?.id === 'string') {
            lastSavedReplayId = body.item.id;
        }
    }
    catch {
        // Response body is informational only; the save itself succeeded.
    }
    replaySummaryCache = null;
    replaySummaryCacheTime = 0;
}
exports.saveReplay = saveReplay;
async function listReplaySummaries(_gameStorage) {
    if (replaySummaryCache !== null &&
        Date.now() - replaySummaryCacheTime < REPLAY_SUMMARY_CACHE_TTL_MS) {
        return replaySummaryCache.slice();
    }
    try {
        const response = await (0, api_1.apiFetch)('/api/replays');
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        const body = await response.json();
        if (Array.isArray(body.items)) {
            replaySummaryCache = body.items.filter(isValidReplaySummary);
            replaySummaryCacheTime = Date.now();
            return replaySummaryCache.slice();
        }
    }
    catch {
        return replaySummaryCache === null ? [] : replaySummaryCache.slice();
    }
}
exports.listReplaySummaries = listReplaySummaries;
async function loadReplayRecord(_gameStorage, id) {
    try {
        const response = await (0, api_1.apiFetch)(`/api/replays?id=${encodeURIComponent(id)}`);
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        const body = await response.json();
        const record = body.item;
        if (record !== undefined &&
            isValidReplayRecord(record) &&
            isValidReplay(record.replay)) {
            return record.replay;
        }
    }
    catch {
        return null;
    }
    return null;
}
exports.loadReplayRecord = loadReplayRecord;
function isValidReplaySummary(value) {
    return (typeof value === 'object' &&
        value !== null &&
        typeof value.id === 'string' &&
        typeof value.createdAt === 'string' &&
        typeof value.levelNumber === 'number' &&
        isValidMatchStatus(value.matchStatus) &&
        typeof value.score === 'number' &&
        typeof value.kills === 'number' &&
        isValidReplayResult(value.gameResult) &&
        typeof value.durationTicks === 'number');
}
function isValidReplayRecord(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const matchStatus = value.validationStatus ?? value.matchStatus;
    return (typeof value.id === 'string' &&
        typeof value.createdAt === 'string' &&
        typeof value.levelNumber === 'number' &&
        isValidMatchStatus(matchStatus) &&
        typeof value.score === 'number' &&
        typeof value.kills === 'number' &&
        isValidReplayResult(value.gameResult) &&
        typeof value.durationTicks === 'number' &&
        typeof value.replay === 'object' &&
        value.replay !== null);
}
function isValidReplay(value) {
    if (typeof value !== 'object' ||
        value === null ||
        typeof value.seed !== 'number' ||
        typeof value.levelNumber !== 'number' ||
        typeof value.deviceFrames !== 'object' ||
        value.deviceFrames === null ||
        typeof value.activeDeviceType !== 'number' ||
        typeof value.enemyTraces !== 'object' ||
        value.enemyTraces === null ||
        !Array.isArray(value.powerupSpawns)) {
        return false;
    }
    if (value.runConsumables === undefined) {
        value.runConsumables = createEmptyRunConsumables();
    }
    if (value.playerTankTiers === undefined) {
        value.playerTankTiers = [tank_1.TankTier.A, tank_1.TankTier.A];
    }
    // Replays recorded before trait boosts existed re-enact with zeros.
    if (value.runBoosts === undefined) {
        value.runBoosts = (0, game_1.createEmptyRunBoosts)();
    }
    if (value.metadata === undefined) {
        value.metadata = {
            matchStatus: 'pending',
            score: 0,
            kills: 0,
            gameResult: 'loss',
            durationTicks: 0,
        };
    }
    return (isValidPlayerTankTiers(value.playerTankTiers) &&
        isValidRunConsumables(value.runConsumables) &&
        isValidReplayMetadata(value.metadata));
}
function isValidPlayerTankTiers(value) {
    return (Array.isArray(value) &&
        value.length > 0 &&
        value.every((tier) => tier === tank_1.TankTier.A ||
            tier === tank_1.TankTier.B ||
            tier === tank_1.TankTier.C ||
            tier === tank_1.TankTier.D));
}
function createEmptyRunConsumables() {
    return {
        powerups: [],
        powerupItems: [],
        powerupCounts: [],
        extraLives: 0,
    };
}
function isValidRunConsumables(value) {
    if (typeof value !== 'object' ||
        value === null ||
        !Array.isArray(value.powerups) ||
        !Array.isArray(value.powerupItems) ||
        typeof value.extraLives !== 'number') {
        return false;
    }
    if (value.powerupCounts === undefined) {
        value.powerupCounts = value.powerupItems.map(() => 1);
    }
    return Array.isArray(value.powerupCounts);
}
function isValidReplayMetadata(value) {
    return (typeof value === 'object' &&
        value !== null &&
        isValidMatchStatus(value.matchStatus) &&
        typeof value.score === 'number' &&
        typeof value.kills === 'number' &&
        isValidReplayResult(value.gameResult) &&
        typeof value.durationTicks === 'number');
}
function isValidMatchStatus(value) {
    return value === 'pending' || value === 'verified' || value === 'rejected';
}
function isValidReplayResult(value) {
    return value === 'win' || value === 'loss';
}
