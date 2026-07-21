use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID;
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;
use magicblock_magic_program_api::{args::ScheduleTaskArgs, instruction::MagicBlockInstruction};

declare_id!("DSZ915qqBHFJHdN8TwLKVsWQxTs3b8J2drwrtm74ktP3");

const TANK_SEED: &[u8] = b"tank";
const MATCH_SEED: &[u8] = b"match";
const MAX_X: i32 = 26_000;
const MAX_Y: i32 = 26_000;
const MAX_STEP: u16 = 1_000;
const MAX_INPUT_BATCH_FRAMES: usize = 16;
const MAX_BATCH_DISTANCE: u32 = 2_000;
const MAX_FIRE_EVENTS_PER_BATCH: usize = 4;
const MAX_FIRE_AGE_MS: u16 = 500;
const MAX_PROJECTILES_PER_PLAYER: usize = 4;
const MAX_PROJECTILE_STEP: i32 = 3_500;
const MAX_PROJECTILE_ORIGIN_DISTANCE: i32 = 2_500;
const PROJECTILE_FIELD_MARGIN: i32 = 2_000;
const MAX_BOARD_MUTATIONS: usize = 256;
const MAX_BOARD_MUTATIONS_PER_BATCH: usize = 16;
const BOARD_CELL_UNITS: u16 = 250;
const TANK_SIZE: i32 = 1_000;
const BASE_WIDTH: i32 = 2_000;
const BASE_HEIGHT: i32 = 1_500;
const MAX_TERRAIN_CELLS_PER_AXIS: usize = 108;
const MAX_TERRAIN_BYTES: usize = (MAX_TERRAIN_CELLS_PER_AXIS * MAX_TERRAIN_CELLS_PER_AXIS + 7) / 8;
const MAX_TERRAIN_CHUNK_BYTES: usize = 512;
const MAX_ENEMY_TOTAL: usize = 20;
const MAX_ACTIVE_ENEMIES: usize = 6;
const ENEMY_SPAWN_COUNT: usize = 3;
const SIMULATION_STEPS_PER_CRANK: usize = 3;
const FIRST_ENEMY_SPAWN_TICK: u64 = 10;
const ENEMY_SPAWN_INTERVAL_TICKS: u64 = 180;
const ENEMY_SPAWN_HOLD_TICKS: u64 = 36;
const ENEMY_SPAWN_RETRY_TICKS: u64 = 30;
const ENEMY_THINK_TICKS: u64 = 18;
const ENEMY_TILE_ALIGNMENT_UNITS: i32 = 500;
const ENEMY_STUCK_FIRE_CHANCE: u8 = 30;
const ENEMY_UNSTUCK_THINK_CHANCE: u8 = 5;
const ENEMY_ROTATE_TOWARDS_BASE_CHANCE: u8 = 30;
const ENEMY_ROTATE_UP_CHANCE: u8 = 10;
const ENEMY_FIRE_DELAY_TICKS: u64 = 90;
const ENEMY_MOVEMENT_REMAINDER_MASK: u8 = 0b0000_0011;
const ENEMY_AI_STATE_SHIFT: u8 = 2;
const CRANK_INTERVAL_MS: i64 = 50;
const CRANK_ITERATIONS: i64 = 36_000;
const ASIA_DEVNET_VALIDATOR: Pubkey = pubkey!("MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57");

#[ephemeral]
#[program]
pub mod tank_movement {
    use super::*;

    pub fn initialize_tank(ctx: Context<InitializeTank>, x: i32, y: i32) -> Result<()> {
        require!((0..=MAX_X).contains(&x), MovementError::OutOfBounds);
        require!((0..=MAX_Y).contains(&y), MovementError::OutOfBounds);
        let tank = &mut ctx.accounts.tank;
        tank.authority = ctx.accounts.authority.key();
        tank.x = x;
        tank.y = y;
        tank.direction = Direction::Up;
        tank.sequence = 0;
        tank.bump = ctx.bumps.tank;
        Ok(())
    }

