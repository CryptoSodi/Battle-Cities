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
const LARGE_TILE = 64;
const LEGACY_FIELD_TILES = 13;
const DEFAULT_FIELD_TILES = 20;
const TANK_SIZE = 64;
const BULLET_SIZE = 12;
const PLAYER_SPEED = 180;
const BULLET_SPEED = 600;
const ENEMY_LIMIT = 6;

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
  lastInputFireSeq: number;
  shieldUntilTick: number;
  stunnedUntilTick: number;
  respawnAtTick: number;
  lives: number;
  previousX: number;
  previousY: number;
  aiTurnAtTick: number;
  aiFireAtTick: number;
  hasDrop: boolean;
}

interface BulletState extends RectState {
  id: number;
  ownerParty: 'player' | 'enemy';
  ownerIndex: number;
  rotation: SimulationRotation;
  speed: number;
}

interface TerrainCell extends RectState {
  key: string;
  destructible: boolean;
}

interface LatestInput {
  packet: SimulationInputPacket;
  receivedTick: number;
}

class DeterministicRandom {
  private state: number;

  public constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  public next(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x100000000;
  }

  public integer(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
}

/** DOM-free authoritative match simulation shared by Node and browser tooling. */
export class BattleCitySimulation {
  public readonly tickRate: number;
  public readonly deltaTime: number;

  private readonly map: SimulationMapDto;
  private readonly random: DeterministicRandom;
  private readonly disableEnemyShooting: boolean;
  private readonly fieldWidth: number;
  private readonly fieldHeight: number;
  private readonly contentOffsetY: number;
  private readonly playerSpawns: Array<{ x: number; y: number }>;
  private readonly enemySpawns: Array<{ x: number; y: number }>;
  private readonly enemyList: Array<{ tier: string; drop: boolean }>;
  private readonly terrain = new Map<string, TerrainCell>();
  private readonly players: [TankState, TankState];
  private readonly enemies = new Map<number, TankState>();
  private readonly bullets: BulletState[] = [];
  private readonly inputs = new Map<SimulationPlayerIndex, LatestInput>();
  private readonly playerElapsed: [number, number] = [0, 0];
  private readonly scores: [number, number] = [0, 0];
  private nextEnemyIndex = 0;
  private nextEnemySpawnTick: number;
  private nextBulletId = 1;
  private nextPowerupId = 1;
  private pickupSeq = 0;
  private frameSeq = 0;
  private currentTick = 0;
  private powerup: SimulationPowerupFrame | null = null;
  private powerupPickup: SimulationPowerupPickupFrame | null = null;

