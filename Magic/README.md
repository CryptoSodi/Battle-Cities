# MagicBlock tank movement

This Anchor program stores one authoritative `TankState` PDA per player. Coordinates are integer milli-units (`1000` = one game unit), movement is cardinal and bounded to `0..26000`, and strict sequence numbers reject replayed or out-of-order moves.

Routing:

- Send `initialize_tank` and `delegate_tank` to `https://rpc.magicblock.app/devnet`.
- Query `getDelegationStatus` at `https://devnet-router.magicblock.app/`.
- Send `move_tank`, `commit_tank`, and `undelegate_tank` to the returned `result.fqdn` with `skipPreflight: true`.
- Wait about three seconds after delegation or undelegation before reading from the other layer.

The deployer and program keypairs are under `keys/` and ignored by Git.

## Deployment

- Network: MagicBlock Solana Devnet
- Program: `6h22S7XADcvgqt8aXEteSu8HzbUmzsAdGucH3zpszC23`
- Upgrade authority: `6wQz66BgRsX6DVHAD3PDCXjKVpe3LLrj3FGiQwCSZV7F`

Build and redeploy from this directory with the project-local Agave toolchain:

```powershell
./.tools/solana-release/bin/cargo-build-sbf.exe `
  --manifest-path programs/tank-movement/Cargo.toml `
  --sbf-out-dir target/deploy

./.tools/solana-release/bin/solana.exe program deploy `
  target/deploy/tank_movement.so `
  --program-id keys/tank-movement-program.json `
  --keypair C:/Users/tassa/.config/solana/id.json `
  --url https://rpc.magicblock.app/devnet
```