    pub fn delegate_tank(ctx: Context<DelegateTank>) -> Result<()> {
        let authority = ctx.accounts.authority.key();
        ctx.accounts.delegate_tank(
            &ctx.accounts.authority,
            &[TANK_SEED, authority.as_ref()],
            DelegateConfig {
                validator: Some(ASIA_DEVNET_VALIDATOR),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    pub fn move_tank(
        ctx: Context<MoveTank>,
        direction: Direction,
        distance: u16,
        sequence: u64,
    ) -> Result<()> {
        require!(
            distance > 0 && distance <= MAX_STEP,
            MovementError::InvalidDistance
        );
        let tank = &mut ctx.accounts.tank;
        require_eq!(sequence, tank.sequence + 1, MovementError::InvalidSequence);
        let distance = i32::from(distance);
        let (next_x, next_y) = match direction {
            Direction::Up => (Some(tank.x), tank.y.checked_sub(distance)),
            Direction::Right => (tank.x.checked_add(distance), Some(tank.y)),
            Direction::Down => (Some(tank.x), tank.y.checked_add(distance)),
            Direction::Left => (tank.x.checked_sub(distance), Some(tank.y)),
        };
        let next_x = next_x.ok_or(MovementError::ArithmeticOverflow)?;
        let next_y = next_y.ok_or(MovementError::ArithmeticOverflow)?;
        require!((0..=MAX_X).contains(&next_x), MovementError::OutOfBounds);
        require!((0..=MAX_Y).contains(&next_y), MovementError::OutOfBounds);
        tank.x = next_x;
        tank.y = next_y;
        tank.direction = direction;
        tank.sequence = sequence;
        Ok(())
    }

    pub fn commit_tank(ctx: Context<CommitTank>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[ctx.accounts.tank.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    pub fn undelegate_tank(ctx: Context<CommitTank>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.tank.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    pub fn create_match(
        ctx: Context<CreateMatch>,
        match_id: u64,
        map_id: u16,
        field_width: u16,
        field_height: u16,
        spawns: [Position; 2],
        enemy_spawns: [Position; ENEMY_SPAWN_COUNT],
        enemy_total: u8,
        enemy_speed_classes: [u8; MAX_ENEMY_TOTAL],
        terrain_width: u8,
        terrain_height: u8,
        base_position: Position,
    ) -> Result<()> {
        validate_field(field_width, field_height)?;
        for spawn in spawns {
            validate_position(spawn, field_width, field_height)?;
        }
        for spawn in enemy_spawns {
            validate_position(spawn, field_width, field_height)?;
        }
        require!(
            usize::from(enemy_total) <= MAX_ENEMY_TOTAL,
            MatchError::InvalidEnemyConfig
        );
        require!(
            enemy_speed_classes.iter().all(|speed| *speed <= 1),
            MatchError::InvalidEnemyConfig
        );
        validate_terrain_dimensions(terrain_width, terrain_height, field_width, field_height)?;
        validate_position(base_position, field_width, field_height)?;

        let host = ctx.accounts.authority.key();
        let match_state = &mut ctx.accounts.match_state;
        match_state.match_id = match_id;
        match_state.epoch = 0;
        match_state.host = host;
        match_state.phase = MatchPhase::Waiting;
        match_state.map_id = map_id;
        match_state.field_width = field_width;
        match_state.field_height = field_height;
        match_state.spawns = spawns;
        match_state.players = [
            MatchPlayer::joined(host, spawns[0]),
            MatchPlayer::empty(spawns[1]),
        ];
        match_state.tick = 0;
        match_state.bump = ctx.bumps.match_state;
        match_state.input_receipts = [
            InputBatchReceipt::empty(spawns[0]),
            InputBatchReceipt::empty(spawns[1]),
        ];
        match_state.projectiles = [[ProjectileSnapshot::empty(); MAX_PROJECTILES_PER_PLAYER]; 2];
        match_state.projectile_counts = [0; 2];
        match_state.board_mutations = [BoardMutation::empty(); MAX_BOARD_MUTATIONS];
        match_state.board_mutation_count = 0;
        match_state.enemy_spawns = enemy_spawns;
        match_state.enemy_total = enemy_total;
        match_state.enemy_speed_classes = enemy_speed_classes;
        match_state.enemies = [EnemyState::empty(); MAX_ACTIVE_ENEMIES];
        match_state.enemy_spawn_cursor = 0;
        match_state.simulation_tick = 0;
        match_state.next_enemy_spawn_tick = FIRST_ENEMY_SPAWN_TICK;
        match_state.rng_state = match_id ^ 0x9e37_79b9_7f4a_7c15;
        match_state.last_simulation_slot = 0;
        match_state.terrain_width = terrain_width;
        match_state.terrain_height = terrain_height;
        match_state.terrain_occupancy = [0; MAX_TERRAIN_BYTES];
        match_state.terrain_bytes_written = 0;
        match_state.terrain_initialized = false;
        match_state.base_position = base_position;
        Ok(())
    }

    pub fn initialize_terrain_chunk(
        ctx: Context<ConfigureTerrain>,
        match_id: u64,
        offset: u16,
        bytes: Vec<u8>,
    ) -> Result<()> {
        require!(
            !bytes.is_empty() && bytes.len() <= MAX_TERRAIN_CHUNK_BYTES,
            MatchError::InvalidTerrainChunk
        );
        let state = &mut ctx.accounts.match_state;
        require_eq!(state.match_id, match_id, MatchError::WrongMatch);
        require!(
            state.phase == MatchPhase::Waiting,
            MatchError::MatchAlreadyStarted
        );
        require!(
            !state.terrain_initialized,
            MatchError::TerrainAlreadyInitialized
        );
        require_eq!(
            offset,
            state.terrain_bytes_written,
            MatchError::InvalidTerrainChunk
        );
        let required_bytes = terrain_byte_len(state.terrain_width, state.terrain_height);
        let start = usize::from(offset);
        let end = start
            .checked_add(bytes.len())
            .ok_or(MatchError::ArithmeticOverflow)?;
        require!(end <= required_bytes, MatchError::InvalidTerrainChunk);
        state.terrain_occupancy[start..end].copy_from_slice(&bytes);
        state.terrain_bytes_written = end as u16;
        Ok(())
    }

    pub fn finalize_terrain(ctx: Context<ConfigureTerrain>, match_id: u64) -> Result<()> {
        let state = &mut ctx.accounts.match_state;
        require_eq!(state.match_id, match_id, MatchError::WrongMatch);
        require!(
            state.phase == MatchPhase::Waiting,
            MatchError::MatchAlreadyStarted
        );
        require!(
            !state.terrain_initialized,
            MatchError::TerrainAlreadyInitialized
        );
        require_eq!(
            usize::from(state.terrain_bytes_written),
            terrain_byte_len(state.terrain_width, state.terrain_height),
            MatchError::TerrainIncomplete
        );
        state.terrain_initialized = true;
        Ok(())
    }

    pub fn join_match(ctx: Context<JoinMatch>, match_id: u64) -> Result<()> {
        let match_state = &mut ctx.accounts.match_state;
        require_eq!(match_state.match_id, match_id, MatchError::WrongMatch);
        require!(
            match_state.phase == MatchPhase::Waiting,
            MatchError::MatchAlreadyStarted
        );
        let authority = ctx.accounts.authority.key();
        require!(
            authority != match_state.host,
            MatchError::PlayerAlreadyJoined
        );
        require!(!match_state.players[1].joined, MatchError::MatchFull);
        match_state.players[1] = MatchPlayer::joined(authority, match_state.spawns[1]);
        Ok(())
    }

    pub fn delegate_match(ctx: Context<DelegateMatch>, match_id: u64) -> Result<()> {
        let data = ctx.accounts.match_state.try_borrow_data()?;
        let match_state = MatchState::try_deserialize(&mut data.as_ref())?;
        require_eq!(match_state.match_id, match_id, MatchError::WrongMatch);
        require_keys_eq!(
            match_state.host,
            ctx.accounts.authority.key(),
            MatchError::UnauthorizedHost
        );
        require!(
            match_state.terrain_initialized,
            MatchError::TerrainIncomplete
        );
        require!(match_state.players[1].joined, MatchError::WaitingForPlayer);
        drop(data);

        ctx.accounts.delegate_match_state(
            &ctx.accounts.authority,
            &[MATCH_SEED, &match_id.to_le_bytes()],
            DelegateConfig {
                validator: Some(ASIA_DEVNET_VALIDATOR),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    pub fn start_match(ctx: Context<StartMatch>, match_id: u64) -> Result<()> {
        let match_state = &mut ctx.accounts.match_state;
        require_eq!(match_state.match_id, match_id, MatchError::WrongMatch);
        require!(
            match_state.terrain_initialized,
            MatchError::TerrainIncomplete
        );
        require!(match_state.players[1].joined, MatchError::WaitingForPlayer);
        match_state.epoch = match_state
            .epoch
            .checked_add(1)
            .ok_or(MatchError::ArithmeticOverflow)?;
        match_state.phase = MatchPhase::Active;
        match_state.tick = 0;
        let spawns = match_state.spawns;
        for (player, spawn) in match_state.players.iter_mut().zip(spawns) {
            player.reset(spawn);
        }
        match_state.input_receipts = [
            InputBatchReceipt::empty(spawns[0]),
            InputBatchReceipt::empty(spawns[1]),
        ];
        match_state.projectiles = [[ProjectileSnapshot::empty(); MAX_PROJECTILES_PER_PLAYER]; 2];
        match_state.projectile_counts = [0; 2];
        match_state.board_mutations = [BoardMutation::empty(); MAX_BOARD_MUTATIONS];
        match_state.board_mutation_count = 0;
        match_state.enemies = [EnemyState::empty(); MAX_ACTIVE_ENEMIES];
        match_state.enemy_spawn_cursor = 0;
        match_state.simulation_tick = 0;
        match_state.next_enemy_spawn_tick = FIRST_ENEMY_SPAWN_TICK;
        match_state.rng_state = match_id ^ match_state.epoch ^ 0x9e37_79b9_7f4a_7c15;
        match_state.last_simulation_slot = 0;
        Ok(())
    }

    pub fn schedule_match_crank(
        ctx: Context<ScheduleMatchCrank>,
        match_id: u64,
        epoch: u64,
    ) -> Result<()> {
        let data = ctx.accounts.match_state.try_borrow_data()?;
        let state = MatchState::try_deserialize(&mut data.as_ref())?;
        require_eq!(state.match_id, match_id, MatchError::WrongMatch);
        require_eq!(state.epoch, epoch, MatchError::StaleEpoch);
        require_keys_eq!(
            state.host,
            ctx.accounts.payer.key(),
            MatchError::UnauthorizedHost
        );
        require!(
            state.phase == MatchPhase::Active,
            MatchError::MatchNotActive
        );
        drop(data);

        let crank_ix = Instruction {
            program_id: crate::ID,
            accounts: vec![AccountMeta::new(ctx.accounts.match_state.key(), false)],
            data: anchor_lang::InstructionData::data(&crate::instruction::TickSimulation {
                match_id,
                epoch,
            }),
        };
        let task_id = ((match_id.rotate_left(17) ^ epoch) & i64::MAX as u64) as i64;
        let ix_data = bincode::serialize(&MagicBlockInstruction::ScheduleTask(ScheduleTaskArgs {
            task_id,
            execution_interval_millis: CRANK_INTERVAL_MS,
            iterations: CRANK_ITERATIONS,
            instructions: vec![crank_ix],
        }))
        .map_err(|_| ProgramError::InvalidArgument)?;
        let schedule_ix = Instruction::new_with_bytes(
            MAGIC_PROGRAM_ID,
            &ix_data,
            vec![
                AccountMeta::new(ctx.accounts.payer.key(), true),
                AccountMeta::new(ctx.accounts.match_state.key(), false),
            ],
        );
        invoke(
            &schedule_ix,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.match_state.to_account_info(),
                ctx.accounts.magic_program.to_account_info(),
            ],
        )?;
        Ok(())
    }

    pub fn tick_simulation(ctx: Context<TickSimulation>, match_id: u64, epoch: u64) -> Result<()> {
        let state = &mut ctx.accounts.match_state;
        require_eq!(state.match_id, match_id, MatchError::WrongMatch);
        require_eq!(state.epoch, epoch, MatchError::StaleEpoch);
        if state.phase != MatchPhase::Active {
            return Ok(());
        }
        let slot = Clock::get()?.slot;
        if slot <= state.last_simulation_slot {
            return Ok(());
        }
        state.last_simulation_slot = slot;
        for _ in 0..SIMULATION_STEPS_PER_CRANK {
            simulate_enemy_step(state)?;
        }
        Ok(())
    }

    pub fn submit_input(
        ctx: Context<SubmitInput>,
        match_id: u64,
        epoch: u64,
        direction: Direction,
        distance: u16,
        sequence: u64,
    ) -> Result<()> {
        require!(
            distance > 0 && distance <= MAX_STEP,
            MovementError::InvalidDistance
        );
        let match_state = &mut ctx.accounts.match_state;
        require_eq!(match_state.match_id, match_id, MatchError::WrongMatch);
        require_eq!(match_state.epoch, epoch, MatchError::StaleEpoch);
        require!(
            match_state.phase == MatchPhase::Active,
            MatchError::MatchNotActive
        );

        let authority = ctx.accounts.authority.key();
        let player_index = match_state
            .players
            .iter()
            .position(|player| player.joined && player.authority == authority)
            .ok_or(MatchError::UnauthorizedPlayer)?;
        let player_position = Position {
            x: match_state.players[player_index].x,
            y: match_state.players[player_index].y,
        };
        let expected_sequence = match_state.players[player_index]
            .sequence
            .checked_add(1)
            .ok_or(MatchError::ArithmeticOverflow)?;
        require_eq!(sequence, expected_sequence, MovementError::InvalidSequence);
        let next = apply_movement(
            player_position,
            direction,
            distance,
            match_state.field_width,
            match_state.field_height,
        )?;
        require!(
            !terrain_blocks_tank(match_state, next),
            MovementError::TerrainCollision
        );
        require!(
            !base_blocks_tank(match_state, next),
            MovementError::TankCollision
        );
        let other_player = &match_state.players[1 - player_index];
        require!(
            !other_player.joined
                || !positions_overlap(
                    next,
                    Position {
                        x: other_player.x,
                        y: other_player.y,
                    },
                ),
            MovementError::TankCollision
        );
        require!(
            !any_enemy_blocks_tank(match_state, next, None),
            MovementError::TankCollision
        );
        let player = &mut match_state.players[player_index];
        player.x = next.x;
        player.y = next.y;
        player.direction = direction;
        player.sequence = sequence;
        match_state.input_receipts[player_index].record(
            sequence,
            player_position,
            &[InputFrame {
                direction,
                distance,
                fire: false,
                fire_age_ms: 0,
            }],
        );
        match_state.tick = match_state
            .tick
            .checked_add(1)
            .ok_or(MatchError::ArithmeticOverflow)?;
        Ok(())
    }

    pub fn submit_input_batch(
        ctx: Context<SubmitInput>,
        match_id: u64,
        epoch: u64,
        frames: Vec<InputFrame>,
        projectiles: Vec<ProjectileSnapshot>,
        board_mutations: Vec<BoardMutation>,
        sequence: u64,
    ) -> Result<()> {
        require!(
            !frames.is_empty() && frames.len() <= MAX_INPUT_BATCH_FRAMES,
            MovementError::InvalidBatch
        );
        let total_distance = frames.iter().try_fold(0_u32, |total, frame| {
            require!(frame.distance <= MAX_STEP, MovementError::InvalidDistance);
            total
                .checked_add(u32::from(frame.distance))
                .ok_or(MatchError::ArithmeticOverflow.into())
        })?;
        require!(
            total_distance <= MAX_BATCH_DISTANCE,
            MovementError::InvalidBatch
        );
        require!(
            frames.iter().filter(|frame| frame.fire).count() <= MAX_FIRE_EVENTS_PER_BATCH,
            MovementError::InvalidBatch
        );
        require!(
            frames.iter().all(|frame| {
                if frame.fire {
                    frame.fire_age_ms <= MAX_FIRE_AGE_MS
                } else {
                    frame.fire_age_ms == 0
                }
            }),
            MovementError::InvalidBatch
        );
        require!(
            projectiles.len() <= MAX_PROJECTILES_PER_PLAYER,
            MovementError::InvalidProjectiles
        );
        require!(
            board_mutations.len() <= MAX_BOARD_MUTATIONS_PER_BATCH,
            MovementError::InvalidBoardMutation
        );

        let match_state = &mut ctx.accounts.match_state;
        require_eq!(match_state.match_id, match_id, MatchError::WrongMatch);
        require_eq!(match_state.epoch, epoch, MatchError::StaleEpoch);
        require!(
            match_state.phase == MatchPhase::Active,
            MatchError::MatchNotActive
        );

        let authority = ctx.accounts.authority.key();
        let player_index = match_state
            .players
            .iter()
            .position(|player| player.joined && player.authority == authority)
            .ok_or(MatchError::UnauthorizedPlayer)?;
        let expected_sequence = match_state.players[player_index]
            .sequence
            .checked_add(1)
            .ok_or(MatchError::ArithmeticOverflow)?;
        require_eq!(sequence, expected_sequence, MovementError::InvalidSequence);

        validate_board_mutations(
            &board_mutations,
            match_state.terrain_width,
            match_state.terrain_height,
        )?;
        for mutation in &board_mutations {
            clear_terrain_cell(match_state, mutation.x, mutation.y);
        }

        let start = Position {
            x: match_state.players[player_index].x,
            y: match_state.players[player_index].y,
        };
        let other_player = match_state.players[1 - player_index];
        let mut position = start;
        let mut direction = match_state.players[player_index].direction;
        for frame in &frames {
            direction = frame.direction;
            if frame.distance == 0 {
                continue;
            }
            position = apply_movement(
                position,
                frame.direction,
                frame.distance,
                match_state.field_width,
                match_state.field_height,
            )?;
            require!(
                !terrain_blocks_tank(match_state, position),
                MovementError::TerrainCollision
            );
            require!(
                !base_blocks_tank(match_state, position),
                MovementError::TankCollision
            );
            require!(
                !other_player.joined
                    || !positions_overlap(
                        position,
                        Position {
                            x: other_player.x,
                            y: other_player.y,
                    },
                ),
                MovementError::TankCollision
            );
            require!(
                !any_enemy_blocks_tank(match_state, position, None),
                MovementError::TankCollision
            );
        }

        validate_projectiles(
            &projectiles,
            &match_state.projectiles[player_index]
                [..usize::from(match_state.projectile_counts[player_index])],
            position,
            match_state.field_width,
            match_state.field_height,
        )?;

        let player = &mut match_state.players[player_index];
        player.x = position.x;
        player.y = position.y;
        player.direction = direction;
        player.sequence = sequence;
        match_state.input_receipts[player_index].record(sequence, start, &frames);
        match_state.projectiles[player_index] =
            [ProjectileSnapshot::empty(); MAX_PROJECTILES_PER_PLAYER];
        for (target, projectile) in match_state.projectiles[player_index]
            .iter_mut()
            .zip(projectiles.iter().copied())
        {
            *target = projectile;
        }
        match_state.projectile_counts[player_index] = projectiles.len() as u8;
        for mutation in board_mutations {
            let count = usize::from(match_state.board_mutation_count);
            if match_state.board_mutations[..count].contains(&mutation) {
                continue;
            }
            require!(
                count < MAX_BOARD_MUTATIONS,
                MovementError::BoardMutationLimit
            );
            match_state.board_mutations[count] = mutation;
            match_state.board_mutation_count += 1;
        }
        match_state.tick = match_state
            .tick
            .checked_add(1)
            .ok_or(MatchError::ArithmeticOverflow)?;
        Ok(())
    }

    pub fn respawn_player(ctx: Context<SubmitInput>, match_id: u64, epoch: u64) -> Result<()> {
        let match_state = &mut ctx.accounts.match_state;
        require_eq!(match_state.match_id, match_id, MatchError::WrongMatch);
        require_eq!(match_state.epoch, epoch, MatchError::StaleEpoch);
        require!(
            match_state.phase == MatchPhase::Active,
            MatchError::MatchNotActive
        );

        let authority = ctx.accounts.authority.key();
        let player_index = match_state
            .players
            .iter()
            .position(|player| player.joined && player.authority == authority)
            .ok_or(MatchError::UnauthorizedPlayer)?;
        let next_sequence = match_state.players[player_index]
            .sequence
            .checked_add(2)
            .ok_or(MatchError::ArithmeticOverflow)?;
        let spawn = match_state.spawns[player_index];
        let player = &mut match_state.players[player_index];
        player.x = spawn.x;
        player.y = spawn.y;
        player.direction = Direction::Up;
        player.sequence = next_sequence;
        match_state.input_receipts[player_index].record(next_sequence, spawn, &[]);
        match_state.projectiles[player_index] =
            [ProjectileSnapshot::empty(); MAX_PROJECTILES_PER_PLAYER];
        match_state.projectile_counts[player_index] = 0;
        match_state.tick = match_state
            .tick
            .checked_add(1)
            .ok_or(MatchError::ArithmeticOverflow)?;
        Ok(())
    }

    pub fn commit_match(ctx: Context<CommitMatch>, _match_id: u64) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[ctx.accounts.match_state.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    pub fn undelegate_match(ctx: Context<CommitMatch>, _match_id: u64) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.match_state.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub enum Direction {
    Up,
    Right,
    Down,
    Left,
}

#[account]
#[derive(InitSpace)]
pub struct TankState {
    pub authority: Pubkey,
    pub x: i32,
    pub y: i32,
    pub direction: Direction,
    pub sequence: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub struct Position {
    pub x: i32,
    pub y: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub struct InputFrame {
    pub direction: Direction,
    pub distance: u16,
    pub fire: bool,
    pub fire_age_ms: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub struct ProjectileSnapshot {
    pub id: u16,
    pub x: i32,
    pub y: i32,
    pub direction: Direction,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub struct BoardMutation {
    pub x: u8,
    pub y: u8,
}

impl BoardMutation {
    const fn empty() -> Self {
        Self { x: 0, y: 0 }
    }
}

impl ProjectileSnapshot {
    const fn empty() -> Self {
        Self {
            id: 0,
            x: 0,
            y: 0,
            direction: Direction::Up,
        }
    }
}

impl InputFrame {
    const fn idle() -> Self {
        Self {
            direction: Direction::Up,
            distance: 0,
            fire: false,
            fire_age_ms: 0,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub struct InputBatchReceipt {
    pub batch_sequence: u64,
    pub start: Position,
    pub frames: [InputFrame; MAX_INPUT_BATCH_FRAMES],
    pub len: u8,
}

impl InputBatchReceipt {
    fn empty(start: Position) -> Self {
        Self {
            batch_sequence: 0,
            start,
            frames: [InputFrame::idle(); MAX_INPUT_BATCH_FRAMES],
            len: 0,
        }
    }

    fn record(&mut self, batch_sequence: u64, start: Position, frames: &[InputFrame]) {
        self.batch_sequence = batch_sequence;
        self.start = start;
        self.frames = [InputFrame::idle(); MAX_INPUT_BATCH_FRAMES];
        for (target, frame) in self.frames.iter_mut().zip(frames.iter().copied()) {
            *target = frame;
        }
        self.len = frames.len() as u8;
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum MatchPhase {
    Waiting,
    Active,
    Finished,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub struct MatchPlayer {
    pub authority: Pubkey,
    pub x: i32,
    pub y: i32,
    pub direction: Direction,
    pub sequence: u64,
    pub joined: bool,
}

impl MatchPlayer {
    fn empty(spawn: Position) -> Self {
        Self {
            authority: Pubkey::default(),
            x: spawn.x,
            y: spawn.y,
            direction: Direction::Up,
            sequence: 0,
            joined: false,
        }
    }

    fn joined(authority: Pubkey, spawn: Position) -> Self {
        Self {
            authority,
            joined: true,
            ..Self::empty(spawn)
        }
    }

    fn reset(&mut self, spawn: Position) {
        self.x = spawn.x;
        self.y = spawn.y;
        self.direction = Direction::Up;
        self.sequence = 0;
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub struct EnemyState {
    pub id: u16,
    pub x: i32,
    pub y: i32,
    pub direction: Direction,
    pub active: bool,
    pub movement_remainder: u8,
    pub next_turn_tick: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum EnemyAiState {
    Moving = 0,
    Thinking = 1,
    UnstuckThinking = 2,
    Firing = 3,
}

impl EnemyState {
    const fn empty() -> Self {
        Self {
            id: 0,
            x: 0,
            y: 0,
            direction: Direction::Down,
            active: false,
            movement_remainder: 0,
            next_turn_tick: 0,
        }
    }
}

#[account]
#[derive(InitSpace)]
pub struct MatchState {
    pub match_id: u64,
    pub epoch: u64,
    pub host: Pubkey,
    pub phase: MatchPhase,
    pub map_id: u16,
    pub field_width: u16,
    pub field_height: u16,
    pub spawns: [Position; 2],
    pub players: [MatchPlayer; 2],
    pub tick: u64,
    pub bump: u8,
    pub input_receipts: [InputBatchReceipt; 2],
    pub projectiles: [[ProjectileSnapshot; MAX_PROJECTILES_PER_PLAYER]; 2],
    pub projectile_counts: [u8; 2],
    pub board_mutations: [BoardMutation; MAX_BOARD_MUTATIONS],
    pub board_mutation_count: u16,
    pub enemy_spawns: [Position; ENEMY_SPAWN_COUNT],
    pub enemy_total: u8,
    pub enemy_speed_classes: [u8; MAX_ENEMY_TOTAL],
    pub enemies: [EnemyState; MAX_ACTIVE_ENEMIES],
    pub enemy_spawn_cursor: u8,
    pub simulation_tick: u64,
    pub next_enemy_spawn_tick: u64,
    pub rng_state: u64,
    pub last_simulation_slot: u64,
    pub terrain_width: u8,
    pub terrain_height: u8,
    pub terrain_occupancy: [u8; MAX_TERRAIN_BYTES],
    pub terrain_bytes_written: u16,
    pub terrain_initialized: bool,
    pub base_position: Position,
}

#[derive(Accounts)]
pub struct InitializeTank<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + TankState::INIT_SPACE, seeds = [TANK_SEED, authority.key().as_ref()], bump)]
    pub tank: Account<'info, TankState>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateTank<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: The delegation program validates the PDA and changes its owner.
    #[account(mut, del, seeds = [TANK_SEED, authority.key().as_ref()], bump)]
    pub tank: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct MoveTank<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [TANK_SEED, authority.key().as_ref()], bump = tank.bump, has_one = authority)]
    pub tank: Account<'info, TankState>,
}

#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct CreateMatch<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + MatchState::INIT_SPACE,
        seeds = [MATCH_SEED, &match_id.to_le_bytes()],
        bump
    )]
    pub match_state: Box<Account<'info, MatchState>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct JoinMatch<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [MATCH_SEED, &match_id.to_le_bytes()], bump = match_state.bump)]
    pub match_state: Box<Account<'info, MatchState>>,
}

#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct ConfigureTerrain<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [MATCH_SEED, &match_id.to_le_bytes()],
        bump = match_state.bump,
        constraint = match_state.host == authority.key() @ MatchError::UnauthorizedHost
    )]
    pub match_state: Box<Account<'info, MatchState>>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct DelegateMatch<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: The delegation program validates the PDA and changes its owner.
    #[account(
        mut,
        del,
        seeds = [MATCH_SEED, &match_id.to_le_bytes()],
        bump
    )]
    pub match_state: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct StartMatch<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [MATCH_SEED, &match_id.to_le_bytes()],
        bump = match_state.bump,
        constraint = match_state.host == authority.key() @ MatchError::UnauthorizedHost
    )]
    pub match_state: Box<Account<'info, MatchState>>,
}

#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct SubmitInput<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [MATCH_SEED, &match_id.to_le_bytes()], bump = match_state.bump)]
    pub match_state: Box<Account<'info, MatchState>>,
}

#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct ScheduleMatchCrank<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Read as MatchState before the scheduling CPI. AccountInfo avoids
    /// serializing a stale copy over a crank update that lands immediately.
    #[account(mut, seeds = [MATCH_SEED, &match_id.to_le_bytes()], bump)]
    pub match_state: AccountInfo<'info>,
    /// CHECK: Constrained to MagicBlock's scheduling program.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct TickSimulation<'info> {
    #[account(mut, seeds = [MATCH_SEED, &match_id.to_le_bytes()], bump = match_state.bump)]
    pub match_state: Box<Account<'info, MatchState>>,
}

#[commit]
#[derive(Accounts)]
pub struct CommitTank<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [TANK_SEED, authority.key().as_ref()], bump = tank.bump, has_one = authority)]
    pub tank: Account<'info, TankState>,
}

#[commit]
#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct CommitMatch<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [MATCH_SEED, &match_id.to_le_bytes()],
        bump = match_state.bump,
        constraint = match_state.host == authority.key() @ MatchError::UnauthorizedHost
    )]
    pub match_state: Box<Account<'info, MatchState>>,
}

