import {
  SimulationEnemyFrame,
  SimulationHostFramePacket,
  SimulationInputPacket,
  SimulationMapDto,
  SimulationOptions,
  SimulationPlayerFrame,
  SimulationPlayerIndex,
  SimulationPowerupFrame,
  SimulationPowerupPickupFrame,
  SimulationPowerupType,
  SimulationRotation,
} from './simulationProtocol';

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
] as const;

interface RectState {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TankState extends RectState {
  partyIndex: number;
  tier: string;
  rotation: SimulationRotation;
  moving: boolean;
  alive: boolean;
  health: number;
  speed: number;
  fireSeq: number;
  fireX: number;
  fireY: number;
  fireRotation: SimulationRotation;
  nextFireTick: number;
  lastInputFireSeq: number;
  shieldUntilTick: number;
  stunnedUntilTick: number;
  respawnAtTick: number;
  lives: number;
  previousX: number;
  previousY: number;
  aiState: 'moving' | 'thinking' | 'unstuck-thinking' | 'firing';
  aiThinkUntilTick: number;
  aiFireAtTick: number;
  aiLastRoundedX: number;
  aiLastRoundedY: number;
  hasDrop: boolean;
}

interface BulletState extends RectState {
  id: number;
  ownerParty: 'player' | 'enemy';
  ownerIndex: number;
  rotation: SimulationRotation;
  speed: number;
  wallDamage: 1 | 2;
}

interface TerrainCell extends RectState {
  key: string;
  type: 'brick' | 'steel';
  destructible: boolean;
  movementKey: string;
}

interface MovementCell extends RectState {
  key: string;
  type: 'brick' | 'steel' | 'water' | 'base';
}

interface LatestInput {
  packet: SimulationInputPacket;
  receivedTick: number;
}

type BulletImpact =
  | { time: number; kind: 'terrain'; cell: TerrainCell }
  | { time: number; kind: 'base' }
  | { time: number; kind: 'tank'; tank: TankState }
  | { time: number; kind: 'border' };

class DeterministicRandom {
  private state: number;

  public constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  public next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  }

  public integer(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  public number(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min));
  }

  public probability(chancePercent: number): boolean {
    return this.number(1, 100) <= chancePercent;
  }
}

/** DOM-free authoritative match simulation shared by Node and browser tooling. */
export class BattleCitySimulation {
  public readonly tickRate: number;
  public readonly deltaTime: number;

  private readonly map: SimulationMapDto;
  private readonly random: DeterministicRandom;
  private readonly disableEnemyShooting: boolean;
  private readonly stageNumber: number;
  private readonly fieldWidth: number;
  private readonly fieldHeight: number;
  private readonly contentOffsetY: number;
  private readonly playerSpawns: Array<{ x: number; y: number }>;
  private readonly enemySpawns: Array<{ x: number; y: number }>;
  private readonly enemyList: Array<{ tier: string; drop: boolean }>;
  private readonly terrain = new Map<string, TerrainCell>();
  private readonly movementTerrain = new Map<string, MovementCell>();
  private readonly players: [TankState, TankState];
  private readonly enemies = new Map<number, TankState>();
  private readonly bullets: BulletState[] = [];
  private readonly inputs = new Map<SimulationPlayerIndex, LatestInput>();
  private readonly pendingFireSeqs = new Map<SimulationPlayerIndex, number>();
  private readonly playerElapsed: [number, number] = [0, 0];
  private readonly lastProcessedInputSeq: [number, number] = [0, 0];
  private readonly scores: [number, number] = [0, 0];
  private nextEnemyIndex = 0;
  private nextEnemySpawnTick: number;
  private nextBulletId = 1;
  private nextPowerupId = 1;
  private pickupSeq = 0;
  private frameSeq = 0;
  private currentTick = 0;
  private baseAlive = true;
  private baseDefenceUntilTick = 0;
  private enemiesFrozenUntilTick = 0;
  private powerup: SimulationPowerupFrame | null = null;
  private powerupPickup: SimulationPowerupPickupFrame | null = null;