  public constructor(map: SimulationMapDto, options: SimulationOptions) {
    this.map = map;
    this.tickRate = Math.max(10, Math.floor(options.tickRate ?? 60));
    this.deltaTime = 1 / this.tickRate;
    this.random = new DeterministicRandom(options.seed);
    this.disableEnemyShooting = options.disableEnemyShooting === true;
    const legacy = map.field === undefined && (map.version ?? 0) < 2;
    const widthTiles = map.field?.widthTiles ?? (legacy ? LEGACY_FIELD_TILES : DEFAULT_FIELD_TILES);
    const heightTiles = map.field?.heightTiles ?? (legacy ? LEGACY_FIELD_TILES : DEFAULT_FIELD_TILES);
    this.fieldWidth = widthTiles * LARGE_TILE;
    this.fieldHeight = heightTiles * LARGE_TILE;
    this.contentOffsetY = legacy
      ? Math.max(0, DEFAULT_FIELD_TILES * LARGE_TILE - this.fieldHeight)
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
      lastInputFireSeq: 0,
      shieldUntilTick: Math.ceil(3.5 * this.tickRate),
      stunnedUntilTick: 0,
      respawnAtTick: 0,
      lives: 3,
      previousX: spawn.x,
      previousY: spawn.y,
      aiTurnAtTick: 0,
      aiFireAtTick: 0,
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
      if (packet.direction !== null) {
        player.rotation = packet.direction;
      }
      if (packet.moving && packet.direction !== null) {
        player.moving = this.tryMove(player, packet.direction, player.speed * this.deltaTime);
      }
      if (packet.fire && packet.seq > player.lastInputFireSeq) {
        player.lastInputFireSeq = packet.seq;
        this.fire(player, 'player');
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
      lastInputFireSeq: 0,
      shieldUntilTick: 0,
      stunnedUntilTick: 0,
      respawnAtTick: 0,
      lives: 0,
      previousX: spawn.x,
      previousY: spawn.y,
      aiTurnAtTick: this.currentTick + this.random.integer(this.tickRate),
      aiFireAtTick: this.currentTick + Math.ceil((0.4 + this.random.next()) * this.tickRate),
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
      if (this.currentTick >= enemy.aiTurnAtTick) {
        enemy.rotation = this.chooseEnemyRotation(enemy);
        enemy.aiTurnAtTick = this.currentTick + Math.ceil((0.35 + this.random.next() * 0.9) * this.tickRate);
      }
      enemy.moving = this.tryMove(enemy, enemy.rotation, enemy.speed * this.deltaTime);
      if (!enemy.moving) {
        enemy.rotation = this.chooseEnemyRotation(enemy, true);
        enemy.aiTurnAtTick = this.currentTick + Math.ceil(0.2 * this.tickRate);
      }
      if (!this.disableEnemyShooting && this.currentTick >= enemy.aiFireAtTick) {
        this.fire(enemy, 'enemy');
        enemy.aiFireAtTick = this.currentTick + Math.ceil((0.65 + this.random.next() * 1.5) * this.tickRate);
      }
    });
  }

  private chooseEnemyRotation(enemy: TankState, blocked = false): SimulationRotation {
    const base = this.getBasePosition();
    const towardBase: SimulationRotation =
      Math.abs(base.x - enemy.x) > Math.abs(base.y - enemy.y)
        ? base.x < enemy.x ? 270 : 90
        : 180;
    if (!blocked && this.random.next() < 0.55) {
      return towardBase;
    }
    const rotations: SimulationRotation[] = [0, 90, 180, 270];
    return rotations[this.random.integer(rotations.length)];
  }

  private fire(tank: TankState, ownerParty: 'player' | 'enemy'): void {
    if (this.bullets.some((bullet) =>
      bullet.ownerParty === ownerParty && bullet.ownerIndex === tank.partyIndex,
    )) {
      return;
    }
    const vector = directionVector(tank.rotation);
    this.bullets.push({
      id: this.nextBulletId++,
      ownerParty,
      ownerIndex: tank.partyIndex,
      rotation: tank.rotation,
      speed: tank.tier === 'b' || tank.tier === 'c' ? 900 : BULLET_SPEED,
      x: tank.x + tank.width / 2 - BULLET_SIZE / 2 + vector.x * tank.width / 2,
      y: tank.y + tank.height / 2 - BULLET_SIZE / 2 + vector.y * tank.height / 2,
      width: BULLET_SIZE,
      height: BULLET_SIZE,
    });
    tank.fireSeq += 1;
  }