fn validate_field(field_width: u16, field_height: u16) -> Result<()> {
    require!(
        field_width > 0 && i32::from(field_width) <= MAX_X,
        MatchError::InvalidField
    );
    require!(
        field_height > 0 && i32::from(field_height) <= MAX_Y,
        MatchError::InvalidField
    );
    Ok(())
}

fn validate_terrain_dimensions(
    terrain_width: u8,
    terrain_height: u8,
    field_width: u16,
    field_height: u16,
) -> Result<()> {
    let expected_width =
        (usize::from(field_width) + TANK_SIZE as usize).div_ceil(usize::from(BOARD_CELL_UNITS));
    let expected_height =
        (usize::from(field_height) + TANK_SIZE as usize).div_ceil(usize::from(BOARD_CELL_UNITS));
    require!(
        usize::from(terrain_width) == expected_width
            && usize::from(terrain_height) == expected_height
            && expected_width <= MAX_TERRAIN_CELLS_PER_AXIS
            && expected_height <= MAX_TERRAIN_CELLS_PER_AXIS,
        MatchError::InvalidTerrainDimensions
    );
    Ok(())
}

fn terrain_byte_len(width: u8, height: u8) -> usize {
    (usize::from(width) * usize::from(height)).div_ceil(8)
}

fn validate_position(position: Position, field_width: u16, field_height: u16) -> Result<()> {
    require!(
        (0..=i32::from(field_width)).contains(&position.x)
            && (0..=i32::from(field_height)).contains(&position.y),
        MovementError::OutOfBounds
    );
    Ok(())
}

