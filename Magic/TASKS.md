# MagicBlock integration tasks

## Movement MVP

- [ ] Commit and protect the standalone program workspace; keep all keypairs ignored.
- [x] Add a match-scoped PDA with match ID, epoch, phase, map, bounds, two player slots, and session authorities.
- [x] Add create, join, delegate, start, signed input, commit, and undelegate instructions.
- [x] Enforce player authority, epoch, strict input sequence, movement bounds, and player collision.
- [ ] Add movement cadence checks and program events.
- [x] Add Rust movement/bounds/reset/collision unit tests.
- [ ] Test create, join, delegate, move, commit, and undelegate end to end on Devnet.
- [x] Check in the client IDL and add a two-player TypeScript match client.
- [x] Implement base-layer initialization/delegation and router `getDelegationStatus` discovery.
- [x] Send movement intents to the returned ER endpoint with `skipPreflight: true`.
- [x] Add fixed-rate client prediction and confirmed-state reconciliation.
- [x] Subscribe to shared match state and interpolate the remote tank.
- [x] Add link-based two-browser match coordination and stable browser session signers.
- [ ] Add reconnect/resume UI for abandoned or already-delegated matches.
- [ ] Commit and undelegate all match accounts during cleanup.
- [x] Upgrade and verify the existing Devnet program (slot `477432836`).

## Authoritative gameplay expansion

- [ ] Bullet spawning, movement, and hit validation.
- [ ] Player damage, deaths, and respawns.
- [ ] Enemy spawning, movement, and AI state.
- [ ] Base destruction, score, timer, and game-over state.
- [ ] Final match settlement and leaderboard/reward actions.
- [ ] Add VRF only where gameplay requires verifiable randomness.

## Reliability

- [ ] Re-query the router after ER connection failures.
- [ ] Pause writes while delegation state is uncertain.
- [ ] Add abandoned-match recovery and idempotent cleanup.
- [ ] Track the 10 sponsored commits per delegation and add a fee vault only if needed.
