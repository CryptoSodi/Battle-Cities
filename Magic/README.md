# MagicBlock tank movement

This Anchor program preserves the original single-player `TankState` API and adds
an authoritative two-player `MatchState` PDA. A match stores its ID, epoch,
phase, map ID, bounds, spawns, two signed player slots, movement sequences, and
tick. Movement is cardinal, bounded, rejects player overlap, and rejects stale
epochs or replayed/out-of-order input.

Routing:

- Send `initialize_tank` and `delegate_tank` to `https://rpc.magicblock.app/devnet`.
- Query `getDelegationStatus` at `https://devnet-router.magicblock.app/`.
- Send `move_tank`, `commit_tank`, and `undelegate_tank` to the returned `result.fqdn` with `skipPreflight: true`.
- For multiplayer, create/join the match on the base layer, delegate it after
  both players join, then send `start_match` and `submit_input` to the returned
  ER endpoint.
- Wait about three seconds after delegation or undelegation before reading from the other layer.

Local keypairs belong under `keys/` and are ignored by Git. Never commit wallet or program keypairs.

## Deployment

- Network: MagicBlock Solana Devnet
- Program: `DSZ915qqBHFJHdN8TwLKVsWQxTs3b8J2drwrtm74ktP3`
- Upgrade authority: `BVahvmY2hZRPdvnDr6eGWiJRsdA3ochodb4MUxsZitv7`

Install a current Agave/Solana toolchain, then build and upgrade from this directory:

```powershell
cargo build-sbf `
  --manifest-path programs/tank-movement/Cargo.toml `
  --sbf-out-dir target/deploy

solana program deploy `
  target/deploy/tank_movement.so `
  --program-id keys/tank-movement-devnet-20260721.json `
  --keypair keys/deployer.json `
  --url https://rpc.magicblock.app/devnet
```

See `TASKS.md` for the ordered integration backlog.

## Two-player game test

1. Open the game with `?magicblock=1&mode=match&level=1` and connect Phantom.
2. Approve funding of the browser session signer on Devnet.
3. Copy the displayed player-two link.
4. Open it in a second browser/profile with a different Phantom wallet.
5. Player one controls the green tank and player two controls the yellow tank.

The current Phase 1 client predicts its local tank immediately, submits
collision-settled movement every 50 ms, interpolates the remote tank, and
reconciles confirmed local state. Map terrain/destruction is not yet stored in
the Match PDA; that is part of the authoritative-world phase.