fn apply_movement(
    position: Position,
    direction: Direction,
    distance: u16,
    field_width: u16,
    field_height: u16,
) -> Result<Position> {
    let distance = i32::from(distance);
    let next = match direction {
        Direction::Up => Position {
            x: position.x,
            y: position
                .y
                .checked_sub(distance)
                .ok_or(MatchError::ArithmeticOverflow)?,
        },
        Direction::Right => Position {
            x: position
                .x
                .checked_add(distance)
                .ok_or(MatchError::ArithmeticOverflow)?,
            y: position.y,
        },
        Direction::Down => Position {
            x: position.x,
            y: position
                .y
                .checked_add(distance)
                .ok_or(MatchError::ArithmeticOverflow)?,
        },
        Direction::Left => Position {
            x: position
                .x
                .checked_sub(distance)
                .ok_or(MatchError::ArithmeticOverflow)?,
            y: position.y,
        },
    };
    validate_position(next, field_width, field_height)?;
    Ok(next)
}

fn positions_overlap(first: Position, second: Position) -> bool {
    (first.x - second.x).abs() < TANK_SIZE && (first.y - second.y).abs() < TANK_SIZE
}

fn base_blocks_tank(state: &MatchState, position: Position) -> bool {
    rects_overlap(
        position,
        TANK_SIZE,
        TANK_SIZE,
        state.base_position,
        BASE_WIDTH,
        BASE_HEIGHT,
    )
}