  private updateBullets(): void {
    for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.bullets[index];
      const vector = directionVector(bullet.rotation);
      bullet.x += vector.x * bullet.speed * this.deltaTime;
      bullet.y += vector.y * bullet.speed * this.deltaTime;
      if (!this.insideField(bullet) || this.hitTerrain(bullet) || this.hitTank(bullet)) {
        this.bullets.splice(index, 1);
      }
    }
  }

  private hitTerrain(bullet: BulletState): boolean {
    for (const cell of this.terrain.values()) {
      if (!overlaps(bullet, cell)) continue;
      if (cell.destructible) this.terrain.delete(cell.key);
      return true;
    }
    return false;
  }

  private hitTank(bullet: BulletState): boolean {
    if (bullet.ownerParty === 'player') {
      for (const enemy of this.enemies.values()) {
        if (!overlaps(bullet, enemy)) continue;
        enemy.health -= 1;
        if (enemy.health <= 0) {
          this.enemies.delete(enemy.partyIndex);
          const player = bullet.ownerIndex as SimulationPlayerIndex;
          this.scores[player] += scoreForTier(enemy.tier);
          if (enemy.hasDrop) this.spawnPowerup();
          this.nextEnemySpawnTick = Math.min(this.nextEnemySpawnTick, this.currentTick + 3 * this.tickRate);
        }
        return true;
      }
      const friend = this.players.find((player) =>
        player.partyIndex !== bullet.ownerIndex && player.alive && overlaps(bullet, player),
      );
      if (friend !== undefined) {
        friend.stunnedUntilTick = this.currentTick + Math.ceil(1.5 * this.tickRate);
        return true;
      }
      return false;
    }
    const player = this.players.find((candidate) => candidate.alive && overlaps(bullet, candidate));
    if (player === undefined) return false;
    if (this.currentTick >= player.shieldUntilTick) this.killPlayer(player);
    return true;
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
    if (type === 'life') player.lives += 1;
    else if (type === 'shield') player.shieldUntilTick = this.currentTick + 10 * this.tickRate;
    else if (type === 'speed') player.speed = 240;
    else if (type === 'upgrade') player.tier = nextTier(player.tier);
    else if (type === 'freeze') {
      this.enemies.forEach((enemy) => {
        enemy.aiTurnAtTick = Math.max(enemy.aiTurnAtTick, this.currentTick + 10 * this.tickRate);
      });
    } else if (type === 'wipeout') this.enemies.clear();
  }

  private tryMove(tank: TankState, rotation: SimulationRotation, distance: number): boolean {
    const vector = directionVector(rotation);
    const candidate = {
      ...tank,
      x: clamp(tank.x + vector.x * distance, 0, this.fieldWidth - tank.width),
      y: clamp(tank.y + vector.y * distance, 0, this.fieldHeight - tank.height),
    };
    if (candidate.x === tank.x && candidate.y === tank.y) return false;
    for (const cell of this.terrain.values()) {
      if (overlaps(candidate, cell)) return false;
    }
    const tanks = [...this.players, ...this.enemies.values()];
    if (tanks.some((other) => other !== tank && other.alive && overlaps(candidate, other))) return false;
    tank.x = candidate.x;
    tank.y = candidate.y;
    return true;
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
      fireX: tank.x,
      fireY: tank.y,
      fireRotation: tank.rotation,
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
    }));
    return {
      type: 'webrtc-host-frame',
      seq: ++this.frameSeq,
      tick: this.currentTick,
      deltaTime: this.deltaTime,
      playerScores: this.getScores(),
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
      if (region.type === 'grass' || region.type === 'ice') continue;
      for (let y = 0; y < region.height; y += TILE) {
        for (let x = 0; x < region.width; x += TILE) {
          const cellX = region.x + x;
          const cellY = region.y + this.contentOffsetY + y;
          const key = `${cellX}:${cellY}`;
          this.terrain.set(key, {
            key,
            destructible: region.type === 'brick',
            x: cellX,
            y: cellY,
            width: Math.min(TILE, region.width - x),
            height: Math.min(TILE, region.height - y),
          });
        }
      }
    }
  }

  private createPlayerSpawns(): Array<{ x: number; y: number }> {
    const base = this.getBasePosition();
    const defaults = [
      { x: Math.max(0, base.x - 96), y: this.fieldHeight - LARGE_TILE },
      { x: Math.min(this.fieldWidth - LARGE_TILE, base.x + 96), y: this.fieldHeight - LARGE_TILE },
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
    return { x: Math.floor((this.fieldWidth - LARGE_TILE) / 2), y: this.fieldHeight - LARGE_TILE };
  }

  private insideField(rect: RectState): boolean {
    return rect.x + rect.width >= 0 && rect.y + rect.height >= 0 &&
      rect.x <= this.fieldWidth && rect.y <= this.fieldHeight;
  }
}

function overlaps(left: RectState, right: RectState): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x &&
    left.y < right.y + right.height && left.y + left.height > right.y;
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