  public constructor(map: SimulationMapDto, options: SimulationOptions) {
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

  public get tick(): number {
    return this.currentTick;
  }

  public get seq(): number {
    return this.frameSeq;
  }

  public acceptInput(packet: SimulationInputPacket): boolean {
    if (
      (packet.player !== 0 && packet.player !== 1) ||
      !Number.isInteger(packet.seq) ||
      packet.seq <= (this.inputs.get(packet.player)?.packet.seq ?? 0) ||
      !isRotation(packet.direction)
    ) {
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

  public step(): SimulationHostFramePacket {
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

  public getScores(): [number, number] {
    return [this.scores[0], this.scores[1]];
  }

  public isComplete(): boolean {
    const allPlayersDefeated = this.players.every((player) => !player.alive && player.lives <= 0);
    return !this.baseAlive || allPlayersDefeated ||
      (this.nextEnemyIndex >= this.enemyList.length && this.enemies.size === 0);
  }

  private createPlayer(index: SimulationPlayerIndex): TankState {
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

  private updatePlayers(): void {
    this.players.forEach((player, index) => {
      player.previousX = player.x;
      player.previousY = player.y;
      player.moving = false;
      if (!player.alive || this.currentTick < player.stunnedUntilTick) {
        return;
      }
      const input = this.inputs.get(index as SimulationPlayerIndex);
      if (input === undefined || this.currentTick - input.receivedTick > 0.5 * this.tickRate) {
        return;
      }
      const packet = input.packet;
      this.lastProcessedInputSeq[index as SimulationPlayerIndex] = packet.seq;
      const pendingFireSeq = this.pendingFireSeqs.get(
        index as SimulationPlayerIndex,
      );
      if (
        pendingFireSeq !== undefined &&
        pendingFireSeq > player.lastInputFireSeq
      ) {
        player.lastInputFireSeq = pendingFireSeq;
        this.pendingFireSeqs.delete(index as SimulationPlayerIndex);
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

  private spawnEnemy(): void {
    if (
      this.nextEnemyIndex >= this.enemyList.length ||
      this.enemies.size >= ENEMY_LIMIT ||
      this.currentTick < this.nextEnemySpawnTick
    ) {
      return;
    }
    const definition = this.enemyList[this.nextEnemyIndex];
    const spawn = this.enemySpawns[this.nextEnemyIndex % this.enemySpawns.length];
    const tier = definition.tier;
    const enemy: TankState = {
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

  private updateEnemies(): void {
    this.enemies.forEach((enemy) => {
      enemy.previousX = enemy.x;
      enemy.previousY = enemy.y;
      if (this.currentTick < this.enemiesFrozenUntilTick) {
        enemy.moving = false;
        enemy.aiFireAtTick += 1;
        if (enemy.aiThinkUntilTick > 0) enemy.aiThinkUntilTick += 1;
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
      if (
        enemy.aiState === 'thinking' ||
        enemy.aiState === 'unstuck-thinking'
      ) {
        enemy.moving = false;
        if (this.currentTick < enemy.aiThinkUntilTick) return;
        if (
          !this.disableEnemyShooting &&
          enemy.aiState === 'thinking' &&
          this.random.probability(30)
        ) {
          enemy.aiState = 'firing';
          return;
        }
        enemy.aiState = 'moving';
        this.rotateTank(enemy, this.getNextEnemyRotation(enemy));
        return;
      }

      enemy.moving = this.tryMove(
        enemy,
        enemy.rotation,
        enemy.speed * this.deltaTime,
      );
      const roundedX = Math.round(enemy.x);
      const roundedY = Math.round(enemy.y);
      const isStuck =
        enemy.aiLastRoundedX === roundedX &&
        enemy.aiLastRoundedY === roundedY;
      if (isStuck) {
        enemy.aiState = 'thinking';
        enemy.aiThinkUntilTick = this.createTimerReadyTick(0.3);
        enemy.moving = false;
        return;
      }
      const vertical = enemy.rotation === 0 || enemy.rotation === 180;
      const horizontal = enemy.rotation === 90 || enemy.rotation === 270;
      const canThink =
        this.random.number(1, 100) <= 5 &&
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

  private scheduleEnemyFire(enemy: TankState): void {
    const milliseconds = this.random.number(0, 1500);
    enemy.aiFireAtTick =
      this.currentTick +
      Math.floor(milliseconds / 1000 * this.tickRate) +
      2;
  }

  private createTimerReadyTick(durationSeconds: number): number {
    return (
      this.currentTick +
      Math.floor(durationSeconds * this.tickRate) +
      2
    );
  }

  private getNextEnemyRotation(enemy: TankState): SimulationRotation {
    if (this.random.probability(30)) {
      return this.getRotationTowardsBase(enemy);
    }
    if (this.random.probability(10)) return 0;
    const rotations: SimulationRotation[] = [180, 270, 90];
    return rotations[this.random.integer(rotations.length)];
  }

  private getRotationTowardsBase(enemy: TankState): SimulationRotation {
    const base = this.getBasePosition();
    const deltaX = base.x - enemy.x;
    const deltaY = base.y - enemy.y;
    const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (magnitude === 0) return 180;
    const x = deltaX / magnitude;
    const y = deltaY / magnitude;
    const maxValue = Math.max(x, y);
    if (Math.abs(x) === Math.abs(maxValue)) {
      if (x > 0) return 90;
      if (x < 0) return 270;
    }
    return 180;
  }

  private fire(
    tank: TankState,
    ownerParty: 'player' | 'enemy',
  ): boolean {
    const attributes = getTankFireAttributes(ownerParty, tank.tier);
    const activeBulletCount = this.bullets.filter((bullet) =>
      bullet.ownerParty === ownerParty && bullet.ownerIndex === tank.partyIndex,
    ).length;
    if (
      activeBulletCount >= attributes.maxCount ||
      this.currentTick < tank.nextFireTick
    ) {
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

  private updateBullets(): void {
    const previousById = new Map<number, BulletState>();
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

  private findBulletImpact(
    previous: BulletState,
    current: BulletState,
  ): BulletImpact | null {
    let closest: BulletImpact | null = this.getBorderImpact(previous, current);
    const consider = (impact: BulletImpact): void => {
      if (closest === null || impact.time < closest.time) {
        closest = impact;
      }
    };

    for (const cell of Array.from(this.terrain.values())) {
      const time = sweptCollisionTime(previous, current, cell);
      if (time !== null) consider({ time, kind: 'terrain', cell });
    }

    if (this.baseAlive) {
      const time = sweptCollisionTime(previous, current, this.getBaseHeartRect());
      if (time !== null) consider({ time, kind: 'base' });
    }

    const targets =
      previous.ownerParty === 'player'
        ? [
          ...Array.from(this.enemies.values()),
          ...this.players.filter((player) =>
            player.partyIndex !== previous.ownerIndex,
          ),
        ]
        : this.players;
    for (const tank of targets) {
      if (!tank.alive) continue;
      const time = sweptCollisionTime(previous, current, tank);
      if (time !== null) consider({ time, kind: 'tank', tank });
    }

    return closest;
  }

  private applyBulletImpact(bullet: BulletState, impact: BulletImpact): void {
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
    if (
      bullet.ownerParty === 'player' &&
      this.enemies.get(tank.partyIndex) === tank
    ) {
      tank.health -= 1;
      if (tank.health <= 0) {
        this.enemies.delete(tank.partyIndex);
        const player = bullet.ownerIndex as SimulationPlayerIndex;
        this.scores[player] += scoreForTier(tank.tier);
        if (tank.hasDrop) this.spawnPowerup();
        this.nextEnemySpawnTick = Math.min(
          this.nextEnemySpawnTick,
          this.currentTick + 3 * this.tickRate,
        );
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
    if (this.currentTick >= tank.shieldUntilTick) this.killPlayer(tank);
  }

  private destroyTerrainAtImpact(
    bullet: BulletState,
    struck: TerrainCell,
  ): void {
    if (!struck.destructible && bullet.wallDamage < 2) {
      return;
    }
    const vertical =
      bullet.rotation === 0 || bullet.rotation === 180;
    const struckAxis = vertical ? struck.y : struck.x;
    const bulletCenter = vertical
      ? bullet.x + bullet.width / 2
      : bullet.y + bullet.height / 2;
    const maxCells = struck.type === 'brick' ? bullet.wallDamage * 4 : 2;
    const candidates = Array.from(this.terrain.values())
      .filter((cell) =>
        cell.type === struck.type &&
        (vertical ? cell.y : cell.x) === struckAxis &&
        Math.abs(
          (vertical ? cell.x + cell.width / 2 : cell.y + cell.height / 2) -
          bulletCenter,
        ) < LARGE_TILE / 2,
      )
      .sort((left, right) =>
        Math.abs(
          (vertical ? left.x + left.width / 2 : left.y + left.height / 2) -
          bulletCenter,
        ) -
        Math.abs(
          (vertical ? right.x + right.width / 2 : right.y + right.height / 2) -
          bulletCenter,
        ),
      );

    const selected: TerrainCell[] = [struck];
    for (const candidate of candidates) {
      if (selected.includes(candidate) || selected.length >= maxCells) continue;
      const touchesSelected = selected.some((cell) =>
        vertical
          ? Math.abs(cell.x - candidate.x) === cell.width
          : Math.abs(cell.y - candidate.y) === cell.height,
      );
      if (touchesSelected) selected.push(candidate);
    }
    selected.slice(0, maxCells).forEach((cell) => this.destroyTerrainCell(cell));
  }

  private destroyTerrainCell(cell: TerrainCell): void {
    this.terrain.delete(cell.key);
    if (
      cell.type !== 'brick' ||
      !Array.from(this.terrain.values()).some((candidate) =>
        candidate.type === 'brick' && candidate.movementKey === cell.movementKey,
      )
    ) {
      this.movementTerrain.delete(cell.movementKey);
    }
  }

  private resolveBulletCollisions(
    previousById: Map<number, BulletState>,
  ): void {
    const removed = new Set<number>();
    for (let leftIndex = 0; leftIndex < this.bullets.length; leftIndex += 1) {
      const left = this.bullets[leftIndex];
      if (removed.has(left.id)) continue;
      for (let rightIndex = leftIndex + 1; rightIndex < this.bullets.length; rightIndex += 1) {
        const right = this.bullets[rightIndex];
        const sameOwner =
          left.ownerParty === right.ownerParty &&
          left.ownerIndex === right.ownerIndex;
        const alliedEnemyBullets =
          left.ownerParty === 'enemy' && right.ownerParty === 'enemy';
        if (
          removed.has(right.id) ||
          sameOwner ||
          alliedEnemyBullets
        ) {
          continue;
        }
        const leftPrevious = previousById.get(left.id) ?? left;
        const rightPrevious = previousById.get(right.id) ?? right;
        const relativeCurrent = {
          ...left,
          x:
            leftPrevious.x +
            (left.x - leftPrevious.x) -
            (right.x - rightPrevious.x),
          y:
            leftPrevious.y +
            (left.y - leftPrevious.y) -
            (right.y - rightPrevious.y),
        };
        if (
          !overlaps(left, right) &&
          sweptCollisionTime(
            leftPrevious,
            relativeCurrent,
            rightPrevious,
          ) === null
        ) {
          continue;
        }
        removed.add(left.id);
        removed.add(right.id);
        break;
      }
    }
    if (removed.size > 0) {
      for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
        if (removed.has(this.bullets[index].id)) this.bullets.splice(index, 1);
      }
    }
  }

  private killPlayer(player: TankState): void {
    player.alive = false;
    player.moving = false;
    player.lives -= 1;
    player.respawnAtTick = player.lives > 0 ? this.currentTick + 2 * this.tickRate : 0;
  }

  private respawnPlayers(): void {
    this.players.forEach((player) => {
      if (player.alive || player.respawnAtTick === 0 || this.currentTick < player.respawnAtTick) return;
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

  private updatePowerup(): void {
    if (
      this.baseDefenceUntilTick > 0 &&
      this.currentTick >= this.baseDefenceUntilTick
    ) {
      this.replaceBaseWalls('brick');
      this.baseDefenceUntilTick = 0;
    }
    if (this.powerup === null) return;
    const rect = { x: this.powerup.x, y: this.powerup.y, width: TANK_SIZE, height: TANK_SIZE };
    const pickedBy = this.players.find((player) => player.alive && overlaps(player, rect));
    if (pickedBy === undefined) return;
    const type = this.powerup.kind;
    this.applyPowerup(pickedBy, type);
    this.powerupPickup = {
      seq: ++this.pickupSeq,
      type,
      partyIndex: pickedBy.partyIndex as SimulationPlayerIndex,
      x: this.powerup.x,
      y: this.powerup.y,
    };
    this.scores[pickedBy.partyIndex as SimulationPlayerIndex] += 500;
    this.powerup = null;
  }

  private spawnPowerup(): void {
    const kinds: SimulationPowerupType[] = [
      'defence', 'freeze', 'life', 'shield', 'speed', 'upgrade', 'zoomout', 'wipeout',
    ];
    this.powerup = {
      id: this.nextPowerupId++,
      kind: kinds[this.random.integer(kinds.length)],
      x: Math.floor(this.random.next() * Math.max(1, this.fieldWidth - TANK_SIZE) / TILE) * TILE,
      y: Math.floor(this.random.next() * Math.max(1, this.fieldHeight - TANK_SIZE) / TILE) * TILE,
    };
  }

  private applyPowerup(player: TankState, type: SimulationPowerupType): void {
    if (type === 'defence') {
      this.replaceBaseWalls('steel');
      this.baseDefenceUntilTick =
        this.currentTick + BASE_DEFENCE_DURATION * this.tickRate;
    } else if (type === 'life') player.lives += 1;
    else if (type === 'shield') player.shieldUntilTick = this.currentTick + 10 * this.tickRate;
    else if (type === 'speed') player.speed = 240;
    else if (type === 'upgrade') player.tier = nextTier(player.tier);
    else if (type === 'freeze') this.enemiesFrozenUntilTick = this.currentTick + 10 * this.tickRate;
    else if (type === 'wipeout') this.enemies.clear();
  }

  private tryMove(tank: TankState, rotation: SimulationRotation, distance: number): boolean {
    this.resolveTankWallOverlaps(tank);
    const vector = directionVector(rotation);
    let allowedDistance = distance;
    let collidedWithWall = false;
    const walls = this.getMovementWalls();
    for (const wall of walls) {
      const collisionDistance = getForwardCollisionDistance(
        tank,
        wall,
        rotation,
        allowedDistance,
      );
      if (collisionDistance !== null) {
        allowedDistance = collisionDistance;
        collidedWithWall = true;
      }
    }
    const tanks = [...this.players, ...Array.from(this.enemies.values())];
    for (const other of tanks) {
      if (other === tank || !other.alive) continue;
      const collisionDistance = getForwardCollisionDistance(
        tank,
        other,
        rotation,
        allowedDistance,
      );
      if (collisionDistance !== null) {
        allowedDistance = collisionDistance;
        collidedWithWall = false;
      }
    }
    const nextX = clamp(
      tank.x + vector.x * allowedDistance,
      0,
      this.fieldWidth - tank.width,
    );
    const nextY = clamp(
      tank.y + vector.y * allowedDistance,
      0,
      this.fieldHeight - tank.height,
    );
    const moved = nextX !== tank.x || nextY !== tank.y;
    tank.x = nextX;
    tank.y = nextY;
    if (collidedWithWall) {
      if (vector.x !== 0) tank.x = snapToGrid(tank.x, MEDIUM_TILE);
      else tank.y = snapToGrid(tank.y, MEDIUM_TILE);
    }
    return moved;
  }

  private getMovementWalls(): RectState[] {
    return [
      ...Array.from(this.movementTerrain.values()),
      this.getBaseHeartRect(),
    ];
  }

  private resolveTankWallOverlaps(tank: TankState): void {
    const walls = this.getMovementWalls();
    for (let pass = 0; pass < walls.length; pass += 1) {
      const wall = walls.find((candidate) => overlaps(tank, candidate));
      if (wall === undefined) return;
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
        .sort((left, right) =>
          Math.abs(left.x - tank.x) + Math.abs(left.y - tank.y) -
          (Math.abs(right.x - tank.x) + Math.abs(right.y - tank.y)),
        );
      const resolved = candidates.find((candidate) => {
        const rect = { ...tank, ...candidate };
        return !walls.some((candidateWall) => overlaps(rect, candidateWall));
      });
      if (resolved === undefined) return;
      tank.x = resolved.x;
      tank.y = resolved.y;
    }
  }

  private rotateTank(tank: TankState, rotation: SimulationRotation): void {
    if (tank.rotation === rotation) return;
    if (rotation === 0 || rotation === 180) {
      const targetX = snapToGrid(tank.x, MEDIUM_TILE);
      if (targetX !== tank.x) {
        this.tryMove(
          tank,
          targetX > tank.x ? 90 : 270,
          Math.abs(targetX - tank.x),
        );
      }
    } else {
      const targetY = snapToGrid(tank.y, MEDIUM_TILE);
      if (targetY !== tank.y) {
        this.tryMove(
          tank,
          targetY > tank.y ? 180 : 0,
          Math.abs(targetY - tank.y),
        );
      }
    }
    tank.x = clamp(tank.x, 0, this.fieldWidth - tank.width);
    tank.y = clamp(tank.y, 0, this.fieldHeight - tank.height);
    tank.rotation = rotation;
  }

  private createFrame(): SimulationHostFramePacket {
    const players: SimulationPlayerFrame[] = this.players.map((tank) => ({
      partyIndex: tank.partyIndex as SimulationPlayerIndex,
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
    const enemies: SimulationEnemyFrame[] = Array.from(this.enemies.values()).map((tank) => ({
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
      lastProcessedInputSeq: [...this.lastProcessedInputSeq] as [number, number],
      deltaTime: this.deltaTime,
      stageNumber: this.stageNumber,
      playerScores: this.getScores(),
      playerLives: this.players.map((player) => player.lives) as [
        number,
        number,
      ],
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

  private createTerrain(): void {
    for (const region of this.map.terrain?.regions ?? []) {
      const type = region.type.toLowerCase();
      const isBrick = [
        'brick',
        'menu-brick',
        'inverse-brick',
        'blue-brick',
      ].includes(type);
      if (!isBrick && type !== 'steel' && type !== 'water') continue;
      this.addTerrainRegion(
        isBrick ? 'brick' : type as 'steel' | 'water',
        region.x,
        region.y + this.contentOffsetY,
        region.width,
        region.height,
      );
    }
  }

  private replaceBaseWalls(type: 'brick' | 'steel'): void {
    const base = this.getBasePosition();
    const regions = BASE_WALL_REGIONS.map((region) => ({
      x: base.x + region.x,
      y: base.y + region.y,
      width: region.width,
      height: region.height,
    }));
    for (const region of regions) {
      this.clearTerrainRegion(region);
      this.addTerrainRegion(
        type,
        region.x,
        region.y,
        region.width,
        region.height,
      );
    }
    [...this.players, ...Array.from(this.enemies.values())]
      .filter((tank) => tank.alive)
      .forEach((tank) => this.resolveTankWallOverlaps(tank));
  }

  private clearTerrainRegion(region: RectState): void {
    for (const cell of Array.from(this.terrain.values())) {
      if (containsTopLeft(region, cell)) this.terrain.delete(cell.key);
    }
    for (const cell of Array.from(this.movementTerrain.values())) {
      if (containsTopLeft(region, cell)) {
        this.movementTerrain.delete(cell.key);
      }
    }
  }

  private addTerrainRegion(
    type: 'brick' | 'steel' | 'water',
    regionX: number,
    regionY: number,
    regionWidth: number,
    regionHeight: number,
  ): void {
    const isBrick = type === 'brick';
    const collisionSize = isBrick ? TILE : MEDIUM_TILE;
    for (let y = 0; y < regionHeight; y += collisionSize) {
      for (let x = 0; x < regionWidth; x += collisionSize) {
        const cellX = regionX + x;
        const cellY = regionY + y;
        const movementX =
          Math.floor(cellX / MEDIUM_TILE) * MEDIUM_TILE;
        const movementY =
          Math.floor(cellY / MEDIUM_TILE) * MEDIUM_TILE;
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
        if (type === 'water') continue;
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

  private createPlayerSpawns(): Array<{ x: number; y: number }> {
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

  private createEnemySpawns(): Array<{ x: number; y: number }> {
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

  private getBasePosition(): { x: number; y: number } {
    if (this.map.base !== undefined) {
      return { x: this.map.base.x, y: this.map.base.y + this.contentOffsetY };
    }
    return {
      x: Math.floor((this.fieldWidth - BASE_WIDTH) / 2),
      y: this.fieldHeight - BASE_HEIGHT,
    };
  }

  private getBaseHeartRect(): RectState {
    const base = this.getBasePosition();
    return {
      x: base.x + BASE_HEART_OFFSET,
      y: base.y + BASE_HEART_OFFSET,
      width: LARGE_TILE,
      height: LARGE_TILE,
    };
  }

  private getBorderImpact(
    previous: BulletState,
    current: BulletState,
  ): BulletImpact | null {
    const deltaX = current.x - previous.x;
    const deltaY = current.y - previous.y;
    let time: number | null = null;
    if (deltaX < 0 && current.x < 0) {
      time = (0 - previous.x) / deltaX;
    } else if (
      deltaX > 0 &&
      current.x + current.width > this.fieldWidth
    ) {
      time =
        (this.fieldWidth - previous.x - previous.width) / deltaX;
    } else if (deltaY < 0 && current.y < 0) {
      time = (0 - previous.y) / deltaY;
    } else if (
      deltaY > 0 &&
      current.y + current.height > this.fieldHeight
    ) {
      time =
        (this.fieldHeight - previous.y - previous.height) / deltaY;
    }
    return time === null
      ? null
      : { time: clamp(time, 0, 1), kind: 'border' };
  }
}

function overlaps(left: RectState, right: RectState): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x &&
    left.y < right.y + right.height && left.y + left.height > right.y;
}

function containsTopLeft(container: RectState, rect: RectState): boolean {
  return rect.x >= container.x &&
    rect.x < container.x + container.width &&
    rect.y >= container.y &&
    rect.y < container.y + container.height;
}

function directionVector(rotation: SimulationRotation): { x: number; y: number } {
  if (rotation === 0) return { x: 0, y: -1 };
  if (rotation === 90) return { x: 1, y: 0 };
  if (rotation === 180) return { x: 0, y: 1 };
  return { x: -1, y: 0 };
}

function isRotation(value: SimulationRotation | null): boolean {
  return value === null || value === 0 || value === 90 || value === 180 || value === 270;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function snapToGrid(value: number, size: number): number {
  return Math.round(value / size) * size;
}

function getForwardCollisionDistance(
  mover: RectState,
  obstacle: RectState,
  rotation: SimulationRotation,
  maxDistance: number,
): number | null {
  if (overlaps(mover, obstacle)) return null;
  const horizontalOverlap =
    mover.x < obstacle.x + obstacle.width &&
    mover.x + mover.width > obstacle.x;
  const verticalOverlap =
    mover.y < obstacle.y + obstacle.height &&
    mover.y + mover.height > obstacle.y;
  let distance: number | null = null;
  if (rotation === 0 && horizontalOverlap && obstacle.y + obstacle.height <= mover.y) {
    distance = mover.y - obstacle.y - obstacle.height;
  } else if (
    rotation === 90 &&
    verticalOverlap &&
    obstacle.x >= mover.x + mover.width
  ) {
    distance = obstacle.x - mover.x - mover.width;
  } else if (
    rotation === 180 &&
    horizontalOverlap &&
    obstacle.y >= mover.y + mover.height
  ) {
    distance = obstacle.y - mover.y - mover.height;
  } else if (
    rotation === 270 &&
    verticalOverlap &&
    obstacle.x + obstacle.width <= mover.x
  ) {
    distance = mover.x - obstacle.x - obstacle.width;
  }
  return distance !== null && distance <= maxDistance ? distance : null;
}

function getTankFireAttributes(
  ownerParty: 'player' | 'enemy',
  tier: string,
): {
  speed: number;
  maxCount: number;
  rapidDelay: number;
  wallDamage: 1 | 2;
} {
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

function createBulletRect(tank: TankState): RectState {
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

function sweptCollisionTime(
  previous: RectState,
  current: RectState,
  target: RectState,
): number | null {
  if (overlaps(previous, target)) return 0;
  const deltaX = current.x - previous.x;
  const deltaY = current.y - previous.y;
  if (deltaX > 0) {
    if (
      previous.y < target.y + target.height &&
      previous.y + previous.height > target.y
    ) {
      const time =
        (target.x - previous.x - previous.width) / deltaX;
      return time >= 0 && time <= 1 ? time : null;
    }
  } else if (deltaX < 0) {
    if (
      previous.y < target.y + target.height &&
      previous.y + previous.height > target.y
    ) {
      const time = (target.x + target.width - previous.x) / deltaX;
      return time >= 0 && time <= 1 ? time : null;
    }
  } else if (deltaY > 0) {
    if (
      previous.x < target.x + target.width &&
      previous.x + previous.width > target.x
    ) {
      const time =
        (target.y - previous.y - previous.height) / deltaY;
      return time >= 0 && time <= 1 ? time : null;
    }
  } else if (deltaY < 0) {
    if (
      previous.x < target.x + target.width &&
      previous.x + previous.width > target.x
    ) {
      const time = (target.y + target.height - previous.y) / deltaY;
      return time >= 0 && time <= 1 ? time : null;
    }
  }
  return null;
}

function normalizeTier(value: string): string {
  const tier = String(value || 'a').toLowerCase();
  return ['a', 'b', 'c', 'd'].includes(tier) ? tier : 'a';
}

function nextTier(tier: string): string {
  return tier === 'a' ? 'b' : tier === 'b' ? 'c' : 'd';
}

function scoreForTier(tier: string): number {
  return tier === 'a' ? 100 : tier === 'b' ? 200 : tier === 'c' ? 300 : 400;
}