fn any_player_blocks_tank(
    state: &MatchState,
    position: Position,
    ignored_player_index: Option<usize>,
) -> bool {
    state.players.iter().enumerate().any(|(index, player)| {
        Some(index) != ignored_player_index
            && player.joined
            && positions_overlap(
                position,
                Position {
                    x: player.x,
                    y: player.y,
                },
            )
    })
}

fn any_enemy_blocks_tank(
    state: &MatchState,
    position: Position,
    ignored_enemy_index: Option<usize>,
) -> bool {
    state.enemies.iter().enumerate().any(|(index, enemy)| {
        Some(index) != ignored_enemy_index
            && enemy.active
            && positions_overlap(
                position,
                Position {
                    x: enemy.x,
                    y: enemy.y,
                },
            )
    })
}

fn rects_overlap(
    first: Position,
    first_width: i32,
    first_height: i32,
    second: Position,
    second_width: i32,
    second_height: i32,
) -> bool {
    first.x < second.x + second_width
        && first.x + first_width > second.x
        && first.y < second.y + second_height
        && first.y + first_height > second.y
}

fn enemy_spawn_position_blocked(state: &MatchState, position: Position) -> bool {
    terrain_blocks_tank(state, position)
        || base_blocks_tank(state, position)
        || any_player_blocks_tank(state, position, None)
        || any_enemy_blocks_tank(state, position, None)
}

fn terrain_blocks_tank(state: &MatchState, position: Position) -> bool {
    if !state.terrain_initialized || position.x < 0 || position.y < 0 {
        return true;
    }
    let cell_units = i32::from(BOARD_CELL_UNITS);
    let min_x = position.x / cell_units;
    let min_y = position.y / cell_units;
    let max_x = (position.x + TANK_SIZE - 1) / cell_units;
    let max_y = (position.y + TANK_SIZE - 1) / cell_units;
    for y in min_y..=max_y {
        for x in min_x..=max_x {
            if terrain_cell_occupied(state, x as usize, y as usize) {
                return true;
            }
        }
    }
    false
}

fn terrain_cell_occupied(state: &MatchState, x: usize, y: usize) -> bool {
    let width = usize::from(state.terrain_width);
    if x >= width || y >= usize::from(state.terrain_height) {
        return true;
    }
    let bit_index = y * width + x;
    state.terrain_occupancy[bit_index / 8] & (1 << (bit_index % 8)) != 0
}

fn clear_terrain_cell(state: &mut MatchState, x: u8, y: u8) {
    let width = usize::from(state.terrain_width);
    let x = usize::from(x);
    let y = usize::from(y);
    if x >= width || y >= usize::from(state.terrain_height) {
        return;
    }
    let bit_index = y * width + x;
    state.terrain_occupancy[bit_index / 8] &= !(1 << (bit_index % 8));
}

