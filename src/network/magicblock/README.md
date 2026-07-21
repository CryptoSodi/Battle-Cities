# MagicBlock movement integration

This is an experimental Devnet integration for the deployed movement program:

- Program: `DSZ915qqBHFJHdN8TwLKVsWQxTs3b8J2drwrtm74ktP3`
- Base RPC: `https://rpc.magicblock.app/devnet`
- Router: `https://devnet-router.magicblock.app/`

The game client uses the official `@magicblock-labs/ephemeral-rollups-sdk`
for MagicBlock router access, delegation constants, and delegation PDA helpers.
`@coral-xyz/anchor` encodes the program instructions from the checked-in client
IDL. The deployed program does not currently publish an on-chain Anchor IDL.

The client build runs on TypeScript `4.9.5`, Webpack `5`, and `ts-loader`; the
former nested TypeScript `3.7.4` compiler and `awesome-typescript-loader` have
been removed.

## Test legacy second-screen movement

1. Open the game with `?magicblock=1` in the URL.
2. Sign in with Phantom and start a live match.
3. Approve the one-time transfer that funds a browser session signer with up to
   `0.05` Devnet SOL.
4. Move the primary tank. Settled movement is sent to the ER at most every
   `50ms`.
5. When movement is ready, press **Copy second-screen link** and open that URL
   on another device. It opens the current level automatically; its primary
   tank follows the delegated ER tank account without requiring a wallet,
   local controls, or transactions.

Initialization and delegation go to the base RPC. The client then asks the
router for the assigned `fqdn` and sends movement to that ER with preflight
disabled. A reused delegated tank is first aligned to the current spawn using
the existing movement instruction, preventing a previous match's final position
from offsetting the second screen. Failures are logged under `MagicBlock`; local
gameplay continues.

## Current limits

- The legacy `?magicblock=1` route remains primary-player location mirroring.
- Second-screen mode mirrors the primary tank position and direction. Enemies,
  bullets, map damage, and match timing still run independently on each screen.
- The new `?magicblock=1&mode=match&level=1` route creates a shared two-player
  Match PDA. Player one gets a copyable link; its second browser controls the
  yellow tank. Both browsers subscribe to the same delegated account.
- Phase 1 authorizes players and validates epochs, sequences, bounds, movement,
  and tank-to-tank overlap on the ER. Local prediction is reconciled against
  confirmed state.
- Terrain/map destruction, bullets, damage, score, enemies, game-over, and
  automatic commit/undelegate are not authoritative yet.
- Replay playback and non-wallet sessions never send transactions.
- The Devnet session secret is stored in browser `localStorage`. Do not reuse
  this approach for mainnet or a session holding meaningful funds.

## SDK responsibilities

- MagicBlock SDK: router connection, delegation ownership constant, delegation
  record/metadata/buffer PDA derivation.
- Anchor: instruction encoding for the legacy tank instructions and the new
  match lifecycle/input instructions.
- Game client: Phantom session authorization, fixed-rate movement sampling,
  base/ER transaction lifecycle, and local fail-open behavior.
