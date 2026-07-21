# BattleCity local authoritative server

Runs the complete local multiplayer simulation at 60 Hz and broadcasts
authoritative snapshots at 20 Hz. The Rust process owns player movement,
enemy spawning and AI, player/enemy bullets, terrain destruction, tank damage,
lives and respawns, scoring, base destruction, and match win/loss state. It
uses the same integer coordinate scale and 16 px terrain grid as the MagicBlock
program.

```powershell
cargo run --manifest-path LocalServer/Cargo.toml
```

Health check: `http://127.0.0.1:8787/health`

Start player one with `?mode=local&level=1`. The development web server proxies
its secure `/local-game` WebSocket to this Rust process and displays a button
that copies the player-two room link. Use `server=ws://HOST:8787/ws` in the URL
only when the page itself is served over HTTP and the Rust server is elsewhere.

Powerup selection, placement, collection, and gameplay effects are also owned
by Rust; the client only creates their visual objects and reacts to confirmed
pickup events.