fn simulate_enemy_step(state: &mut MatchState) -> Result<()> {
    state.simulation_tick = state
        .simulation_tick
        .checked_add(1)
        .ok_or(MatchError::ArithmeticOverflow)?;

    if state.simulation_tick >= state.next_enemy_spawn_tick
        && usize::from(state.enemy_spawn_cursor) < usize::from(state.enemy_total)
    {
        if let Some(slot) = state.enemies.iter().position(|enemy| !enemy.active) {
            let id = state.enemy_spawn_cursor;
            let spawn = state.enemy_spawns[usize::from(id) % ENEMY_SPAWN_COUNT];
            if enemy_spawn_position_blocked(state, spawn) {
                state.next_enemy_spawn_tick = state
                    .simulation_tick
                    .checked_add(ENEMY_SPAWN_RETRY_TICKS)
                    .ok_or(MatchError::ArithmeticOverflow)?;
            } else {
                let mut enemy = EnemyState {
                    id: u16::from(id),
                    x: spawn.x,
                    y: spawn.y,
                    direction: Direction::Down,
                    active: true,
                    movement_remainder: 0,
                    next_turn_tick: state
                        .simulation_tick
                        .checked_add(ENEMY_SPAWN_HOLD_TICKS)
                        .ok_or(MatchError::ArithmeticOverflow)?,
                };
                set_enemy_ai_state(&mut enemy, EnemyAiState::Thinking);
                state.enemies[slot] = enemy;
                state.enemy_spawn_cursor = state
                    .enemy_spawn_cursor
                    .checked_add(1)
                    .ok_or(MatchError::ArithmeticOverflow)?;
                state.next_enemy_spawn_tick = state
                    .simulation_tick
                    .checked_add(ENEMY_SPAWN_INTERVAL_TICKS)
                    .ok_or(MatchError::ArithmeticOverflow)?;
            }
        } else {
            state.next_enemy_spawn_tick = state
                .simulation_tick
                .checked_add(ENEMY_SPAWN_RETRY_TICKS)
                .ok_or(MatchError::ArithmeticOverflow)?;
        }
    }

    for index in 0..MAX_ACTIVE_ENEMIES {
        let mut enemy = state.enemies[index];
        if !enemy.active {
            continue;
        }

        let ai_state = enemy_ai_state(enemy.movement_remainder);
        if ai_state != EnemyAiState::Moving {
            if state.simulation_tick < enemy.next_turn_tick {
                continue;
            }
            if ai_state == EnemyAiState::Thinking
                && random_probability(state, ENEMY_STUCK_FIRE_CHANCE)
            {
                set_enemy_ai_state(&mut enemy, EnemyAiState::Firing);
                enemy.next_turn_tick =
                    state.simulation_tick + next_random(state) % ENEMY_FIRE_DELAY_TICKS;
                state.enemies[index] = enemy;
                continue;
            }
            if ai_state == EnemyAiState::Firing {
                set_enemy_ai_state(&mut enemy, EnemyAiState::Moving);
                state.enemies[index] = enemy;
                continue;
            }
            enemy.direction = next_enemy_direction(state, enemy);
            set_enemy_ai_state(&mut enemy, EnemyAiState::Moving);
            state.enemies[index] = enemy;
            continue;
        }

        let speed_class = state.enemy_speed_classes[usize::from(enemy.id)];
        let (base_distance, remainder_increment) = if speed_class == 1 {
            (62_u16, 2_u8)
        } else {
            (31_u16, 1_u8)
        };
        let accumulated = enemy_movement_remainder(enemy.movement_remainder) + remainder_increment;
        let distance = base_distance + u16::from(accumulated / 4);
        set_enemy_movement_remainder(&mut enemy, accumulated % 4);
        let current = Position {
            x: enemy.x,
            y: enemy.y,
        };
        let candidate = apply_movement(
            current,
            enemy.direction,
            distance,
            state.field_width,
            state.field_height,
        );
        let blocked = match candidate {
            Ok(next) => {
                terrain_blocks_tank(state, next)
                    || base_blocks_tank(state, next)
                    || any_player_blocks_tank(state, next, None)
                    || any_enemy_blocks_tank(state, next, Some(index))
            }
            Err(_) => true,
        };
        if blocked {
            set_enemy_ai_state(&mut enemy, EnemyAiState::Thinking);
            enemy.next_turn_tick = state.simulation_tick + ENEMY_THINK_TICKS;
        } else if let Ok(next) = candidate {
            enemy.x = next.x;
            enemy.y = next.y;
            if should_enemy_think_when_unstuck(state, enemy) {
                set_enemy_ai_state(&mut enemy, EnemyAiState::UnstuckThinking);
                enemy.next_turn_tick = state.simulation_tick + ENEMY_THINK_TICKS;
            }
        }
        state.enemies[index] = enemy;
    }
    Ok(())
}

fn next_random(state: &mut MatchState) -> u64 {
    let mut value = state.rng_state;
    value ^= value << 13;
    value ^= value >> 7;
    value ^= value << 17;
    if value == 0 {
        value = 0x2545_f491_4f6c_dd1d;
    }
    state.rng_state = value;
    value
}

fn random_probability(state: &mut MatchState, chance_percent: u8) -> bool {
    1 + next_random(state) % 99 <= u64::from(chance_percent)
}

fn enemy_ai_state(value: u8) -> EnemyAiState {
    match value >> ENEMY_AI_STATE_SHIFT {
        1 => EnemyAiState::Thinking,
        2 => EnemyAiState::UnstuckThinking,
        3 => EnemyAiState::Firing,
        _ => EnemyAiState::Moving,
    }
}

fn set_enemy_ai_state(enemy: &mut EnemyState, state: EnemyAiState) {
    enemy.movement_remainder = enemy_movement_remainder(enemy.movement_remainder)
        | ((state as u8) << ENEMY_AI_STATE_SHIFT);
}

fn enemy_movement_remainder(value: u8) -> u8 {
    value & ENEMY_MOVEMENT_REMAINDER_MASK
}

fn set_enemy_movement_remainder(enemy: &mut EnemyState, remainder: u8) {
    enemy.movement_remainder = (enemy.movement_remainder & !ENEMY_MOVEMENT_REMAINDER_MASK)
        | (remainder & ENEMY_MOVEMENT_REMAINDER_MASK);
}

fn should_enemy_think_when_unstuck(state: &mut MatchState, enemy: EnemyState) -> bool {
    if !random_probability(state, ENEMY_UNSTUCK_THINK_CHANCE) {
        return false;
    }
    match enemy.direction {
        Direction::Up | Direction::Down => enemy.y % ENEMY_TILE_ALIGNMENT_UNITS == 0,
        Direction::Left | Direction::Right => enemy.x % ENEMY_TILE_ALIGNMENT_UNITS == 0,
    }
}

fn next_enemy_direction(state: &mut MatchState, enemy: EnemyState) -> Direction {
    if random_probability(state, ENEMY_ROTATE_TOWARDS_BASE_CHANCE) {
        let dx = state.base_position.x - enemy.x;
        let dy = state.base_position.y - enemy.y;
        if dx.abs() >= dy.abs() {
            if dx > 0 {
                return Direction::Right;
            }
            if dx < 0 {
                return Direction::Left;
            }
        }
        return Direction::Down;
    }
    if random_probability(state, ENEMY_ROTATE_UP_CHANCE) {
        return Direction::Up;
    }
    match next_random(state) % 3 {
        0 => Direction::Down,
        1 => Direction::Left,
        _ => Direction::Right,
    }
}

fn validate_projectiles(
    projectiles: &[ProjectileSnapshot],
    previous: &[ProjectileSnapshot],
    player: Position,
    field_width: u16,
    field_height: u16,
) -> Result<()> {
    for (index, projectile) in projectiles.iter().enumerate() {
        require!(
            !projectiles[..index]
                .iter()
                .any(|other| other.id == projectile.id),
            MovementError::InvalidProjectiles
        );
        require!(
            (-PROJECTILE_FIELD_MARGIN..=i32::from(field_width) + PROJECTILE_FIELD_MARGIN)
                .contains(&projectile.x)
                && (-PROJECTILE_FIELD_MARGIN..=i32::from(field_height) + PROJECTILE_FIELD_MARGIN)
                    .contains(&projectile.y),
            MovementError::InvalidProjectiles
        );

        if let Some(old) = previous.iter().find(|old| old.id == projectile.id) {
            require!(
                old.direction == projectile.direction,
                MovementError::InvalidProjectiles
            );
            let dx = projectile.x - old.x;
            let dy = projectile.y - old.y;
            let forward = match projectile.direction {
                Direction::Up => dx == 0 && dy <= 0 && -dy <= MAX_PROJECTILE_STEP,
                Direction::Right => dy == 0 && dx >= 0 && dx <= MAX_PROJECTILE_STEP,
                Direction::Down => dx == 0 && dy >= 0 && dy <= MAX_PROJECTILE_STEP,
                Direction::Left => dy == 0 && dx <= 0 && -dx <= MAX_PROJECTILE_STEP,
            };
            require!(forward, MovementError::InvalidProjectiles);
        } else {
            require!(
                (projectile.x - player.x).abs() <= MAX_PROJECTILE_ORIGIN_DISTANCE
                    && (projectile.y - player.y).abs() <= MAX_PROJECTILE_ORIGIN_DISTANCE,
                MovementError::InvalidProjectiles
            );
        }
    }
    Ok(())
}

fn validate_board_mutations(
    mutations: &[BoardMutation],
    terrain_width: u8,
    terrain_height: u8,
) -> Result<()> {
    require!(
        mutations
            .iter()
            .all(|mutation| { mutation.x < terrain_width && mutation.y < terrain_height }),
        MovementError::InvalidBoardMutation
    );
    Ok(())
}

#[error_code]
pub enum MovementError {
    #[msg("Movement would leave the map bounds")]
    OutOfBounds,
    #[msg("Distance must be between 1 and 1000 units")]
    InvalidDistance,
    #[msg("Movement sequence must increase by exactly one")]
    InvalidSequence,
    #[msg("Input batch exceeds the frame or distance limit")]
    InvalidBatch,
    #[msg("Movement would collide with the other tank")]
    TankCollision,
    #[msg("Coordinate arithmetic overflowed")]
    ArithmeticOverflow,
    #[msg("Projectile snapshot is invalid")]
    InvalidProjectiles,
    #[msg("Board mutation is outside the map")]
    InvalidBoardMutation,
    #[msg("The board mutation journal is full")]
    BoardMutationLimit,
    #[msg("Movement would collide with authoritative terrain")]
    TerrainCollision,
}

