# Battle Cities Project Memory

Last updated: 2026-08-09

This is the durable handoff note for product decisions and operational facts. Keep it concise; use the source files and Git history for implementation detail. Never store credentials, tokens, private keys, or user data here.

## Current deployment ownership

- **Web frontend:** Cloudflare Pages serves `battlecities.com` and deploys from the connected Git repository.
- **Public API:** Oracle hosts `api.battlecities.com`. GitHub Actions deploys it only when `api-server/**` or `.github/workflows/deploy-api.yml` changes. Frontend-only pushes must not restart the API.
- **Cloudflare headless Worker:** deployed through Cloudflare's Git-connected Worker Build. The old GitHub Action (`deploy-worker.yml`) was intentionally removed to prevent duplicate deployments.
- **Vercel headless:** remains an available test/runtime target, including the BOM1 project. It is not used for API storage.

## Multiplayer direction

- The game server is authoritative for movement and match outcomes.
- Clients send commands/input; the server simulates movement and returns the resulting state.
- WebSocket transport exists alongside WebRTC. Do not remove WebRTC unless explicitly requested.
- Headless runtime selection is used for testing different regions/providers (for example Worker, BOM1, and Oracle/USA).
- Do not add interpolation for local authoritative movement unless explicitly requested; snapshots should be sent after they are processed.
- Enemies, bullets, score, deaths, base state, stage completion, and replay results must remain server-authoritative in multiplayer.

## Replay recording

- Multiplayer headless recordings and offline single-player recordings are both uploaded through the API and must use the same replay format.
- Replays are stored by the API, not Vercel.
- Public replay/profile links load through the game shell only for playback. The standalone HTML player profile is for the Admin dashboard.

## Player profiles and Admin

- Admin player links use `/player-profile/index.html?playerId=<playerId>`.
- Do **not** restore the former `/player-profile/:playerId` Pages redirect. It matches static assets such as `profile.css` and causes Cloudflare to serve HTML instead of CSS.
- Player profiles use Admin CSS and have server-backed match pagination (12 matches per page).
- Replay controls open the game playback flow; profile history itself is HTML/Admin UI.

## UI rules

- Read `.agents/skills/battlecity-ui/SKILL.md` before any UI change.
- Reuse Admin/shop styling: dark framed panels, restrained amber accents, green default actions, and established button typography.
- Keep desktop and mobile behavior independently safe.

## Operational notes

- A normal commit bumps `version.json`; do not treat that as an API change.
- GitHub's API workflow still supports `workflow_dispatch` for deliberate manual deployments.
- `npm run build` verifies the web build. `npm run build` within `api-server/` compiles the API server.
- `MULTIPLAYER_ARCHITECTURE.md` contains valuable MagicBlock background but includes historical architecture. Confirm current transport/runtime behavior in the relevant code before following it literally.
