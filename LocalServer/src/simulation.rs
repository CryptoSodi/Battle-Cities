use crate::model::{
    BoardMutation, EnemySnapshot, GameEvent, MatchConfig, PlayerSnapshot, Position, PowerupKind,
    PowerupSnapshot, ProjectileOwner, ProjectileSnapshot, MAX_ACTIVE_ENEMIES, MAX_ENEMY_TOTAL,
    PLAYER_COUNT,
};

const TANK_SIZE: i32 = 1_000;
const BULLET_SIZE: i32 = 250;
const BOARD_CELL_UNITS: i32 = 250;
const ROTATION_SNAP_UNITS: i32 = 500;
const PLAYER_STEP_DENOMINATOR: u16 = 32;
const PLAYER_STEP_NUMERATOR: u16 = 1_500;
const PLAYER_SPEED_STEP_NUMERATOR: u16 = 2_175;
const SLOW_ENEMY_STEP_BASE: i32 = 31;
const FAST_ENEMY_STEP_BASE: i32 = 62;
const BULLET_STEP_SLOW_BASE: i32 = 156;
const BULLET_STEP_FAST_BASE: i32 = 234;
const ENEMY_SPAWN_INTERVAL_TICKS: u64 = 180;
const FIRST_ENEMY_SPAWN_TICK: u64 = 10;
const ENEMY_THINK_TICKS: u64 = 18;
const ENEMY_TILE_ALIGNMENT_UNITS: i32 = 500;
const PLAYER_RESPAWN_TICKS: u64 = 90;
const SPAWN_SHIELD_TICKS: u64 = 210;
const FRIENDLY_STUN_TICKS: u64 = 300;
const MAX_TERRAIN_CELLS_PER_AXIS: u8 = 108;
const MAX_EVENTS: usize = 256;
const MAX_BOARD_MUTATIONS: usize = 512;
const POWERUP_SIZE: i32 = 1_000;
const POWERUP_DURATION_TICKS: u64 = 1_800;
const POWERUP_EFFECT_TICKS: u64 = 600;
const BASE_DEFENCE_TICKS: u64 = 1_020;

const TERRAIN_EMPTY: u8 = 0;
const TERRAIN_BRICK: u8 = 1;
const TERRAIN_STEEL: u8 = 2;
const TERRAIN_WATER: u8 = 3;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MatchPhase {
    Waiting,
    Active,
    Won,
    Lost,
}

impl MatchPhase {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Waiting => "waiting",
            Self::Active => "active",
            Self::Won => "won",
            Self::Lost => "lost",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct PlayerState {
    pub position: Position,
    pub direction: u8,
    pub moving: bool,
    pub connected: bool,
    pub claimed: bool,
    pub sequence: u64,
    pub fire_sequence: u64,
    pub queued_fire: bool,
    pub alive: bool,
    pub lives: u8,
    pub health: u8,
    pub score: u32,
    pub kills: u16,
    movement_remainder: u8,
    last_fire_tick: u64,
    respawn_tick: u64,
    invulnerable_until: u64,
    stunned_until: u64,
    tier: u8,
    speed_until: u64,
}

impl PlayerState {
    fn at_spawn(position: Position) -> Self {
        Self {
            position,
            direction: 0,
            moving: false,
            connected: false,
            claimed: false,
            sequence: 0,
            fire_sequence: 0,
            queued_fire: false,
            alive: true,
            lives: 3,
            health: 1,
            score: 0,
            kills: 0,
            movement_remainder: 0,
            last_fire_tick: 0,
            respawn_tick: 0,
            invulnerable_until: SPAWN_SHIELD_TICKS,
            stunned_until: 0,
            tier: 0,
            speed_until: 0,
        }
    }