#[error_code]
pub enum MatchError {
    #[msg("Match ID does not match the account")]
    WrongMatch,
    #[msg("Only the match host may perform this action")]
    UnauthorizedHost,
    #[msg("The signer is not a player in this match")]
    UnauthorizedPlayer,
    #[msg("The match already has two players")]
    MatchFull,
    #[msg("This player has already joined")]
    PlayerAlreadyJoined,
    #[msg("The second player has not joined yet")]
    WaitingForPlayer,
    #[msg("The match has already started")]
    MatchAlreadyStarted,
    #[msg("The match is not active")]
    MatchNotActive,
    #[msg("The client is submitting input for a stale match epoch")]
    StaleEpoch,
    #[msg("Field dimensions are invalid")]
    InvalidField,
    #[msg("Match arithmetic overflowed")]
    ArithmeticOverflow,
    #[msg("Enemy simulation configuration is invalid")]
    InvalidEnemyConfig,
    #[msg("Terrain grid dimensions do not match the field")]
    InvalidTerrainDimensions,
    #[msg("Terrain data must be uploaded in bounded sequential chunks")]
    InvalidTerrainChunk,
    #[msg("Terrain data has already been finalized")]
    TerrainAlreadyInitialized,
    #[msg("Terrain data has not been completely uploaded")]
    TerrainIncomplete,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_match_state() -> MatchState {
        let host = Pubkey::new_unique();
        MatchState {
            match_id: 99,
            epoch: 1,
            host,
            phase: MatchPhase::Active,
            map_id: 1,
            field_width: 26_000,
            field_height: 26_000,
            spawns: [Position { x: 0, y: 0 }; 2],
            players: [MatchPlayer::empty(Position { x: 0, y: 0 }); 2],
            tick: 0,
            bump: 1,
            input_receipts: [InputBatchReceipt::empty(Position { x: 0, y: 0 }); 2],
            projectiles: [[ProjectileSnapshot::empty(); MAX_PROJECTILES_PER_PLAYER]; 2],
            projectile_counts: [0; 2],
            board_mutations: [BoardMutation::empty(); MAX_BOARD_MUTATIONS],
            board_mutation_count: 0,
            enemy_spawns: [Position { x: 0, y: 0 }; ENEMY_SPAWN_COUNT],
            enemy_total: 0,
            enemy_speed_classes: [0; MAX_ENEMY_TOTAL],
            enemies: [EnemyState::empty(); MAX_ACTIVE_ENEMIES],
            enemy_spawn_cursor: 0,
            simulation_tick: 0,
            next_enemy_spawn_tick: FIRST_ENEMY_SPAWN_TICK,
            rng_state: 99,
            last_simulation_slot: 0,
            terrain_width: 108,
            terrain_height: 108,
            terrain_occupancy: [0; MAX_TERRAIN_BYTES],
            terrain_bytes_written: MAX_TERRAIN_BYTES as u16,
            terrain_initialized: true,
            base_position: Position {
                x: 12_000,
                y: 24_500,
            },
        }
    }

    #[test]
    fn movement_is_cardinal_and_bounded() {
        let start = Position { x: 500, y: 500 };
        let moved = apply_movement(start, Direction::Left, 250, 1_000, 1_000).unwrap();
        assert_eq!(moved, Position { x: 250, y: 500 });
        assert!(apply_movement(start, Direction::Up, 501, 1_000, 1_000).is_err());
    }

    #[test]
    fn reset_preserves_authority_and_clears_sequence() {
        let authority = Pubkey::new_unique();
        let mut player = MatchPlayer::joined(authority, Position { x: 1, y: 2 });
        player.sequence = 9;
        player.reset(Position { x: 10, y: 20 });
        assert_eq!(player.authority, authority);
        assert_eq!(player.sequence, 0);
        assert_eq!((player.x, player.y), (10, 20));
    }

    #[test]
    fn detects_tank_overlap() {
        assert!(positions_overlap(
            Position { x: 1_000, y: 1_000 },
            Position { x: 1_500, y: 1_000 }
        ));
        assert!(!positions_overlap(
            Position { x: 1_000, y: 1_000 },
            Position { x: 2_000, y: 1_000 }
        ));
    }

    #[test]
    fn enemy_and_player_tank_blockers_are_symmetric() {
        let authority = Pubkey::new_unique();
        let mut state = test_match_state();
        state.players[0] = MatchPlayer::joined(authority, Position { x: 5_000, y: 5_000 });
        state.enemies[0] = EnemyState {
            id: 0,
            x: 6_000,
            y: 5_000,
            direction: Direction::Left,
            active: true,
            movement_remainder: 0,
            next_turn_tick: 0,
        };

        assert!(any_player_blocks_tank(
            &state,
            Position { x: 5_999, y: 5_000 },
            None,
        ));
        assert!(!any_player_blocks_tank(
            &state,
            Position { x: 5_999, y: 5_000 },
            Some(0),
        ));
        assert!(any_enemy_blocks_tank(
            &state,
            Position { x: 5_001, y: 5_000 },
            None,
        ));
        assert!(!any_enemy_blocks_tank(
            &state,
            Position { x: 5_001, y: 5_000 },
            Some(0),
        ));
    }

    #[test]
    fn spawned_enemy_holds_position_until_spawn_animation_finishes() {
        let mut state = test_match_state();
        let spawn = Position { x: 3_000, y: 0 };
        state.enemy_total = 1;
        state.enemy_spawns[0] = spawn;
        state.simulation_tick = FIRST_ENEMY_SPAWN_TICK - 1;
        state.next_enemy_spawn_tick = FIRST_ENEMY_SPAWN_TICK;

        simulate_enemy_step(&mut state).unwrap();

        let enemy = state.enemies[0];
        assert!(enemy.active);
        assert_eq!((enemy.x, enemy.y), (spawn.x, spawn.y));
        assert_eq!(enemy_ai_state(enemy.movement_remainder), EnemyAiState::Thinking);
        assert_eq!(
            enemy.next_turn_tick,
            FIRST_ENEMY_SPAWN_TICK + ENEMY_SPAWN_HOLD_TICKS,
        );
        assert_eq!(state.enemy_spawn_cursor, 1);
    }

    #[test]
    fn occupied_enemy_spawn_point_delays_spawn() {
        let mut state = test_match_state();
        let spawn = Position { x: 3_000, y: 0 };
        state.enemy_total = 2;
        state.enemy_spawns[0] = spawn;
        state.simulation_tick = FIRST_ENEMY_SPAWN_TICK - 1;
        state.next_enemy_spawn_tick = FIRST_ENEMY_SPAWN_TICK;

        let mut occupant = EnemyState {
            id: 9,
            x: spawn.x,
            y: spawn.y,
            direction: Direction::Down,
            active: true,
            movement_remainder: 0,
            next_turn_tick: FIRST_ENEMY_SPAWN_TICK + 100,
        };
        set_enemy_ai_state(&mut occupant, EnemyAiState::Thinking);
        state.enemies[0] = occupant;

        simulate_enemy_step(&mut state).unwrap();

        assert_eq!(state.enemy_spawn_cursor, 0);
        assert_eq!(
            state.next_enemy_spawn_tick,
            FIRST_ENEMY_SPAWN_TICK + ENEMY_SPAWN_RETRY_TICKS,
        );
        assert_eq!(state.enemies.iter().filter(|enemy| enemy.active).count(), 1);
    }

