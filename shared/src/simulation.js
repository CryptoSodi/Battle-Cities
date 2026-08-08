"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BattleCitySimulation = void 0;
const TILE = 16;
const MEDIUM_TILE = 32;
const LARGE_TILE = 64;
const LEGACY_FIELD_TILES = 13;
const DEFAULT_FIELD_TILES = 20;
const TANK_SIZE = 64;
const BULLET_WIDTH = 12;
const BULLET_HEIGHT = 16;
const PLAYER_SPEED = 180;
const BULLET_SPEED = 600;
const ENEMY_LIMIT = 6;
const BASE_WIDTH = 128;
const BASE_HEIGHT = 96;
const BASE_HEART_OFFSET = 32;
const BASE_DEFENCE_DURATION = 17;
const BASE_WALL_REGIONS = [
    { x: 0, y: 0, width: 128, height: 32 },
    { x: 0, y: 32, width: 32, height: 64 },
    { x: 96, y: 32, width: 32, height: 64 },
];
class DeterministicRandom {
    constructor(seed) {
        this.state = seed >>> 0 || 1;
    }
    next() {
        this.state = (this.state + 0x6d2b79f5) >>> 0;
        let value = this.state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
    }
    integer(maxExclusive) {
        return Math.floor(this.next() * maxExclusive);
    }
    number(min, max) {
        return min + Math.floor(this.next() * (max - min));
    }
    probability(chancePercent) {
        return this.number(1, 100) <= chancePercent;
    }
}
/** DOM-free authoritative match simulation shared by Node and browser tooling. */
class BattleCitySimulation {
    constructor(map, options) {
        this.terrain = new Map();
        this.movementTerrain = new Map();
        this.enemies = new Map();
        this.bullets = [];
        this.inputs = new Map();
        this.pendingFireSeqs = new Map();
        this.playerElapsed = [0, 0];
        this.lastProcessedInputSeq = [0, 0];
        this.scores = [0, 0];
        this.nextEnemyIndex = 0;
        this.nextBulletId = 1;
        this.nextPowerupId = 1;
        this.pickupSeq = 0;
        this.frameSeq = 0;
        this.currentTick = 0;
        this.baseAlive = true;
        this.baseDefenceUntilTick = 0;
        this.enemiesFrozenUntilTick = 0;
        this.powerup = null;
        this.powerupPickup = null;
        this.map = map;
        this.tickRate = Math.max(10, Math.floor(options.tickRate ?? 60));
        this.deltaTime = 1 / this.tickRate;
        this.random = new DeterministicRandom(options.seed);
        this.disableEnemyShooting = options.disableEnemyShooting === true;
        this.stageNumber = Math.max(1, Math.floor(options.level ?? 1));
        const legacy = map.field === undefined && (map.version ?? 0) < 2;
        const widthTiles = map.field?.widthTiles ?? (legacy ? LEGACY_FIELD_TILES : DEFAULT_FIELD_TILES);
        const heightTiles = map.field?.heightTiles ?? (legacy ? LEGACY_FIELD_TILES : DEFAULT_FIELD_TILES);
        this.fieldWidth = widthTiles * LARGE_TILE;
        this.fieldHeight = heightTiles * LARGE_TILE;
        this.contentOffsetY =
            (map.version ?? 0) < 2 && heightTiles > LEGACY_FIELD_TILES
                ? this.fieldHeight - LEGACY_FIELD_TILES * LARGE_TILE
                : 0;
        this.playerSpawns = this.createPlayerSpawns();
        this.enemySpawns = this.createEnemySpawns();
        this.enemyList = (map.spawn?.enemy?.list ?? []).map((item) => ({
            tier: normalizeTier(item.tier),
            drop: item.drop === true,
        }));
        this.createTerrain();
        this.players = [this.createPlayer(0), this.createPlayer(1)];
        this.nextEnemySpawnTick = Math.ceil(0.16 * this.tickRate);
    }
    get tick() {
        return this.currentTick;
    }
    get seq() {
        return this.frameSeq;
    }
    acceptInput(packet) {
        if ((packet.player !== 0 && packet.player !== 1) ||
            !Number.isInteger(packet.seq) ||
            packet.seq <= (this.inputs.get(packet.player)?.packet.seq ?? 0) ||
            !isRotation(packet.direction)) {
            return false;
        }
        this.inputs.set(packet.player, { packet, receivedTick: this.currentTick });
        if (packet.fire) {
            this.pendingFireSeqs.set(packet.player, packet.seq);
        }
        if (Number.isFinite(packet.elapsedSeconds)) {
            this.playerElapsed[packet.player] = Math.max(0, packet.elapsedSeconds);
        }
        return true;
    }
    step() {
        this.currentTick += 1;
        this.powerupPickup = null;
        this.updatePlayers();
        this.spawnEnemy();
        this.updateEnemies();
        this.updateBullets();
        this.updatePowerup();
        this.respawnPlayers();
        return this.createFrame();
    }
    getScores() {
        return [this.scores[0], this.scores[1]];
    }
    isComplete() {
        const allPlayersDefeated = this.players.every((player) => !player.alive && player.lives <= 0);
        return !this.baseAlive || allPlayersDefeated ||
            (this.nextEnemyIndex >= this.enemyList.length && this.enemies.size === 0);
    }
    createPlayer(index) {
        const spawn = this.playerSpawns[index];
        return {
            partyIndex: index,
            tier: 'a',
            x: spawn.x,
            y: spawn.y,
            width: TANK_SIZE,
            height: TANK_SIZE,
            rotation: 0,
            moving: false,
            alive: true,
            health: 1,
            speed: PLAYER_SPEED,
            fireSeq: 0,
            fireX: spawn.x,
            fireY: spawn.y,
            fireRotation: 0,
            nextFireTick: 0,
            lastInputFireSeq: 0,
            shieldUntilTick: Math.ceil(3.5 * this.tickRate),
            stunnedUntilTick: 0,
            respawnAtTick: 0,
            lives: 3,
            previousX: spawn.x,
            previousY: spawn.y,
            aiState: 'moving',
            aiThinkUntilTick: 0,
            aiFireAtTick: 0,
            aiLastRoundedX: -1,
            aiLastRoundedY: -1,
            hasDrop: false,
        };
    }
    updatePlayers() {
        this.players.forEach((player, index) => {
            player.previousX = player.x;
            player.previousY = player.y;
            player.moving = false;
            if (!player.alive || this.currentTick < player.stunnedUntilTick) {
                return;
            }
            const input = this.inputs.get(index);
            if (input === undefined || this.currentTick - input.receivedTick > 0.5 * this.tickRate) {
                return;
            }
            const packet = input.packet;
            this.lastProcessedInputSeq[index] = packet.seq;
            const pendingFireSeq = this.pendingFireSeqs.get(index);
            if (pendingFireSeq !== undefined &&
                pendingFireSeq > player.lastInputFireSeq) {
                player.lastInputFireSeq = pendingFireSeq;
                this.pendingFireSeqs.delete(index);
                this.fire(player, 'player');
            }
            if (packet.direction !== null) {
                this.rotateTank(player, packet.direction);
            }
            if (packet.moving && packet.direction !== null) {
                player.moving = this.tryMove(player, packet.direction, player.speed * this.deltaTime);
            }
        });
    }
    spawnEnemy() {
        if (this.nextEnemyIndex >= this.enemyList.length ||
            this.enemies.size >= ENEMY_LIMIT ||
            this.currentTick < this.nextEnemySpawnTick) {
            return;
        }
        const definition = this.enemyList[this.nextEnemyIndex];
        const spawn = this.enemySpawns[this.nextEnemyIndex % this.enemySpawns.length];
        const tier = definition.tier;
        const enemy = {
            partyIndex: this.nextEnemyIndex,
            tier,
            x: spawn.x,
            y: spawn.y,
            width: TANK_SIZE,
            height: TANK_SIZE,
            rotation: 180,
            moving: false,
            alive: true,
            health: tier === 'd' ? 4 : 1,
            speed: tier === 'b' ? 240 : 120,
            fireSeq: 0,
            fireX: spawn.x,
            fireY: spawn.y,
            fireRotation: 180,
            nextFireTick: 0,
            lastInputFireSeq: 0,
            shieldUntilTick: 0,
            stunnedUntilTick: 0,
            respawnAtTick: 0,
            lives: 0,
            previousX: spawn.x,
            previousY: spawn.y,
            aiState: 'moving',
            aiThinkUntilTick: 0,
            aiFireAtTick: this.currentTick,
            aiLastRoundedX: -1,
            aiLastRoundedY: -1,
            hasDrop: definition.drop,
        };
        this.enemies.set(enemy.partyIndex, enemy);
        this.nextEnemyIndex += 1;
        this.nextEnemySpawnTick = this.currentTick + 3 * this.tickRate;
    }
    updateEnemies() {
        this.enemies.forEach((enemy) => {
            enemy.previousX = enemy.x;
            enemy.previousY = enemy.y;
            if (this.currentTick < this.enemiesFrozenUntilTick) {
                enemy.moving = false;
                enemy.aiFireAtTick += 1;
                if (enemy.aiThinkUntilTick > 0)
                    enemy.aiThinkUntilTick += 1;
                return;
            }
            if (this.disableEnemyShooting && enemy.aiState === 'firing') {
                enemy.aiState = 'moving';
            }
            if (this.currentTick >= enemy.aiFireAtTick) {
                if (!this.disableEnemyShooting) {
                    const hasFired = this.fire(enemy, 'enemy');
                    if (hasFired && enemy.aiState === 'firing') {
                        enemy.aiState = 'moving';
                    }
                }
                this.scheduleEnemyFire(enemy);
            }
            if (enemy.aiState === 'firing') {
                enemy.moving = false;
                return;
            }
            if (enemy.aiState === 'thinking' ||
                enemy.aiState === 'unstuck-thinking') {
                enemy.moving = false;
                if (this.currentTick < enemy.aiThinkUntilTick)
                    return;
                if (!this.disableEnemyShooting &&
                    enemy.aiState === 'thinking' &&
                    this.random.probability(30)) {
                    enemy.aiState = 'firing';
                    return;
                }
                enemy.aiState = 'moving';
                this.rotateTank(enemy, this.getNextEnemyRotation(enemy));
                return;
            }
            enemy.moving = this.tryMove(enemy, enemy.rotation, enemy.speed * this.deltaTime);
            const roundedX = Math.round(enemy.x);
            const roundedY = Math.round(enemy.y);
            const isStuck = enemy.aiLastRoundedX === roundedX &&
                enemy.aiLastRoundedY === roundedY;
            if (isStuck) {
                enemy.aiState = 'thinking';
                enemy.aiThinkUntilTick = this.createTimerReadyTick(0.3);
                enemy.moving = false;
                return;
            }
            const vertical = enemy.rotation === 0 || enemy.rotation === 180;
            const horizontal = enemy.rotation === 90 || enemy.rotation === 270;
            const canThink = this.random.number(1, 100) <= 5 &&
                ((horizontal && enemy.x % MEDIUM_TILE === 0) ||
                    (vertical && enemy.y % MEDIUM_TILE === 0));
            if (canThink) {
                enemy.aiState = 'unstuck-thinking';
                enemy.aiThinkUntilTick = this.createTimerReadyTick(0.3);
                enemy.moving = false;
                return;
            }
            enemy.aiLastRoundedX = roundedX;
            enemy.aiLastRoundedY = roundedY;
        });
    }
    scheduleEnemyFire(enemy) {
        const milliseconds = this.random.number(0, 1500);
        enemy.aiFireAtTick =
            this.currentTick +
                Math.floor(milliseconds / 1000 * this.tickRate) +
                2;
    }
    createTimerReadyTick(durationSeconds) {
        return (this.currentTick +
            Math.floor(durationSeconds * this.tickRate) +
            2);
    }
    getNextEnemyRotation(enemy) {
        if (this.random.probability(30)) {
            return this.getRotationTowardsBase(enemy);
        }
        if (this.random.probability(10))
            return 0;
        const rotations = [180, 270, 90];
        return rotations[this.random.integer(rotations.length)];
    }
    getRotationTowardsBase(enemy) {
        const base = this.getBasePosition();
        const deltaX = base.x - enemy.x;
        const deltaY = base.y - enemy.y;
        const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (magnitude === 0)
            return 180;
        const x = deltaX / magnitude;
        const y = deltaY / magnitude;
        const maxValue = Math.max(x, y);
        if (Math.abs(x) === Math.abs(maxValue)) {
            if (x > 0)
                return 90;
            if (x < 0)
                return 270;
        }
        return 180;
    }
    fire(tank, ownerParty) {
        const attributes = getTankFireAttributes(ownerParty, tank.tier);
        const activeBulletCount = this.bullets.filter((bullet) => bullet.ownerParty === ownerParty && bullet.ownerIndex === tank.partyIndex).length;
        if (activeBulletCount >= attributes.maxCount ||
            this.currentTick < tank.nextFireTick) {
            return false;
        }
        const rect = createBulletRect(tank);
        this.bullets.push({
            id: this.nextBulletId++,
            ownerParty,
            ownerIndex: tank.partyIndex,
            rotation: tank.rotation,
            speed: attributes.speed,
            wallDamage: attributes.wallDamage,
            ...rect,
        });
        tank.fireSeq += 1;
        tank.fireX = tank.x;
        tank.fireY = tank.y;
        tank.fireRotation = tank.rotation;
        tank.nextFireTick =
            this.currentTick + Math.max(1, Math.ceil(attributes.rapidDelay * this.tickRate));
        return true;
    }
    updateBullets() {
        const previousById = new Map();
        for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
            const bullet = this.bullets[index];
            const previous = { ...bullet };
            previousById.set(bullet.id, previous);
            const vector = directionVector(bullet.rotation);
            bullet.x += vector.x * bullet.speed * this.deltaTime;
            bullet.y += vector.y * bullet.speed * this.deltaTime;
            const impact = this.findBulletImpact(previous, bullet);
            if (impact !== null) {
                bullet.x = previous.x + (bullet.x - previous.x) * impact.time;
                bullet.y = previous.y + (bullet.y - previous.y) * impact.time;
                this.applyBulletImpact(bullet, impact);
                this.bullets.splice(index, 1);
            }
        }
        this.resolveBulletCollisions(previousById);
    }
    findBulletImpact(previous, current) {
        let closest = this.getBorderImpact(previous, current);
        const consider = (impact) => {
            if (closest === null || impact.time < closest.time) {
                closest = impact;
            }
        };
        for (const cell of Array.from(this.terrain.values())) {
            const time = sweptCollisionTime(previous, current, cell);
            if (time !== null)
                consider({ time, kind: 'terrain', cell });
        }
        if (this.baseAlive) {
            const time = sweptCollisionTime(previous, current, this.getBaseHeartRect());
            if (time !== null)
                consider({ time, kind: 'base' });
        }
        const targets = previous.ownerParty === 'player'
            ? [
                ...Array.from(this.enemies.values()),
                ...this.players.filter((player) => player.partyIndex !== previous.ownerIndex),
            ]
            : this.players;
        for (const tank of targets) {
            if (!tank.alive)
                continue;
            const time = sweptCollisionTime(previous, current, tank);
            if (time !== null)
                consider({ time, kind: 'tank', tank });
        }
        return closest;
    }
    applyBulletImpact(bullet, impact) {
        if (impact.kind === 'terrain') {
            this.destroyTerrainAtImpact(bullet, impact.cell);
            return;
        }
        if (impact.kind === 'base') {
            this.baseAlive = false;
            return;
        }
        if (impact.kind !== 'tank') {
            return;
        }
        const tank = impact.tank;
        if (bullet.ownerParty === 'player' && tank.partyIndex === bullet.ownerIndex) {
            return;
        }
        if (bullet.ownerParty === 'player' &&
            this.enemies.get(tank.partyIndex) === tank) {
            tank.health -= 1;
            if (tank.health <= 0) {
                this.enemies.delete(tank.partyIndex);
                const player = bullet.ownerIndex;
                this.scores[player] += scoreForTier(tank.tier);
                if (tank.hasDrop)
                    this.spawnPowerup();
                this.nextEnemySpawnTick = Math.min(this.nextEnemySpawnTick, this.currentTick + 3 * this.tickRate);
            }
            return;
        }
        if (bullet.ownerParty === 'player') {
            if (this.currentTick >= tank.stunnedUntilTick) {
                tank.stunnedUntilTick =
                    this.currentTick + Math.ceil(5 * this.tickRate);
            }
            return;
        }
        if (this.currentTick >= tank.shieldUntilTick)
            this.killPlayer(tank);
    }
    destroyTerrainAtImpact(bullet, struck) {
        if (!struck.destructible && bullet.wallDamage < 2) {
            return;
        }
        const vertical = bullet.rotation === 0 || bullet.rotation === 180;
        const struckAxis = vertical ? struck.y : struck.x;
        const bulletCenter = vertical
            ? bullet.x + bullet.width / 2
            : bullet.y + bullet.height / 2;
        const maxCells = struck.type === 'brick' ? bullet.wallDamage * 4 : 2;
        const candidates = Array.from(this.terrain.values())
            .filter((cell) => cell.type === struck.type &&
            (vertical ? cell.y : cell.x) === struckAxis &&
            Math.abs((vertical ? cell.x + cell.width / 2 : cell.y + cell.height / 2) -
                bulletCenter) < LARGE_TILE / 2)
            .sort((left, right) => Math.abs((vertical ? left.x + left.width / 2 : left.y + left.height / 2) -
            bulletCenter) -
            Math.abs((vertical ? right.x + right.width / 2 : right.y + right.height / 2) -
                bulletCenter));
        const selected = [struck];
        for (const candidate of candidates) {
            if (selected.includes(candidate) || selected.length >= maxCells)
                continue;
            const touchesSelected = selected.some((cell) => vertical
                ? Math.abs(cell.x - candidate.x) === cell.width
                : Math.abs(cell.y - candidate.y) === cell.height);
            if (touchesSelected)
                selected.push(candidate);
        }
        selected.slice(0, maxCells).forEach((cell) => this.destroyTerrainCell(cell));
    }
    destroyTerrainCell(cell) {
        this.terrain.delete(cell.key);
        if (cell.type !== 'brick' ||
            !Array.from(this.terrain.values()).some((candidate) => candidate.type === 'brick' && candidate.movementKey === cell.movementKey)) {
            this.movementTerrain.delete(cell.movementKey);
        }
    }
    resolveBulletCollisions(previousById) {
        const removed = new Set();
        for (let leftIndex = 0; leftIndex < this.bullets.length; leftIndex += 1) {
            const left = this.bullets[leftIndex];
            if (removed.has(left.id))
                continue;
            for (let rightIndex = leftIndex + 1; rightIndex < this.bullets.length; rightIndex += 1) {
                const right = this.bullets[rightIndex];
                const sameOwner = left.ownerParty === right.ownerParty &&
                    left.ownerIndex === right.ownerIndex;
                const alliedEnemyBullets = left.ownerParty === 'enemy' && right.ownerParty === 'enemy';
                if (removed.has(right.id) ||
                    sameOwner ||
                    alliedEnemyBullets) {
                    continue;
                }
                const leftPrevious = previousById.get(left.id) ?? left;
                const rightPrevious = previousById.get(right.id) ?? right;
                const relativeCurrent = {
                    ...left,
                    x: leftPrevious.x +
                        (left.x - leftPrevious.x) -
                        (right.x - rightPrevious.x),
                    y: leftPrevious.y +
                        (left.y - leftPrevious.y) -
                        (right.y - rightPrevious.y),
                };
                if (!overlaps(left, right) &&
                    sweptCollisionTime(leftPrevious, relativeCurrent, rightPrevious) === null) {
                    continue;
                }
                removed.add(left.id);
                removed.add(right.id);
                break;
            }
        }
        if (removed.size > 0) {
            for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
                if (removed.has(this.bullets[index].id))
                    this.bullets.splice(index, 1);
            }
        }
    }
    killPlayer(player) {
        player.alive = false;
        player.moving = false;
        player.lives -= 1;
        player.respawnAtTick = player.lives > 0 ? this.currentTick + 2 * this.tickRate : 0;
    }
    respawnPlayers() {
        this.players.forEach((player) => {
            if (player.alive || player.respawnAtTick === 0 || this.currentTick < player.respawnAtTick)
                return;
            const spawn = this.playerSpawns[player.partyIndex];
            player.x = spawn.x;
            player.y = spawn.y;
            player.previousX = spawn.x;
            player.previousY = spawn.y;
            player.rotation = 0;
            player.health = 1;
            player.alive = true;
            player.respawnAtTick = 0;
            player.shieldUntilTick = this.currentTick + Math.ceil(3.5 * this.tickRate);
        });
    }
    updatePowerup() {
        if (this.baseDefenceUntilTick > 0 &&
            this.currentTick >= this.baseDefenceUntilTick) {
            this.replaceBaseWalls('brick');
            this.baseDefenceUntilTick = 0;
        }
        if (this.powerup === null)
            return;
        const rect = { x: this.powerup.x, y: this.powerup.y, width: TANK_SIZE, height: TANK_SIZE };
        const pickedBy = this.players.find((player) => player.alive && overlaps(player, rect));
        if (pickedBy === undefined)
            return;
        const type = this.powerup.kind;
        this.applyPowerup(pickedBy, type);
        this.powerupPickup = {
            seq: ++this.pickupSeq,
            type,
            partyIndex: pickedBy.partyIndex,
            x: this.powerup.x,
            y: this.powerup.y,
        };
        this.scores[pickedBy.partyIndex] += 500;
        this.powerup = null;
    }
    spawnPowerup() {
        const kinds = [
            'defence', 'freeze', 'life', 'shield', 'speed', 'upgrade', 'zoomout', 'wipeout',
        ];
        this.powerup = {
            id: this.nextPowerupId++,
            kind: kinds[this.random.integer(kinds.length)],
            x: Math.floor(this.random.next() * Math.max(1, this.fieldWidth - TANK_SIZE) / TILE) * TILE,
            y: Math.floor(this.random.next() * Math.max(1, this.fieldHeight - TANK_SIZE) / TILE) * TILE,
        };
    }
    applyPowerup(player, type) {
        if (type === 'defence') {
            this.replaceBaseWalls('steel');
            this.baseDefenceUntilTick =
                this.currentTick + BASE_DEFENCE_DURATION * this.tickRate;
        }
        else if (type === 'life')
            player.lives += 1;
        else if (type === 'shield')
            player.shieldUntilTick = this.currentTick + 10 * this.tickRate;
        else if (type === 'speed')
            player.speed = 240;
        else if (type === 'upgrade')
            player.tier = nextTier(player.tier);
        else if (type === 'freeze')
            this.enemiesFrozenUntilTick = this.currentTick + 10 * this.tickRate;
        else if (type === 'wipeout')
            this.enemies.clear();
    }
    tryMove(tank, rotation, distance) {
        this.resolveTankWallOverlaps(tank);
        const vector = directionVector(rotation);
        let allowedDistance = distance;
        let collidedWithWall = false;
        const walls = this.getMovementWalls();
        for (const wall of walls) {
            const collisionDistance = getForwardCollisionDistance(tank, wall, rotation, allowedDistance);
            if (collisionDistance !== null) {
                allowedDistance = collisionDistance;
                collidedWithWall = true;
            }
        }
        const tanks = [...this.players, ...Array.from(this.enemies.values())];
        for (const other of tanks) {
            if (other === tank || !other.alive)
                continue;
            const collisionDistance = getForwardCollisionDistance(tank, other, rotation, allowedDistance);
            if (collisionDistance !== null) {
                allowedDistance = collisionDistance;
                collidedWithWall = false;
            }
        }
        const nextX = clamp(tank.x + vector.x * allowedDistance, 0, this.fieldWidth - tank.width);
        const nextY = clamp(tank.y + vector.y * allowedDistance, 0, this.fieldHeight - tank.height);
        const moved = nextX !== tank.x || nextY !== tank.y;
        tank.x = nextX;
        tank.y = nextY;
        if (collidedWithWall) {
            if (vector.x !== 0)
                tank.x = snapToGrid(tank.x, MEDIUM_TILE);
            else
                tank.y = snapToGrid(tank.y, MEDIUM_TILE);
        }
        return moved;
    }
    getMovementWalls() {
        return [
            ...Array.from(this.movementTerrain.values()),
            this.getBaseHeartRect(),
        ];
    }
    resolveTankWallOverlaps(tank) {
        const walls = this.getMovementWalls();
        for (let pass = 0; pass < walls.length; pass += 1) {
            const wall = walls.find((candidate) => overlaps(tank, candidate));
            if (wall === undefined)
                return;
            const candidates = [
                { x: wall.x - tank.width, y: tank.y },
                { x: wall.x + wall.width, y: tank.y },
                { x: tank.x, y: wall.y - tank.height },
                { x: tank.x, y: wall.y + wall.height },
            ]
                .map((candidate) => ({
                x: clamp(candidate.x, 0, this.fieldWidth - tank.width),
                y: clamp(candidate.y, 0, this.fieldHeight - tank.height),
            }))
                .sort((left, right) => Math.abs(left.x - tank.x) + Math.abs(left.y - tank.y) -
                (Math.abs(right.x - tank.x) + Math.abs(right.y - tank.y)));
            const resolved = candidates.find((candidate) => {
                const rect = { ...tank, ...candidate };
                return !walls.some((candidateWall) => overlaps(rect, candidateWall));
            });
            if (resolved === undefined)
                return;
            tank.x = resolved.x;
            tank.y = resolved.y;
        }
    }
    rotateTank(tank, rotation) {
        if (tank.rotation === rotation)
            return;
        if (rotation === 0 || rotation === 180) {
            const targetX = snapToGrid(tank.x, MEDIUM_TILE);
            if (targetX !== tank.x) {
                this.tryMove(tank, targetX > tank.x ? 90 : 270, Math.abs(targetX - tank.x));
            }
        }
        else {
            const targetY = snapToGrid(tank.y, MEDIUM_TILE);
            if (targetY !== tank.y) {
                this.tryMove(tank, targetY > tank.y ? 180 : 0, Math.abs(targetY - tank.y));
            }
        }
        tank.x = clamp(tank.x, 0, this.fieldWidth - tank.width);
        tank.y = clamp(tank.y, 0, this.fieldHeight - tank.height);
        tank.rotation = rotation;
    }
    createFrame() {
        const players = this.players.map((tank) => ({
            partyIndex: tank.partyIndex,
            x: tank.x,
            y: tank.y,
            rotation: tank.rotation,
            moving: tank.moving,
            deltaX: tank.x - tank.previousX,
            deltaY: tank.y - tank.previousY,
            alive: tank.alive,
            fireSeq: tank.fireSeq,
            fireX: tank.fireX,
            fireY: tank.fireY,
            fireRotation: tank.fireRotation,
        }));
        const enemies = Array.from(this.enemies.values()).map((tank) => ({
            partyIndex: tank.partyIndex,
            x: tank.x,
            y: tank.y,
            rotation: tank.rotation,
            moving: tank.moving,
            deltaX: tank.x - tank.previousX,
            deltaY: tank.y - tank.previousY,
            alive: tank.alive,
            fireSeq: tank.fireSeq,
            fireX: tank.fireX,
            fireY: tank.fireY,
            fireRotation: tank.fireRotation,
        }));
        return {
            type: 'webrtc-host-frame',
            seq: ++this.frameSeq,
            tick: this.currentTick,
            lastProcessedInputSeq: [...this.lastProcessedInputSeq],
            deltaTime: this.deltaTime,
            stageNumber: this.stageNumber,
            playerScores: this.getScores(),
            playerLives: this.players.map((player) => player.lives),
            sharedElapsedSeconds: this.currentTick * this.deltaTime,
            playerOneElapsedSeconds: this.playerElapsed[0],
            playerTwoElapsedSeconds: this.playerElapsed[1],
            players,
            powerup: this.powerup,
            powerupPickup: this.powerupPickup,
            activeEnemyIds: enemies.map((enemy) => enemy.partyIndex),
            enemies,
        };
    }
    createTerrain() {
        for (const region of this.map.terrain?.regions ?? []) {
            const type = region.type.toLowerCase();
            const isBrick = [
                'brick',
                'menu-brick',
                'inverse-brick',
                'blue-brick',
            ].includes(type);
            if (!isBrick && type !== 'steel' && type !== 'water')
                continue;
            this.addTerrainRegion(isBrick ? 'brick' : type, region.x, region.y + this.contentOffsetY, region.width, region.height);
        }
    }
    replaceBaseWalls(type) {
        const base = this.getBasePosition();
        const regions = BASE_WALL_REGIONS.map((region) => ({
            x: base.x + region.x,
            y: base.y + region.y,
            width: region.width,
            height: region.height,
        }));
        for (const region of regions) {
            this.clearTerrainRegion(region);
            this.addTerrainRegion(type, region.x, region.y, region.width, region.height);
        }
        [...this.players, ...Array.from(this.enemies.values())]
            .filter((tank) => tank.alive)
            .forEach((tank) => this.resolveTankWallOverlaps(tank));
    }
    clearTerrainRegion(region) {
        for (const cell of Array.from(this.terrain.values())) {
            if (containsTopLeft(region, cell))
                this.terrain.delete(cell.key);
        }
        for (const cell of Array.from(this.movementTerrain.values())) {
            if (containsTopLeft(region, cell)) {
                this.movementTerrain.delete(cell.key);
            }
        }
    }
    addTerrainRegion(type, regionX, regionY, regionWidth, regionHeight) {
        const isBrick = type === 'brick';
        const collisionSize = isBrick ? TILE : MEDIUM_TILE;
        for (let y = 0; y < regionHeight; y += collisionSize) {
            for (let x = 0; x < regionWidth; x += collisionSize) {
                const cellX = regionX + x;
                const cellY = regionY + y;
                const movementX = Math.floor(cellX / MEDIUM_TILE) * MEDIUM_TILE;
                const movementY = Math.floor(cellY / MEDIUM_TILE) * MEDIUM_TILE;
                const movementKey = `${movementX}:${movementY}`;
                if (!this.movementTerrain.has(movementKey)) {
                    this.movementTerrain.set(movementKey, {
                        key: movementKey,
                        type,
                        x: movementX,
                        y: movementY,
                        width: MEDIUM_TILE,
                        height: MEDIUM_TILE,
                    });
                }
                if (type === 'water')
                    continue;
                const key = `${cellX}:${cellY}`;
                this.terrain.set(key, {
                    key,
                    type,
                    destructible: isBrick,
                    movementKey,
                    x: cellX,
                    y: cellY,
                    width: Math.min(collisionSize, regionWidth - x),
                    height: Math.min(collisionSize, regionHeight - y),
                });
            }
        }
    }
    createPlayerSpawns() {
        const base = this.getBasePosition();
        const defaults = [
            { x: Math.max(0, base.x - 96), y: this.fieldHeight - LARGE_TILE },
            { x: Math.min(this.fieldWidth - LARGE_TILE, base.x + 160), y: this.fieldHeight - LARGE_TILE },
        ];
        return defaults.map((fallback, index) => {
            const location = this.map.spawn?.player?.locations?.[index];
            return location === undefined ? fallback : { x: location.x, y: location.y + this.contentOffsetY };
        });
    }
    createEnemySpawns() {
        const right = this.fieldWidth - LARGE_TILE;
        const defaults = [
            { x: Math.floor((right / 2) / LARGE_TILE) * LARGE_TILE, y: 0 },
            { x: right, y: 0 },
            { x: 0, y: 0 },
        ];
        return defaults.map((fallback, index) => {
            const location = this.map.spawn?.enemy?.locations?.[index];
            return location === undefined ? fallback : { x: location.x, y: location.y + this.contentOffsetY };
        });
    }
    getBasePosition() {
        if (this.map.base !== undefined) {
            return { x: this.map.base.x, y: this.map.base.y + this.contentOffsetY };
        }
        return {
            x: Math.floor((this.fieldWidth - BASE_WIDTH) / 2),
            y: this.fieldHeight - BASE_HEIGHT,
        };
    }
    getBaseHeartRect() {
        const base = this.getBasePosition();
        return {
            x: base.x + BASE_HEART_OFFSET,
            y: base.y + BASE_HEART_OFFSET,
            width: LARGE_TILE,
            height: LARGE_TILE,
        };
    }
    getBorderImpact(previous, current) {
        const deltaX = current.x - previous.x;
        const deltaY = current.y - previous.y;
        let time = null;
        if (deltaX < 0 && current.x < 0) {
            time = (0 - previous.x) / deltaX;
        }
        else if (deltaX > 0 &&
            current.x + current.width > this.fieldWidth) {
            time =
                (this.fieldWidth - previous.x - previous.width) / deltaX;
        }
        else if (deltaY < 0 && current.y < 0) {
            time = (0 - previous.y) / deltaY;
        }
        else if (deltaY > 0 &&
            current.y + current.height > this.fieldHeight) {
            time =
                (this.fieldHeight - previous.y - previous.height) / deltaY;
        }
        return time === null
            ? null
            : { time: clamp(time, 0, 1), kind: 'border' };
    }
}
exports.BattleCitySimulation = BattleCitySimulation;
function overlaps(left, right) {
    return left.x < right.x + right.width && left.x + left.width > right.x &&
        left.y < right.y + right.height && left.y + left.height > right.y;
}
function containsTopLeft(container, rect) {
    return rect.x >= container.x &&
        rect.x < container.x + container.width &&
        rect.y >= container.y &&
        rect.y < container.y + container.height;
}
function directionVector(rotation) {
    if (rotation === 0)
        return { x: 0, y: -1 };
    if (rotation === 90)
        return { x: 1, y: 0 };
    if (rotation === 180)
        return { x: 0, y: 1 };
    return { x: -1, y: 0 };
}
function isRotation(value) {
    return value === null || value === 0 || value === 90 || value === 180 || value === 270;
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function snapToGrid(value, size) {
    return Math.round(value / size) * size;
}
function getForwardCollisionDistance(mover, obstacle, rotation, maxDistance) {
    if (overlaps(mover, obstacle))
        return null;
    const horizontalOverlap = mover.x < obstacle.x + obstacle.width &&
        mover.x + mover.width > obstacle.x;
    const verticalOverlap = mover.y < obstacle.y + obstacle.height &&
        mover.y + mover.height > obstacle.y;
    let distance = null;
    if (rotation === 0 && horizontalOverlap && obstacle.y + obstacle.height <= mover.y) {
        distance = mover.y - obstacle.y - obstacle.height;
    }
    else if (rotation === 90 &&
        verticalOverlap &&
        obstacle.x >= mover.x + mover.width) {
        distance = obstacle.x - mover.x - mover.width;
    }
    else if (rotation === 180 &&
        horizontalOverlap &&
        obstacle.y >= mover.y + mover.height) {
        distance = obstacle.y - mover.y - mover.height;
    }
    else if (rotation === 270 &&
        verticalOverlap &&
        obstacle.x + obstacle.width <= mover.x) {
        distance = mover.x - obstacle.x - obstacle.width;
    }
    return distance !== null && distance <= maxDistance ? distance : null;
}
function getTankFireAttributes(ownerParty, tier) {
    if (ownerParty === 'enemy') {
        return {
            speed: tier === 'c' ? 900 : BULLET_SPEED,
            maxCount: 1,
            rapidDelay: 0.16,
            wallDamage: 1,
        };
    }
    return {
        speed: tier === 'a' ? BULLET_SPEED : 900,
        maxCount: tier === 'c' || tier === 'd' ? 2 : 1,
        rapidDelay: tier === 'c' || tier === 'd' ? 0.04 : 0.16,
        wallDamage: tier === 'd' ? 2 : 1,
    };
}
function createBulletRect(tank) {
    if (tank.rotation === 0) {
        return {
            x: tank.x + (tank.width - BULLET_WIDTH) / 2,
            y: tank.y,
            width: BULLET_WIDTH,
            height: BULLET_HEIGHT,
        };
    }
    if (tank.rotation === 90) {
        return {
            x: tank.x + tank.width - BULLET_HEIGHT,
            y: tank.y + (tank.height - BULLET_WIDTH) / 2,
            width: BULLET_HEIGHT,
            height: BULLET_WIDTH,
        };
    }
    if (tank.rotation === 180) {
        return {
            x: tank.x + (tank.width - BULLET_WIDTH) / 2,
            y: tank.y + tank.height - BULLET_HEIGHT,
            width: BULLET_WIDTH,
            height: BULLET_HEIGHT,
        };
    }
    return {
        x: tank.x,
        y: tank.y + (tank.height - BULLET_WIDTH) / 2,
        width: BULLET_HEIGHT,
        height: BULLET_WIDTH,
    };
}
function sweptCollisionTime(previous, current, target) {
    if (overlaps(previous, target))
        return 0;
    const deltaX = current.x - previous.x;
    const deltaY = current.y - previous.y;
    if (deltaX > 0) {
        if (previous.y < target.y + target.height &&
            previous.y + previous.height > target.y) {
            const time = (target.x - previous.x - previous.width) / deltaX;
            return time >= 0 && time <= 1 ? time : null;
        }
    }
    else if (deltaX < 0) {
        if (previous.y < target.y + target.height &&
            previous.y + previous.height > target.y) {
            const time = (target.x + target.width - previous.x) / deltaX;
            return time >= 0 && time <= 1 ? time : null;
        }
    }
    else if (deltaY > 0) {
        if (previous.x < target.x + target.width &&
            previous.x + previous.width > target.x) {
            const time = (target.y - previous.y - previous.height) / deltaY;
            return time >= 0 && time <= 1 ? time : null;
        }
    }
    else if (deltaY < 0) {
        if (previous.x < target.x + target.width &&
            previous.x + previous.width > target.x) {
            const time = (target.y + target.height - previous.y) / deltaY;
            return time >= 0 && time <= 1 ? time : null;
        }
    }
    return null;
}
function normalizeTier(value) {
    const tier = String(value || 'a').toLowerCase();
    return ['a', 'b', 'c', 'd'].includes(tier) ? tier : 'a';
}
function nextTier(tier) {
    return tier === 'a' ? 'b' : tier === 'b' ? 'c' : 'd';
}
function scoreForTier(tier) {
    return tier === 'a' ? 100 : tier === 'b' ? 200 : tier === 'c' ? 300 : 400;
}