    pub fn snapshot(self, tick: u64) -> PlayerSnapshot {
        PlayerSnapshot {
            x: self.position.x,
            y: self.position.y,
            direction: self.direction,
            moving: self.moving,
            sequence: self.sequence,
            connected: self.connected,
            alive: self.alive,
            lives: self.lives,
            health: self.health,
            score: self.score,
            kills: self.kills,
            stunned: tick < self.stunned_until,
            tier: self.tier,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum EnemyAiState {
    Moving,
    Thinking,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ProjectileAxis {
    Vertical,
    Horizontal,
}

#[derive(Clone, Copy, Debug)]
struct EnemyState {
    id: u16,
    position: Position,
    direction: u8,
    tier: u8,
    health: u8,
    active: bool,
    movement_remainder: u8,
    ai_state: EnemyAiState,
    next_turn_tick: u64,
    next_fire_tick: u64,
    has_drop: bool,
}

impl EnemyState {
    fn inactive() -> Self {
        Self {
            id: 0,
            position: Position::default(),
            direction: 2,
            tier: 0,
            health: 0,
            active: false,
            movement_remainder: 0,
            ai_state: EnemyAiState::Moving,
            next_turn_tick: 0,
            next_fire_tick: 0,
            has_drop: false,
        }
    }

    fn snapshot(self) -> EnemySnapshot {
        EnemySnapshot {
            id: self.id,
            x: self.position.x,
            y: self.position.y,
            direction: self.direction,
            tier: self.tier,
            health: self.health,
        }
    }
}

#[derive(Clone, Copy, Debug)]
struct ProjectileState {
    id: u32,
    owner: ProjectileOwner,
    owner_id: u16,
    position: Position,
    direction: u8,
    fast: bool,
    high_wall_damage: bool,
    movement_remainder: u8,
}

#[derive(Clone, Copy, Debug)]
struct PowerupState {
    id: u32,
    kind: PowerupKind,
    position: Position,
    expires_at: u64,
}

impl ProjectileState {
    fn snapshot(self) -> ProjectileSnapshot {
        ProjectileSnapshot {
            id: self.id,
            owner: self.owner,
            owner_id: self.owner_id,
            x: self.position.x,
            y: self.position.y,
            direction: self.direction,
        }
    }
}

pub struct MatchSimulation {
    pub config: MatchConfig,
    pub players: [PlayerState; PLAYER_COUNT],
    pub tick: u64,
    pub phase: MatchPhase,
    enemies: [EnemyState; MAX_ACTIVE_ENEMIES],
    projectiles: Vec<ProjectileState>,
    enemy_spawn_cursor: usize,
    next_enemy_spawn_tick: u64,
    next_projectile_id: u32,
    rng_state: u64,
    terrain: Vec<u8>,
    board_mutations: Vec<BoardMutation>,
    events: Vec<GameEvent>,
    next_event_id: u64,
    base_alive: bool,
    base_invulnerable_until: u64,
    enemies_frozen_until: u64,
    powerup: Option<PowerupState>,
    next_powerup_id: u32,
}

impl MatchSimulation {
    pub fn new(config: MatchConfig, seed: u64) -> Result<Self, &'static str> {
        validate_config(&config)?;
        let mut simulation = Self {
            players: [
                PlayerState::at_spawn(config.spawns[0]),
                PlayerState::at_spawn(config.spawns[1]),
            ],
            terrain: config.terrain.clone(),
            config,
            tick: 0,
            phase: MatchPhase::Waiting,
            enemies: [EnemyState::inactive(); MAX_ACTIVE_ENEMIES],
            projectiles: Vec::new(),
            enemy_spawn_cursor: 0,
            next_enemy_spawn_tick: FIRST_ENEMY_SPAWN_TICK,
            next_projectile_id: 1,
            rng_state: seed.max(1),
            board_mutations: Vec::new(),
            events: Vec::new(),
            next_event_id: 1,
            base_alive: true,
            base_invulnerable_until: 0,
            enemies_frozen_until: 0,
            powerup: None,
            next_powerup_id: 1,
        };
        simulation.set_base_frame(TERRAIN_BRICK);
        Ok(simulation)
    }

    pub fn is_active(&self) -> bool {
        self.phase == MatchPhase::Active
    }

    pub fn refresh_phase(&mut self) {
        if self.phase == MatchPhase::Waiting && self.players.iter().all(|player| player.connected) {
            self.phase = MatchPhase::Active;
        }
    }

    pub fn tick(&mut self) {
        self.refresh_phase();
        if !self.is_active() {
            return;
        }
        self.tick = self.tick.wrapping_add(1);
        if self.base_invulnerable_until != 0 && self.tick >= self.base_invulnerable_until {
            self.base_invulnerable_until = 0;
            self.set_base_frame(TERRAIN_BRICK);
        }
        self.respawn_players();
        self.spawn_enemy_if_due();
        for player_index in 0..PLAYER_COUNT {
            self.move_player(player_index);
            self.fire_player_if_requested(player_index);
        }
        self.collect_powerup();
        for enemy_index in 0..MAX_ACTIVE_ENEMIES {
            self.simulate_enemy(enemy_index);
        }
        self.simulate_projectiles();
        self.check_match_end();
    }

    pub fn enemies(&self) -> Vec<EnemySnapshot> {
        self.enemies
            .iter()
            .filter(|enemy| enemy.active)
            .copied()
            .map(EnemyState::snapshot)
            .collect()
    }

    pub fn projectiles(&self) -> Vec<ProjectileSnapshot> {
        self.projectiles
            .iter()
            .copied()
            .map(ProjectileState::snapshot)
            .collect()
    }

    pub fn board_mutations(&self) -> &[BoardMutation] {
        &self.board_mutations
    }

    pub fn events(&self) -> &[GameEvent] {
        &self.events
    }

    pub fn base_alive(&self) -> bool {
        self.base_alive
    }

    pub fn powerup(&self) -> Option<PowerupSnapshot> {
        self.powerup.map(|powerup| PowerupSnapshot {
            id: powerup.id,
            kind: powerup.kind,
            x: powerup.position.x,
            y: powerup.position.y,
        })
    }

    pub fn set_player_input(
        &mut self,
        player_index: usize,
        sequence: u64,
        direction: u8,
        moving: bool,
    ) {
        if player_index >= PLAYER_COUNT || sequence <= self.players[player_index].sequence {
            return;
        }
        if direction != self.players[player_index].direction {
            let snapped =
                snap_position_for_direction(self.players[player_index].position, direction);
            if !self.tank_position_blocked(snapped, Some(player_index), None) {
                self.players[player_index].position = snapped;
            }
            self.players[player_index].movement_remainder = 0;
        }
        self.players[player_index].sequence = sequence;
        self.players[player_index].direction = direction;
        self.players[player_index].moving = moving;
    }

    fn move_player(&mut self, player_index: usize) {
        let player = self.players[player_index];
        if !player.alive || !player.moving || self.tick < player.stunned_until || !player.connected
        {
            return;
        }
        let numerator = if self.tick < player.speed_until {
            PLAYER_SPEED_STEP_NUMERATOR
        } else {
            PLAYER_STEP_NUMERATOR
        };
        let accumulated = u16::from(player.movement_remainder) + numerator;
        let distance = i32::from(accumulated / PLAYER_STEP_DENOMINATOR);
        let candidate = move_position(player.position, player.direction, distance);
        self.players[player_index].movement_remainder =
            (accumulated % PLAYER_STEP_DENOMINATOR) as u8;
        if self.tank_position_blocked(candidate, Some(player_index), None) {
            return;
        }
        self.players[player_index].position = candidate;
    }

    fn fire_player_if_requested(&mut self, player_index: usize) {
        if !self.players[player_index].queued_fire {
            return;
        }
        self.players[player_index].queued_fire = false;
        if !self.players[player_index].alive
            || self
                .tick
                .saturating_sub(self.players[player_index].last_fire_tick)
                < 10
            || self
                .projectiles
                .iter()
                .filter(|bullet| {
                    bullet.owner == ProjectileOwner::Player
                        && bullet.owner_id == player_index as u16
                })
                .count()
                >= if self.players[player_index].tier >= 2 {
                    2
                } else {
                    1
                }
        {
            return;
        }
        let player = self.players[player_index];
        self.spawn_projectile(
            ProjectileOwner::Player,
            player_index as u16,
            player.position,
            player.direction,
            player.tier >= 1,
            player.tier >= 3,
        );
        self.players[player_index].last_fire_tick = self.tick;
    }

    fn spawn_enemy_if_due(&mut self) {
        if self.tick < self.next_enemy_spawn_tick
            || self.enemy_spawn_cursor >= self.config.enemy_tiers.len()
        {
            return;
        }
        let Some(slot) = self.enemies.iter().position(|enemy| !enemy.active) else {
            return;
        };
        let id = self.enemy_spawn_cursor;
        let spawn = self.config.enemy_spawns[id % self.config.enemy_spawns.len()];
        if self.tank_position_blocked(spawn, None, None) {
            self.next_enemy_spawn_tick = self.tick + 10;
            return;
        }
        let tier = self.config.enemy_tiers[id];
        let health = if tier == 3 { 4 } else { 1 };
        let fire_delay = self.next_random() % 91;
        self.enemies[slot] = EnemyState {
            id: id as u16,
            position: spawn,
            direction: 2,
            tier,
            health,
            active: true,
            movement_remainder: 0,
            ai_state: EnemyAiState::Moving,
            next_turn_tick: 0,
            next_fire_tick: self.tick + fire_delay,
            has_drop: self.config.enemy_drops[id],
        };
        self.enemy_spawn_cursor += 1;
        self.next_enemy_spawn_tick = self.tick + ENEMY_SPAWN_INTERVAL_TICKS;
    }

    fn simulate_enemy(&mut self, index: usize) {
        let mut enemy = self.enemies[index];
        if !enemy.active {
            return;
        }
        if self.tick < self.enemies_frozen_until {
            return;
        }
        if !self.config.debug_disable_enemy_shooting && self.tick >= enemy.next_fire_tick {
            let has_bullet = self.projectiles.iter().any(|bullet| {
                bullet.owner == ProjectileOwner::Enemy && bullet.owner_id == enemy.id
            });
            if !has_bullet {
                self.spawn_projectile(
                    ProjectileOwner::Enemy,
                    enemy.id,
                    enemy.position,
                    enemy.direction,
                    enemy.tier == 2,
                    false,
                );
            }
            enemy.next_fire_tick = self.tick + self.next_random() % 91;
        }
        if enemy.ai_state == EnemyAiState::Thinking {
            if self.tick < enemy.next_turn_tick {
                self.enemies[index] = enemy;
                return;
            }
            enemy.direction = self.next_enemy_direction(enemy.position);
            enemy.ai_state = EnemyAiState::Moving;
            self.enemies[index] = enemy;
            return;
        }
        let (base, increment) = if enemy.tier == 1 {
            (FAST_ENEMY_STEP_BASE, 2)
        } else {
            (SLOW_ENEMY_STEP_BASE, 1)
        };
        let accumulated = enemy.movement_remainder + increment;
        let candidate = move_position(
            enemy.position,
            enemy.direction,
            base + i32::from(accumulated / 4),
        );
        enemy.movement_remainder = accumulated % 4;
        if self.tank_position_blocked(candidate, None, Some(index)) {
            enemy.ai_state = EnemyAiState::Thinking;
            enemy.next_turn_tick = self.tick + ENEMY_THINK_TICKS;
        } else {
            enemy.position = candidate;
            let aligned = match enemy.direction {
                0 | 2 => enemy.position.y % ENEMY_TILE_ALIGNMENT_UNITS == 0,
                _ => enemy.position.x % ENEMY_TILE_ALIGNMENT_UNITS == 0,
            };
            if aligned && self.random_probability(5) {
                enemy.ai_state = EnemyAiState::Thinking;
                enemy.next_turn_tick = self.tick + ENEMY_THINK_TICKS;
            }
        }
        self.enemies[index] = enemy;
    }

    fn spawn_projectile(
        &mut self,
        owner: ProjectileOwner,
        owner_id: u16,
        tank_position: Position,
        direction: u8,
        fast: bool,
        high_wall_damage: bool,
    ) {
        let position = projectile_origin(tank_position, direction);
        self.projectiles.push(ProjectileState {
            id: self.next_projectile_id,
            owner,
            owner_id,
            position,
            direction,
            fast,
            high_wall_damage,
            movement_remainder: 0,
        });
        self.next_projectile_id = self.next_projectile_id.wrapping_add(1).max(1);
    }

    fn simulate_projectiles(&mut self) {
        let mut active = Vec::with_capacity(self.projectiles.len());
        let projectiles = std::mem::take(&mut self.projectiles);
        for mut projectile in projectiles {
            let increment = if projectile.fast { 3 } else { 1 };
            let divisor = if projectile.fast { 8 } else { 4 };
            let accumulated = projectile.movement_remainder + increment;
            let base = if projectile.fast {
                BULLET_STEP_FAST_BASE
            } else {
                BULLET_STEP_SLOW_BASE
            };
            let candidate = move_position(
                projectile.position,
                projectile.direction,
                base + i32::from(accumulated / divisor),
            );
            projectile.movement_remainder = accumulated % divisor;
            if !projectile_in_bounds(candidate, &self.config) {
                continue;
            }
            if self.projectile_hits_terrain(
                candidate,
                projectile.direction,
                projectile.high_wall_damage,
            ) {
                continue;
            }
            if self.projectile_hits_entity(projectile, candidate) {
                continue;
            }
            projectile.position = candidate;
            active.push(projectile);
        }
        self.projectiles = active;
        self.resolve_projectile_collisions();
    }

    fn projectile_hits_terrain(
        &mut self,
        position: Position,
        direction: u8,
        high_wall_damage: bool,
    ) -> bool {
        let min_x = position.x / BOARD_CELL_UNITS;
        let min_y = position.y / BOARD_CELL_UNITS;
        let max_x = (position.x + BULLET_SIZE - 1) / BOARD_CELL_UNITS;
        let max_y = (position.y + BULLET_SIZE - 1) / BOARD_CELL_UNITS;
        let hit = match direction {
            0 => (min_x..=max_x)
                .find_map(|x| self.projectile_wall_cell(x, min_y).map(|_| (x, min_y))),
            1 => (min_y..=max_y)
                .find_map(|y| self.projectile_wall_cell(max_x, y).map(|_| (max_x, y))),
            2 => (min_x..=max_x)
                .find_map(|x| self.projectile_wall_cell(x, max_y).map(|_| (x, max_y))),
            _ => (min_y..=max_y)
                .find_map(|y| self.projectile_wall_cell(min_x, y).map(|_| (min_x, y))),
        };
        if let Some((x, y)) = hit {
            self.destroy_terrain_front_row(x, y, position, direction, high_wall_damage);
            return true;
        }
        false
    }

    fn projectile_wall_cell(&self, x: i32, y: i32) -> Option<u8> {
        let terrain = self.terrain_cell(x, y);
        matches!(terrain, TERRAIN_BRICK | TERRAIN_STEEL).then_some(terrain)
    }

    fn destroy_terrain_front_row(
        &mut self,
        hit_x: i32,
        hit_y: i32,
        projectile_position: Position,
        direction: u8,
        high_wall_damage: bool,
    ) {
        let hit_terrain = self.terrain_cell(hit_x, hit_y);
        if hit_terrain == TERRAIN_STEEL && !high_wall_damage {
            return;
        }

        let damage_cells = if high_wall_damage { 8 } else { 4 };
        let bullet_center_x = projectile_position.x + BULLET_SIZE / 2;
        let bullet_center_y = projectile_position.y + BULLET_SIZE / 2;
        let axis = match direction {
            0 | 2 => ProjectileAxis::Vertical,
            _ => ProjectileAxis::Horizontal,
        };
        let center_cell = match axis {
            ProjectileAxis::Vertical => bullet_center_x / BOARD_CELL_UNITS,
            ProjectileAxis::Horizontal => bullet_center_y / BOARD_CELL_UNITS,
        };
        let start = center_cell - damage_cells / 2;
        let end = start + damage_cells - 1;

        for offset in start..=end {
            let (x, y) = match axis {
                ProjectileAxis::Vertical => (offset, hit_y),
                ProjectileAxis::Horizontal => (hit_x, offset),
            };
            let terrain = self.terrain_cell(x, y);
            if terrain == TERRAIN_BRICK || (terrain == TERRAIN_STEEL && high_wall_damage) {
                self.clear_terrain_cell(x, y);
            }
        }
    }

    fn projectile_hits_entity(&mut self, projectile: ProjectileState, position: Position) -> bool {
        match projectile.owner {
            ProjectileOwner::Player => {
                for player_index in 0..PLAYER_COUNT {
                    if player_index as u16 == projectile.owner_id
                        || !self.players[player_index].alive
                        || !rects_overlap(
                            position,
                            BULLET_SIZE,
                            self.players[player_index].position,
                            TANK_SIZE,
                        )
                    {
                        continue;
                    }
                    self.players[player_index].stunned_until = self.tick + FRIENDLY_STUN_TICKS;
                    return true;
                }
                for enemy_index in 0..MAX_ACTIVE_ENEMIES {
                    if self.enemies[enemy_index].active
                        && rects_overlap(
                            position,
                            BULLET_SIZE,
                            self.enemies[enemy_index].position,
                            TANK_SIZE,
                        )
                    {
                        self.damage_enemy(enemy_index, projectile.owner_id as u8);
                        return true;
                    }
                }
            }
            ProjectileOwner::Enemy => {
                for player_index in 0..PLAYER_COUNT {
                    let player = self.players[player_index];
                    if player.alive
                        && self.tick >= player.invulnerable_until
                        && rects_overlap(position, BULLET_SIZE, player.position, TANK_SIZE)
                    {
                        self.kill_player(player_index);
                        return true;
                    }
                }
                if self.base_alive
                    && self.tick >= self.base_invulnerable_until
                    && rects_overlap(position, BULLET_SIZE, self.base_heart_position(), TANK_SIZE)
                {
                    self.base_alive = false;
                    self.push_event(|event_id| GameEvent::BaseDied { event_id });
                    self.lose_match();
                    return true;
                }
            }
        }
        false
    }

    fn resolve_projectile_collisions(&mut self) {
        let mut removed = vec![false; self.projectiles.len()];
        for first in 0..self.projectiles.len() {
            for second in (first + 1)..self.projectiles.len() {
                if self.projectiles[first].owner == self.projectiles[second].owner {
                    continue;
                }
                if rects_overlap(
                    self.projectiles[first].position,
                    BULLET_SIZE,
                    self.projectiles[second].position,
                    BULLET_SIZE,
                ) {
                    removed[first] = true;
                    removed[second] = true;
                }
            }
        }
        let mut index = 0;
        self.projectiles.retain(|_| {
            let keep = !removed[index];
            index += 1;
            keep
        });
    }

    fn damage_enemy(&mut self, enemy_index: usize, killer: u8) {
        if self.enemies[enemy_index].has_drop {
            self.enemies[enemy_index].has_drop = false;
            self.spawn_powerup();
        }
        let enemy = &mut self.enemies[enemy_index];
        enemy.health = enemy.health.saturating_sub(1);
        if enemy.health > 0 {
            return;
        }
        enemy.active = false;
        let enemy_id = enemy.id;
        let tier = enemy.tier;
        if let Some(player) = self.players.get_mut(usize::from(killer)) {
            player.kills = player.kills.saturating_add(1);
            player.score = player.score.saturating_add(100 * (u32::from(tier) + 1));
        }
        self.push_event(|event_id| GameEvent::EnemyDied {
            event_id,
            id: enemy_id,
            killer,
        });
    }

    fn kill_player(&mut self, player_index: usize) {
        let player = &mut self.players[player_index];
        if !player.alive {
            return;
        }
        player.alive = false;
        player.health = 0;
        player.moving = false;
        player.lives = player.lives.saturating_sub(1);
        player.respawn_tick = if player.lives > 0 {
            self.tick + PLAYER_RESPAWN_TICKS
        } else {
            0
        };
        self.push_event(|event_id| GameEvent::PlayerDied {
            event_id,
            player: player_index as u8,
        });
    }

    fn respawn_players(&mut self) {
        for index in 0..PLAYER_COUNT {
            let player = &mut self.players[index];
            if !player.alive && player.lives > 0 && self.tick >= player.respawn_tick {
                player.position = self.config.spawns[index];
                player.direction = 0;
                player.health = 1;
                player.alive = true;
                player.moving = false;
                player.invulnerable_until = self.tick + SPAWN_SHIELD_TICKS;
            }
        }
    }

    fn spawn_powerup(&mut self) {
        let kind = match self.next_random() % 8 {
            0 => PowerupKind::BaseDefence,
            1 => PowerupKind::Freeze,
            2 => PowerupKind::Life,
            3 => PowerupKind::Shield,
            4 => PowerupKind::Speed,
            5 => PowerupKind::Upgrade,
            6 => PowerupKind::ZoomOut,
            _ => PowerupKind::Wipeout,
        };
        let columns = (self.config.field_width / POWERUP_SIZE).max(1) as u64;
        let rows = (self.config.field_height / POWERUP_SIZE).max(1) as u64;
        let mut position = self.config.spawns[0];
        for _ in 0..64 {
            let candidate = Position {
                x: (self.next_random() % columns) as i32 * POWERUP_SIZE,
                y: (self.next_random() % rows) as i32 * POWERUP_SIZE,
            };
            if !self.powerup_position_blocked(candidate)
                && !positions_overlap(candidate, self.config.base_position)
                && !self
                    .config
                    .spawns
                    .iter()
                    .chain(self.config.enemy_spawns.iter())
                    .any(|spawn| positions_overlap(candidate, *spawn))
                && !self
                    .players
                    .iter()
                    .any(|player| player.alive && positions_overlap(candidate, player.position))
            {
                position = candidate;
                break;
            }
        }
        self.powerup = Some(PowerupState {
            id: self.next_powerup_id,
            kind,
            position,
            expires_at: self.tick + POWERUP_DURATION_TICKS,
        });
        self.next_powerup_id = self.next_powerup_id.wrapping_add(1).max(1);
    }

    fn collect_powerup(&mut self) {
        let Some(powerup) = self.powerup else {
            return;
        };
        if self.tick >= powerup.expires_at {
            self.powerup = None;
            return;
        }
        let Some(player_index) = self.players.iter().position(|player| {
            player.alive
                && intersection_dimensions(
                    player.position,
                    TANK_SIZE,
                    powerup.position,
                    POWERUP_SIZE,
                )
                .is_some_and(|(width, height)| {
                    width > BOARD_CELL_UNITS && height > BOARD_CELL_UNITS
                })
        }) else {
            return;
        };
        self.powerup = None;
        self.apply_powerup(player_index, powerup.kind);
        self.push_event(|event_id| GameEvent::PowerupPicked {
            event_id,
            player: player_index as u8,
            powerup: powerup.kind,
            x: powerup.position.x,
            y: powerup.position.y,
        });
    }

    fn apply_powerup(&mut self, player_index: usize, kind: PowerupKind) {
        match kind {
            PowerupKind::BaseDefence => {
                self.base_invulnerable_until = self.tick + BASE_DEFENCE_TICKS;
                self.set_base_frame(TERRAIN_STEEL);
            }
            PowerupKind::Freeze => {
                self.enemies_frozen_until = self.tick + POWERUP_EFFECT_TICKS;
            }
            PowerupKind::Life => {
                self.players[player_index].lives =
                    self.players[player_index].lives.saturating_add(1);
            }
            PowerupKind::Shield => {
                self.players[player_index].invulnerable_until = self.tick + POWERUP_EFFECT_TICKS;
            }
            PowerupKind::Speed => {
                self.players[player_index].speed_until = self.tick + POWERUP_EFFECT_TICKS;
            }
            PowerupKind::Upgrade => {
                self.players[player_index].tier =
                    self.players[player_index].tier.saturating_add(1).min(3);
            }
            PowerupKind::ZoomOut => {}
            PowerupKind::Wipeout => {
                for index in 0..MAX_ACTIVE_ENEMIES {
                    if !self.enemies[index].active {
                        continue;
                    }
                    let id = self.enemies[index].id;
                    self.enemies[index].active = false;
                    self.push_event(|event_id| GameEvent::EnemyDied {
                        event_id,
                        id,
                        killer: u8::MAX,
                    });
                }
            }
        }
    }

    fn check_match_end(&mut self) {
        if self.phase != MatchPhase::Active {
            return;
        }
        if !self.base_alive
            || self
                .players
                .iter()
                .all(|player| !player.alive && player.lives == 0)
        {
            self.lose_match();
            return;
        }
        if self.enemy_spawn_cursor >= self.config.enemy_tiers.len()
            && self.enemies.iter().all(|enemy| !enemy.active)
        {
            self.phase = MatchPhase::Won;
            self.projectiles.clear();
            self.push_event(|event_id| GameEvent::MatchWon { event_id });
        }
    }

    fn lose_match(&mut self) {
        if self.phase == MatchPhase::Lost {
            return;
        }
        self.phase = MatchPhase::Lost;
        self.projectiles.clear();
        self.push_event(|event_id| GameEvent::MatchLost { event_id });
    }

    fn tank_position_blocked(
        &self,
        position: Position,
        player_to_ignore: Option<usize>,
        enemy_to_ignore: Option<usize>,
    ) -> bool {
        if !position_in_bounds(position, &self.config) || self.terrain_blocks_tank(position) {
            return true;
        }
        if rects_overlap(position, TANK_SIZE, self.base_heart_position(), TANK_SIZE) {
            return true;
        }
        if self.players.iter().enumerate().any(|(index, player)| {
            Some(index) != player_to_ignore
                && player.alive
                && positions_overlap(position, player.position)
        }) {
            return true;
        }
        self.enemies.iter().enumerate().any(|(index, enemy)| {
            Some(index) != enemy_to_ignore
                && enemy.active
                && positions_overlap(position, enemy.position)
        })
    }

    fn terrain_blocks_tank(&self, position: Position) -> bool {
        let min_x = position.x / ROTATION_SNAP_UNITS;
        let min_y = position.y / ROTATION_SNAP_UNITS;
        let max_x = (position.x + TANK_SIZE - 1) / ROTATION_SNAP_UNITS;
        let max_y = (position.y + TANK_SIZE - 1) / ROTATION_SNAP_UNITS;
        for y in min_y..=max_y {
            for x in min_x..=max_x {
                if self.movement_terrain_blocks_tank(x, y) {
                    return true;
                }
            }
        }
        false
    }

    fn movement_terrain_blocks_tank(&self, super_x: i32, super_y: i32) -> bool {
        let base_x = super_x * 2;
        let base_y = super_y * 2;
        for y in base_y..base_y + 2 {
            for x in base_x..base_x + 2 {
                if matches!(
                    self.terrain_cell(x, y),
                    TERRAIN_BRICK | TERRAIN_STEEL | TERRAIN_WATER
                ) {
                    return true;
                }
            }
        }
        false
    }

    fn powerup_position_blocked(&self, position: Position) -> bool {
        let min_x = position.x / BOARD_CELL_UNITS;
        let min_y = position.y / BOARD_CELL_UNITS;
        let max_x = (position.x + POWERUP_SIZE - 1) / BOARD_CELL_UNITS;
        let max_y = (position.y + POWERUP_SIZE - 1) / BOARD_CELL_UNITS;
        for y in min_y..=max_y {
            for x in min_x..=max_x {
                if matches!(self.terrain_cell(x, y), TERRAIN_STEEL | TERRAIN_WATER) {
                    return true;
                }
            }
        }
        false
    }

    fn terrain_cell(&self, x: i32, y: i32) -> u8 {
        if x < 0
            || y < 0
            || x >= i32::from(self.config.terrain_width)
            || y >= i32::from(self.config.terrain_height)
        {
            return TERRAIN_STEEL;
        }
        self.terrain[y as usize * usize::from(self.config.terrain_width) + x as usize]
    }

    fn clear_terrain_cell(&mut self, x: i32, y: i32) {
        if x < 0
            || y < 0
            || x >= i32::from(self.config.terrain_width)
            || y >= i32::from(self.config.terrain_height)
        {
            return;
        }
        let index = y as usize * usize::from(self.config.terrain_width) + x as usize;
        if self.terrain[index] == TERRAIN_EMPTY {
            return;
        }
        self.terrain[index] = TERRAIN_EMPTY;
        if self.board_mutations.len() < MAX_BOARD_MUTATIONS {
            self.board_mutations.push(BoardMutation {
                x: x as u8,
                y: y as u8,
            });
        }
    }

    fn base_heart_position(&self) -> Position {
        Position {
            x: self.config.base_position.x + 500,
            y: self.config.base_position.y + 500,
        }
    }

    fn set_base_frame(&mut self, terrain: u8) {
        let origin_x = self.config.base_position.x / BOARD_CELL_UNITS;
        let origin_y = self.config.base_position.y / BOARD_CELL_UNITS;
        for y in 0..6 {
            for x in 0..8 {
                if y < 2 || !(2..6).contains(&x) {
                    let cell_x = origin_x + x;
                    let cell_y = origin_y + y;
                    if cell_x < 0
                        || cell_y < 0
                        || cell_x >= i32::from(self.config.terrain_width)
                        || cell_y >= i32::from(self.config.terrain_height)
                    {
                        continue;
                    }
                    let index =
                        cell_y as usize * usize::from(self.config.terrain_width) + cell_x as usize;
                    self.terrain[index] = terrain;
                }
            }
        }
    }

    fn next_enemy_direction(&mut self, position: Position) -> u8 {
        if self.random_probability(30) {
            let dx = self.config.base_position.x - position.x;
            let dy = self.config.base_position.y - position.y;
            if dx.abs() >= dy.abs() {
                return if dx > 0 { 1 } else { 3 };
            }
            return 2;
        }
        if self.random_probability(10) {
            return 0;
        }
        [2, 3, 1][(self.next_random() % 3) as usize]
    }

    fn next_random(&mut self) -> u64 {
        let mut value = self.rng_state;
        value ^= value << 13;
        value ^= value >> 7;
        value ^= value << 17;
        self.rng_state = value.max(1);
        self.rng_state
    }

    fn random_probability(&mut self, chance: u8) -> bool {
        self.next_random() % 100 < u64::from(chance)
    }

    fn push_event(&mut self, create: impl FnOnce(u64) -> GameEvent) {
        let event = create(self.next_event_id);
        self.next_event_id = self.next_event_id.wrapping_add(1).max(1);
        if self.events.len() == MAX_EVENTS {
            self.events.remove(0);
        }
        self.events.push(event);
    }
}

pub fn validate_config(config: &MatchConfig) -> Result<(), &'static str> {
    if config.field_width <= 0 || config.field_height <= 0 {
        return Err("field dimensions must be positive");
    }
    if config.enemy_spawns.is_empty()
        || config.enemy_tiers.len() > MAX_ENEMY_TOTAL
        || config.enemy_drops.len() != config.enemy_tiers.len()
        || config.enemy_tiers.iter().any(|tier| *tier > 3)
    {
        return Err("enemy configuration is invalid");
    }
    if config.terrain_width == 0
        || config.terrain_height == 0
        || config.terrain_width > MAX_TERRAIN_CELLS_PER_AXIS
        || config.terrain_height > MAX_TERRAIN_CELLS_PER_AXIS
    {
        return Err("terrain dimensions are invalid");
    }
    let required_cells = usize::from(config.terrain_width) * usize::from(config.terrain_height);
    if config.terrain.len() != required_cells || config.terrain.iter().any(|cell| *cell > 3) {
        return Err("terrain cell data is invalid");
    }
    if config
        .spawns
        .iter()
        .chain(config.enemy_spawns.iter())
        .chain(std::iter::once(&config.base_position))
        .any(|position| !position_in_bounds(*position, config))
    {
        return Err("a spawn or base position is outside the field");
    }
    Ok(())
}

fn move_position(position: Position, direction: u8, distance: i32) -> Position {
    match direction {
        0 => Position {
            y: position.y - distance,
            ..position
        },
        1 => Position {
            x: position.x + distance,
            ..position
        },
        2 => Position {
            y: position.y + distance,
            ..position
        },
        _ => Position {
            x: position.x - distance,
            ..position
        },
    }
}

fn projectile_origin(tank: Position, direction: u8) -> Position {
    match direction {
        0 => Position {
            x: tank.x + 375,
            y: tank.y,
        },
        1 => Position {
            x: tank.x + 750,
            y: tank.y + 375,
        },
        2 => Position {
            x: tank.x + 375,
            y: tank.y + 750,
        },
        _ => Position {
            x: tank.x,
            y: tank.y + 375,
        },
    }
}

fn snap_position_for_direction(position: Position, direction: u8) -> Position {
    match direction {
        0 | 2 => Position {
            x: snap_to_grid(position.x, ROTATION_SNAP_UNITS),
            ..position
        },
        _ => Position {
            y: snap_to_grid(position.y, ROTATION_SNAP_UNITS),
            ..position
        },
    }
}

fn snap_to_grid(value: i32, grid: i32) -> i32 {
    ((value + grid / 2) / grid) * grid
}

fn position_in_bounds(position: Position, config: &MatchConfig) -> bool {
    position.x >= 0
        && position.y >= 0
        && position.x <= config.field_width
        && position.y <= config.field_height
}

fn projectile_in_bounds(position: Position, config: &MatchConfig) -> bool {
    position.x + BULLET_SIZE >= 0
        && position.y + BULLET_SIZE >= 0
        && position.x <= config.field_width + TANK_SIZE
        && position.y <= config.field_height + TANK_SIZE
}

fn positions_overlap(first: Position, second: Position) -> bool {
    rects_overlap(first, TANK_SIZE, second, TANK_SIZE)
}

fn rects_overlap(first: Position, first_size: i32, second: Position, second_size: i32) -> bool {
    first.x < second.x + second_size
        && first.x + first_size > second.x
        && first.y < second.y + second_size
        && first.y + first_size > second.y
}

fn intersection_dimensions(
    first: Position,
    first_size: i32,
    second: Position,
    second_size: i32,
) -> Option<(i32, i32)> {
    let width = (first.x + first_size).min(second.x + second_size) - first.x.max(second.x);
    let height = (first.y + first_size).min(second.y + second_size) - first.y.max(second.y);
    (width > 0 && height > 0).then_some((width, height))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn open_config() -> MatchConfig {
        MatchConfig {
            field_width: 3_000,
            field_height: 3_000,
            spawns: [Position { x: 0, y: 2_000 }, Position { x: 2_000, y: 2_000 }],
            enemy_spawns: vec![Position { x: 1_000, y: 0 }],
            enemy_tiers: vec![0],
            enemy_drops: vec![false],
            terrain_width: 16,
            terrain_height: 16,
            terrain: vec![0; 256],
            base_position: Position { x: 2_000, y: 0 },
            debug_disable_enemy_shooting: false,
        }
    }

    fn active_simulation() -> MatchSimulation {
        let mut simulation = MatchSimulation::new(open_config(), 7).unwrap();
        simulation.players[0].connected = true;
        simulation.players[1].connected = true;
        simulation.refresh_phase();
        simulation
    }

    #[test]
    fn player_movement_uses_all_cardinal_directions() {
        let directions = [(0, 0, -46), (1, 46, 0), (2, 0, 46), (3, -46, 0)];
        for (direction, delta_x, delta_y) in directions {
            let mut simulation = active_simulation();
            simulation.players[0].position = Position { x: 500, y: 1_500 };
            simulation.players[0].direction = direction;
            simulation.players[0].moving = true;
            simulation.tick();
            assert_eq!(simulation.players[0].position.x, 500 + delta_x);
            assert_eq!(simulation.players[0].position.y, 1_500 + delta_y);
        }
    }

    #[test]
    fn player_bullet_kills_enemy_and_awards_score() {
        let mut simulation = active_simulation();
        simulation.enemies[0] = EnemyState {
            id: 0,
            position: Position { x: 1_000, y: 500 },
            direction: 2,
            tier: 0,
            health: 1,
            active: true,
            movement_remainder: 0,
            ai_state: EnemyAiState::Moving,
            next_turn_tick: 0,
            next_fire_tick: u64::MAX,
            has_drop: false,
        };
        simulation.projectiles.push(ProjectileState {
            id: 1,
            owner: ProjectileOwner::Player,
            owner_id: 0,
            position: Position { x: 1_375, y: 1_000 },
            direction: 0,
            fast: false,
            high_wall_damage: false,
            movement_remainder: 0,
        });
        simulation.simulate_projectiles();
        assert!(!simulation.enemies[0].active);
        assert_eq!(simulation.players[0].score, 100);
        assert_eq!(simulation.players[0].kills, 1);
    }

    #[test]
    fn enemy_bullet_death_respawns_player_at_spawn() {
        let mut simulation = active_simulation();
        simulation.tick = SPAWN_SHIELD_TICKS;
        simulation.kill_player(0);
        assert_eq!(simulation.players[0].lives, 2);
        simulation.tick = simulation.players[0].respawn_tick;
        simulation.respawn_players();
        assert!(simulation.players[0].alive);
        assert_eq!(simulation.players[0].position, simulation.config.spawns[0]);
    }

    #[test]
    fn brick_is_destroyed_but_water_still_blocks_tanks() {
        let mut config = open_config();
        config.terrain[4 * 16 + 4] = TERRAIN_BRICK;
        config.terrain[8 * 16 + 8] = TERRAIN_WATER;
        let mut simulation = MatchSimulation::new(config, 8).unwrap();
        assert!(simulation.projectile_hits_terrain(Position { x: 1_000, y: 1_000 }, 0, false));
        assert_eq!(simulation.board_mutations.len(), 1);
        assert!(simulation.terrain_blocks_tank(Position { x: 2_000, y: 2_000 }));
    }

    #[test]
    fn player_input_snaps_cross_axis_on_turn() {
        let mut simulation = active_simulation();
        simulation.players[0].position = Position { x: 543, y: 1_487 };
        simulation.players[0].direction = 1;
        simulation.set_player_input(0, 1, 0, true);
        assert_eq!(simulation.players[0].position.x, 500);
        assert_eq!(simulation.players[0].position.y, 1_487);
        assert_eq!(simulation.players[0].direction, 0);
    }

    #[test]
    fn low_damage_bullet_destroys_front_brick_row() {
        let mut config = open_config();
        config.terrain_width = 20;
        config.terrain_height = 20;
        config.terrain = vec![0; 400];
        for x in 6..10 {
            config.terrain[5 * 20 + x] = TERRAIN_BRICK;
        }
        let mut simulation = MatchSimulation::new(config, 8).unwrap();
        assert!(simulation.projectile_hits_terrain(Position { x: 1_875, y: 1_250 }, 0, false));
        assert_eq!(simulation.board_mutations.len(), 4);
        for x in 6..10 {
            assert_eq!(simulation.terrain[5 * 20 + x], TERRAIN_EMPTY);
        }
    }

    #[test]
    fn authoritative_powerups_change_server_simulation_state() {
        let mut simulation = active_simulation();
        simulation.apply_powerup(0, PowerupKind::Life);
        simulation.apply_powerup(0, PowerupKind::Upgrade);
        simulation.apply_powerup(0, PowerupKind::Speed);
        assert_eq!(simulation.players[0].lives, 4);
        assert_eq!(simulation.players[0].tier, 1);
        assert_eq!(simulation.players[0].speed_until, POWERUP_EFFECT_TICKS);
    }

    #[test]
    fn debug_flag_prevents_enemy_projectile_spawns() {
        let mut config = open_config();
        config.debug_disable_enemy_shooting = true;
        let mut simulation = MatchSimulation::new(config, 9).unwrap();
        simulation.players[0].connected = true;
        simulation.players[1].connected = true;
        simulation.refresh_phase();
        simulation.enemies[0] = EnemyState {
            id: 0,
            position: Position { x: 1_000, y: 500 },
            direction: 2,
            tier: 0,
            health: 1,
            active: true,
            movement_remainder: 0,
            ai_state: EnemyAiState::Moving,
            next_turn_tick: 0,
            next_fire_tick: 0,
            has_drop: false,
        };

        simulation.simulate_enemy(0);

        assert!(simulation.projectiles().is_empty());
        assert!(simulation.enemies[0].position.y > 500);
    }
}