    #[test]
    fn base_blocks_tank_footprint() {
        let host = Pubkey::new_unique();
        let mut state = MatchState {
            match_id: 9,
            epoch: 1,
            host,
            phase: MatchPhase::Active,
            map_id: 1,
            field_width: 26_000,
            field_height: 26_000,
            spawns: [Position { x: 0, y: 0 }; 2],
            players: [MatchPlayer::empty(Position { x: 0, y: 0 }); 2],
            tick: 0,
            bump: 1,
            input_receipts: [InputBatchReceipt::empty(Position { x: 0, y: 0 }); 2],
            projectiles: [[ProjectileSnapshot::empty(); MAX_PROJECTILES_PER_PLAYER]; 2],
            projectile_counts: [0; 2],
            board_mutations: [BoardMutation::empty(); MAX_BOARD_MUTATIONS],
            board_mutation_count: 0,
            enemy_spawns: [Position { x: 0, y: 0 }; ENEMY_SPAWN_COUNT],
            enemy_total: 0,
            enemy_speed_classes: [0; MAX_ENEMY_TOTAL],
            enemies: [EnemyState::empty(); MAX_ACTIVE_ENEMIES],
            enemy_spawn_cursor: 0,
            simulation_tick: 0,
            next_enemy_spawn_tick: FIRST_ENEMY_SPAWN_TICK,
            rng_state: 9,
            last_simulation_slot: 0,
            terrain_width: 108,
            terrain_height: 108,
            terrain_occupancy: [0; MAX_TERRAIN_BYTES],
            terrain_bytes_written: MAX_TERRAIN_BYTES as u16,
            terrain_initialized: true,
            base_position: Position {
                x: 12_000,
                y: 24_500,
            },
        };

        assert!(base_blocks_tank(
            &state,
            Position {
                x: 11_500,
                y: 24_500
            },
        ));
        assert!(base_blocks_tank(
            &state,
            Position {
                x: 13_999,
                y: 25_999
            },
        ));
        assert!(!base_blocks_tank(
            &state,
            Position {
                x: 10_999,
                y: 24_500
            },
        ));
        assert!(!base_blocks_tank(
            &state,
            Position {
                x: 14_000,
                y: 24_500
            },
        ));

        state.enemies[0] = EnemyState {
            id: 0,
            x: 11_000,
            y: 24_500,
            direction: Direction::Right,
            active: true,
            movement_remainder: 0,
            next_turn_tick: 0,
        };
        simulate_enemy_step(&mut state).unwrap();
        assert_eq!(state.enemies[0].x, 11_000);
        assert_eq!(
            enemy_ai_state(state.enemies[0].movement_remainder),
            EnemyAiState::Thinking
        );
    }

    #[test]
    fn input_receipt_preserves_ordered_fire_events() {
        let start = Position { x: 100, y: 200 };
        let frames = [
            InputFrame {
                direction: Direction::Right,
                distance: 250,
                fire: false,
                fire_age_ms: 0,
            },
            InputFrame {
                direction: Direction::Down,
                distance: 0,
                fire: true,
                fire_age_ms: 45,
            },
        ];
        let mut receipt = InputBatchReceipt::empty(start);

        receipt.record(7, start, &frames);

        assert_eq!(receipt.batch_sequence, 7);
        assert_eq!(receipt.len, 2);
        assert_eq!(receipt.frames[..2], frames);
        assert_eq!(MatchState::INIT_SPACE, 2_685);
    }

    #[test]
    fn projectile_snapshots_only_move_forward() {
        let old = ProjectileSnapshot {
            id: 1,
            x: 500,
            y: 500,
            direction: Direction::Right,
        };
        let next = ProjectileSnapshot { x: 900, ..old };
        assert!(
            validate_projectiles(&[next], &[old], Position { x: 0, y: 0 }, 2_000, 2_000).is_ok()
        );
        let invalid = ProjectileSnapshot { x: 400, ..old };
        assert!(
            validate_projectiles(&[invalid], &[old], Position { x: 0, y: 0 }, 2_000, 2_000)
                .is_err()
        );
    }

    #[test]
    fn enemy_simulation_uses_three_fixed_substeps() {
        let host = Pubkey::new_unique();
        let mut state = MatchState {
            match_id: 7,
            epoch: 1,
            host,
            phase: MatchPhase::Active,
            map_id: 1,
            field_width: 26_000,
            field_height: 26_000,
            spawns: [Position {
                x: 8_000,
                y: 24_000,
            }; 2],
            players: [
                MatchPlayer::joined(
                    host,
                    Position {
                        x: 8_000,
                        y: 24_000,
                    },
                ),
                MatchPlayer::empty(Position {
                    x: 18_000,
                    y: 24_000,
                }),
            ],
            tick: 0,
            bump: 1,
            input_receipts: [InputBatchReceipt::empty(Position { x: 0, y: 0 }); 2],
            projectiles: [[ProjectileSnapshot::empty(); MAX_PROJECTILES_PER_PLAYER]; 2],
            projectile_counts: [0; 2],
            board_mutations: [BoardMutation::empty(); MAX_BOARD_MUTATIONS],
            board_mutation_count: 0,
            enemy_spawns: [Position { x: 1_000, y: 0 }; ENEMY_SPAWN_COUNT],
            enemy_total: 1,
            enemy_speed_classes: [0; MAX_ENEMY_TOTAL],
            enemies: [EnemyState::empty(); MAX_ACTIVE_ENEMIES],
            enemy_spawn_cursor: 1,
            simulation_tick: 0,
            next_enemy_spawn_tick: ENEMY_SPAWN_INTERVAL_TICKS,
            rng_state: 7,
            last_simulation_slot: 0,
            terrain_width: 108,
            terrain_height: 108,
            terrain_occupancy: [0; MAX_TERRAIN_BYTES],
            terrain_bytes_written: MAX_TERRAIN_BYTES as u16,
            terrain_initialized: true,
            base_position: Position {
                x: 12_000,
                y: 24_500,
            },
        };
        state.enemies[0] = EnemyState {
            id: 0,
            x: 1_000,
            y: 0,
            direction: Direction::Down,
            active: true,
            movement_remainder: 0,
            next_turn_tick: 0,
        };

        for _ in 0..SIMULATION_STEPS_PER_CRANK {
            simulate_enemy_step(&mut state).unwrap();
        }

        assert_eq!(state.simulation_tick, SIMULATION_STEPS_PER_CRANK as u64);
        assert!(state.enemies[0].active);
        assert_eq!(state.enemies[0].y, 93);
    }

    #[test]
    fn terrain_grid_blocks_tank_footprint_and_clears_destroyed_cells() {
        let host = Pubkey::new_unique();
        let mut state = MatchState {
            match_id: 8,
            epoch: 1,
            host,
            phase: MatchPhase::Active,
            map_id: 1,
            field_width: 2_000,
            field_height: 2_000,
            spawns: [Position { x: 0, y: 0 }; 2],
            players: [MatchPlayer::empty(Position { x: 0, y: 0 }); 2],
            tick: 0,
            bump: 1,
            input_receipts: [InputBatchReceipt::empty(Position { x: 0, y: 0 }); 2],
            projectiles: [[ProjectileSnapshot::empty(); MAX_PROJECTILES_PER_PLAYER]; 2],
            projectile_counts: [0; 2],
            board_mutations: [BoardMutation::empty(); MAX_BOARD_MUTATIONS],
            board_mutation_count: 0,
            enemy_spawns: [Position { x: 0, y: 0 }; ENEMY_SPAWN_COUNT],
            enemy_total: 0,
            enemy_speed_classes: [0; MAX_ENEMY_TOTAL],
            enemies: [EnemyState::empty(); MAX_ACTIVE_ENEMIES],
            enemy_spawn_cursor: 0,
            simulation_tick: 0,
            next_enemy_spawn_tick: FIRST_ENEMY_SPAWN_TICK,
            rng_state: 8,
            last_simulation_slot: 0,
            terrain_width: 12,
            terrain_height: 12,
            terrain_occupancy: [0; MAX_TERRAIN_BYTES],
            terrain_bytes_written: 18,
            terrain_initialized: true,
            base_position: Position { x: 1_000, y: 1_750 },
        };
        let blocked_bit = 2 * usize::from(state.terrain_width) + 4;
        state.terrain_occupancy[blocked_bit / 8] |= 1 << (blocked_bit % 8);

        assert!(terrain_blocks_tank(&state, Position { x: 250, y: 500 }));
        state.enemies[0] = EnemyState {
            id: 0,
            x: 250,
            y: 500,
            direction: Direction::Down,
            active: true,
            movement_remainder: 0,
            next_turn_tick: 0,
        };
        simulate_enemy_step(&mut state).unwrap();
        assert_eq!(
            enemy_ai_state(state.enemies[0].movement_remainder),
            EnemyAiState::Thinking
        );
        assert_eq!(state.enemies[0].direction, Direction::Down);
        assert_eq!(state.enemies[0].next_turn_tick, 1 + ENEMY_THINK_TICKS);
        clear_terrain_cell(&mut state, 4, 2);
        assert!(!terrain_blocks_tank(&state, Position { x: 250, y: 500 }));
    }
}
