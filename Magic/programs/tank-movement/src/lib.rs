use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;

declare_id!("6h22S7XADcvgqt8aXEteSu8HzbUmzsAdGucH3zpszC23");

const TANK_SEED: &[u8] = b"tank";
const MAX_X: i32 = 26_000;
const MAX_Y: i32 = 26_000;
const MAX_STEP: u16 = 1_000;
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

    pub fn move_tank(ctx: Context<MoveTank>, direction: Direction, distance: u16, sequence: u64) -> Result<()> {
        require!(distance > 0 && distance <= MAX_STEP, MovementError::InvalidDistance);
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
        MagicIntentBundleBuilder::new(ctx.accounts.authority.to_account_info(), ctx.accounts.magic_context.to_account_info(), ctx.accounts.magic_program.to_account_info())
            .commit(&[ctx.accounts.tank.to_account_info()]).build_and_invoke()?;
        Ok(())
    }

    pub fn undelegate_tank(ctx: Context<CommitTank>) -> Result<()> {
        MagicIntentBundleBuilder::new(ctx.accounts.authority.to_account_info(), ctx.accounts.magic_context.to_account_info(), ctx.accounts.magic_program.to_account_info())
            .commit_and_undelegate(&[ctx.accounts.tank.to_account_info()]).build_and_invoke()?;
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum Direction { Up, Right, Down, Left }

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

#[derive(Accounts)]
pub struct InitializeTank<'info> {
    #[account(mut)] pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + TankState::INIT_SPACE, seeds = [TANK_SEED, authority.key().as_ref()], bump)]
    pub tank: Account<'info, TankState>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateTank<'info> {
    #[account(mut)] pub authority: Signer<'info>,
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

#[commit]
#[derive(Accounts)]
pub struct CommitTank<'info> {
    #[account(mut)] pub authority: Signer<'info>,
    #[account(mut, seeds = [TANK_SEED, authority.key().as_ref()], bump = tank.bump, has_one = authority)]
    pub tank: Account<'info, TankState>,
}

#[error_code]
pub enum MovementError {
    #[msg("Movement would leave the map bounds")] OutOfBounds,
    #[msg("Distance must be between 1 and 1000 units")] InvalidDistance,
    #[msg("Movement sequence must increase by exactly one")] InvalidSequence,
    #[msg("Coordinate arithmetic overflowed")] ArithmeticOverflow,
}
