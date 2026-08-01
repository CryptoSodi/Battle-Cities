# BattleCities API Endpoints

Last verified against the source router: **2026-07-30**

## Services

| Service        | Base URL                               | Purpose                                                                            |
| -------------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| Game API       | `https://api.battlecities.com/api`     | Authentication, player data, economy, events, matchmaking, signaling, and archives |
| Broadcaster    | `https://api.battlecities.com`         | Embedded authoritative workers, monitoring, and archive replay                     |
| Local Game API | `http://127.0.0.1:3001/api`            | Local API development                                                              |

The Game API currently exposes **67 non-CORS operations**. The broadcaster exposes **16 operations**. `OPTIONS` handlers are omitted below.

## Access labels

| Label       | Meaning                                                                          |
| ----------- | -------------------------------------------------------------------------------- |
| Public      | No player login required                                                         |
| Session     | A valid BattleCities session cookie is required                                  |
| Member      | The logged-in player must belong to the requested match                          |
| Broadcaster | An automatically generated internal bearer token is required                    |
| Event admin | `Authorization: Bearer <BATTLECITY_EVENT_ADMIN_SECRET>` is required              |
| Discord     | A valid Discord Ed25519 request signature is required                            |
| Bot service | `Authorization: Bearer <DISCORD_BOT_SERVICE_TOKEN>` is required                  |
| Conditional | Public response is available, but player-specific information requires a session |

## Health and authentication

| Method   | Path                                                  | Access      | Description                                                                 |
| -------- | ----------------------------------------------------- | ----------- | --------------------------------------------------------------------------- |
| `GET`    | `/health`                                             | Public      | Lightweight API process health check                                        |
| `GET`    | `/ready`                                              | Public      | Database and migration readiness check                                      |
| `POST`   | `/integrations/discord/interactions`                  | Discord     | Verify signed Discord interactions and answer endpoint-validation PINGs     |
| `GET`    | `/integrations/discord/oauth/start`                   | Session     | Redirect the logged-in player to Discord for account and guild verification |
| `GET`    | `/integrations/discord/oauth/callback`                | Session     | Complete the Discord OAuth callback and store verified guild membership     |
| `GET`    | `/integrations/discord/verified-users/:discordUserId` | Bot service | Read a Discord account's verification status for role assignment            |
| `GET`    | `/integrations/discord/verification`                  | Session     | Read the logged-in player's Discord verification state                      |
| `POST`   | `/integrations/discord/verification`                  | Session     | Create a single-use, ten-minute Discord `/verify` code                      |
| `GET`    | `/auth/google/start`                                  | Public      | Start the Google OAuth redirect flow                                        |
| `GET`    | `/auth/google/callback`                               | Public      | Complete Google OAuth and create a session                                  |
| `POST`   | `/auth/google/native`                                 | Public      | Authenticate with a Google ID token                                         |
| `GET`    | `/session`                                            | Public      | Read the current session                                                    |
| `POST`   | `/session`                                            | Public      | Create a guest session or verify a signed-wallet login                      |
| `PUT`    | `/session`                                            | Public      | Create a wallet-signing challenge                                           |
| `DELETE` | `/session`                                            | Session     | Delete the current session and log out                                      |
| `GET`    | `/player`                                             | Session     | Read the current player profile                                             |
| `PUT`    | `/player`                                             | Session     | Merge player high scores into the profile                                   |
| `GET`    | `/players/:playerId/profile`                          | Public      | Read a public player profile, ranks, highscores, and recent match history   |

## Public player profiles

Shareable frontend route:

```text
https://www.battlecities.com/player-profile/<playerId>
```

Public API route:

```text
GET https://api.battlecities.com/api/players/<playerId>/profile
```

BattleCities player IDs use the `ply-` prefix. The response contains only public information:

```json
{
  "item": {
    "id": "ply-example-player-id",
    "provider": "google",
    "displayName": "Player",
    "walletAddress": null,
    "avatarUrl": "https://example.com/avatar.png",
    "joinedAt": "2026-07-30T00:00:00.000Z",
    "lastSeenAt": "2026-07-30T00:00:00.000Z",
    "highscores": {
      "primary": 12500,
      "secondary": 8200
    },
    "stats": {
      "allTime": {
        "rank": 12,
        "totalPoints": 4800,
        "matches": 9
      },
      "currentSeason": {
        "id": "season-current",
        "name": "Current Season",
        "rank": 18,
        "totalPoints": 2100,
        "matches": 4
      }
    },
    "recentMatches": []
  }
}
```

Recent match history excludes rejected results. Google email, Google subject, authentication credentials, economy balances, inventory, and service secrets are never returned. A wallet address is returned only for wallet-based profiles.

## Economy and progression

| Method | Path                                    | Access      | Description                                                    |
| ------ | --------------------------------------- | ----------- | -------------------------------------------------------------- |
| `GET`  | `/economy/account`                      | Session     | Read balances, inventory, and loadout                          |
| `PUT`  | `/economy/account`                      | Session     | Update allowed economy account fields                          |
| `GET`  | `/economy/ledger`                       | Session     | Read the latest player ledger entries                          |
| `POST` | `/economy/purchase`                     | Session     | Purchase a shop item                                           |
| `GET`  | `/boost/status`                         | Conditional | Read trading and staking boost status                          |
| `GET`  | `/phases`                               | Public      | List configured project/game phases                            |
| `GET`  | `/events`                               | Public      | List configured events                                         |
| `GET`  | `/events/detail?slug=<slug>`            | Conditional | Read event details, quest state, and optional player rank      |
| `GET`  | `/events/leaderboard?slug=<slug>`       | Public      | Read the event leaderboard                                     |
| `GET`  | `/quests`                               | Conditional | Read the quest board and optional player progress              |
| `POST` | `/quests/claim`                         | Session     | Claim a completed quest reward                                 |
| `GET`  | `/rankings?scope=<scope>&seasonId=<id>` | Conditional | Read gaming or trading rankings and optional player rank       |
| `GET`  | `/seasons/current`                      | Public      | Read the current season                                        |
| `GET`  | `/airdrops/eligibility`                 | Conditional | List campaigns; use `?slug=<slug>` to check player eligibility |
| `POST` | `/airdrops/claim`                       | Session     | Claim an eligible airdrop                                      |

Valid ranking scopes are `gaming` and `trading`.
Each ranking row includes its public `playerId`; the ranking UI uses it to open
`/player-profile/:playerId` without exposing account credentials.

## Staking and trading

| Method | Path                   | Access      | Description                                         |
| ------ | ---------------------- | ----------- | --------------------------------------------------- |
| `GET`  | `/staking/summary`     | Conditional | Read global and optional player staking information |
| `GET`  | `/staking/leaderboard` | Public      | Read the staking leaderboard                        |
| `POST` | `/staking/stake`       | Session     | Stake tokens                                        |
| `POST` | `/staking/unstake`     | Session     | Begin unstaking tokens                              |
| `POST` | `/staking/claim`       | Session     | Claim tokens after unstaking completes              |
| `GET`  | `/trading/tokens`      | Public      | Read supported trading-token configuration          |
| `POST` | `/trading/verify-swap` | Session     | Verify and record a swap                            |

## Game results and uploaded replays

| Method | Path                | Access               | Description                                                |
| ------ | ------------------- | -------------------- | ---------------------------------------------------------- |
| `POST` | `/matches/submit`   | Session              | Submit a normal game result for progression and rankings   |
| `GET`  | `/replays`          | Guest/session cookie | List replay summaries; pass `?id=<id>` to fetch one replay |
| `POST` | `/replays`          | Guest/session cookie | Create an uploaded replay record                           |
| `POST` | `/replays/validate` | Guest/session cookie | Validate an uploaded replay                                |

`/matches/submit` is not the authoritative multiplayer-result endpoint. Authoritative multiplayer results are submitted by the broadcaster through `/multiplayer/matches/:matchId/result`.

## Direct multiplayer matchmaking

### Start or join a match

`POST /multiplayer/direct/start` — **Session**

Accepted request fields:

```json
{
  "tankTier": "a",
  "stage": 1,
  "matchId": "match-optional-existing-id"
}
```

- Without `matchId`, matchmaking joins an eligible waiting room or creates one.
- A waiting assignment is returned without runtime startup.
- When the second slot is filled, the API starts the broadcaster and returns `runtime`.
- Fuel is charged according to the selected tank tier.

### Match lifecycle

| Method | Path                                      | Access           | Description                                                              |
| ------ | ----------------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| `GET`  | `/multiplayer/matches/live`               | Public           | List open/live matches                                                   |
| `GET`  | `/multiplayer/matches/:matchId`           | Public           | Read match state                                                         |
| `POST` | `/multiplayer/matches/:matchId/reconnect` | Session + Member | Reconnect and receive the current assignment/runtime                     |
| `POST` | `/multiplayer/matches/:matchId/exit`      | Session + Member | Exit the match and apply direct-match refund rules                       |
| `POST` | `/multiplayer/matches/:matchId/started`   | Session + Member | Record player-side startup                                               |
| `POST` | `/multiplayer/matches/:matchId/observe`   | Public           | Register an observer and return an observer ID                           |
| `POST` | `/multiplayer/matches/:matchId/result`    | Broadcaster      | Submit authoritative scores and complete the match                       |
| `POST` | `/multiplayer/matches/:matchId/score`     | Session          | Disabled endpoint; always rejects client-authoritative scores with `403` |

### Multi-stage matches

| Method | Path                                          | Access           | Description                                                                |
| ------ | --------------------------------------------- | ---------------- | -------------------------------------------------------------------------- |
| `POST` | `/multiplayer/matches/:matchId/stage`         | Broadcaster      | Transition the match to another stage, set open slots, and preserve scores |
| `POST` | `/multiplayer/matches/:matchId/stage-started` | Broadcaster      | Mark a specific match stage as started                                     |
| `POST` | `/multiplayer/matches/:matchId/stage-rejoin`  | Session + Member | Rejoin an open player slot for a stage and configure that broadcaster slot |

The stage transition request accepts `stageNumber`, `openSlots`, and `scores`. Stage rejoin accepts `stage` and `tankTier`.

### Runtime response

When a match is ready, matchmaking or reconnect returns a server-issued runtime configuration:

```json
{
  "ok": true,
  "assignment": {
    "match": {
      "id": "match-123",
      "status": "ready"
    },
    "playerSlot": 0,
    "joinToken": "private-player-token"
  },
  "runtime": {
    "protocolVersion": 1,
    "mode": "webrtc",
    "matchId": "match-123",
    "role": "player",
    "playerSlot": 0,
    "level": 1,
    "signalingBaseUrl": "https://api.battlecities.com",
    "joinToken": "private-player-token"
  }
}
```

Clients must not choose their own slot. `joinToken` is bound server-side to the player, match, and slot.

## Multiplayer events

`:eventId` accepts an event ID or event slug.

| Method | Path                                     | Access            | Description                                        |
| ------ | ---------------------------------------- | ----------------- | -------------------------------------------------- |
| `POST` | `/events/:eventId/enter`                 | Session           | Pay the one-time event entry fuel                  |
| `POST` | `/events/:eventId/start`                 | Session + Entrant | Join or create an event match                      |
| `GET`  | `/events/:eventId/leaderboard?limit=<n>` | Public            | Read the multiplayer event leaderboard             |
| `POST` | `/events/:eventId/prizes/approve`        | Event admin       | Approve final prize allocations for an ended event |

Event entry fees are not refunded when a player exits a match.

## WebRTC signaling and observers

| Method | Path                                                                              | Access                                | Description                    |
| ------ | --------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------ |
| `GET`  | `/webrtc/matches/:signalingMatchId/players/:playerIndex/signals/:kind?after=<id>` | Authorized participant or broadcaster | Poll the next signaling record |
| `POST` | `/webrtc/matches/:signalingMatchId/players/:playerIndex/signals/:kind`            | Authorized participant or broadcaster | Publish a signaling record     |
| `GET`  | `/webrtc/matches/:matchId/observers`                                              | Public                                | List registered observer IDs   |
| `POST` | `/webrtc/matches/:matchId/observers`                                              | Public                                | Register an observer ID        |

Player signaling authorization requires:

- A logged-in player.
- Membership in the underlying match.
- The server-assigned player slot.
- `Authorization: Bearer <joinToken>`.

Observer signaling uses a previously registered observer ID. Embedded mode generates its internal broadcaster credential at startup.

## Broadcaster archive transport

Every endpoint in this section requires the internal broadcaster credential.

| Method | Path                                                                | Description                 |
| ------ | ------------------------------------------------------------------- | --------------------------- |
| `GET`  | `/multiplayer/archives?limit=<n>&includeIncomplete=1`               | List match archives         |
| `GET`  | `/multiplayer/archives/:matchId`                                    | Read archive metadata       |
| `GET`  | `/multiplayer/archives/:matchId/frames?afterSeq=<n>&batchLimit=<n>` | Read archived frame batches |
| `POST` | `/multiplayer/archives/:matchId/start`                              | Initialize an archive       |
| `POST` | `/multiplayer/archives/:matchId/frames`                             | Append archive frames       |
| `POST` | `/multiplayer/archives/:matchId/complete`                           | Finalize an archive         |

## Broadcaster HTTP service

The routes below are served by the broadcaster embedded in the native API process at `https://api.battlecities.com`.

### Public monitoring

| Method | Path                                 | Description                           |
| ------ | ------------------------------------ | ------------------------------------- |
| `GET`  | `/`                                  | Broadcaster monitor UI                |
| `GET`  | `/monitor`                           | Broadcaster monitor UI alias          |
| `GET`  | `/monitor/config`                    | Monitor configuration                 |
| `GET`  | `/live`                              | Public live-match UI                  |
| `GET`  | `/live/config`                       | Public live-view configuration        |
| `GET`  | `/live/matches`                      | Public active-match status list       |
| `GET`  | `/live/past-matches`                 | Public archived-match list            |
| `POST` | `/live/past-matches/:matchId/replay` | Start a public archive replay         |
| `GET`  | `/health`                            | Runtime health and active-match count |

### Service-token control API

All routes in this subsection require the internal broadcaster credential.

| Method   | Path                                      | Description                                                  |
| -------- | ----------------------------------------- | ------------------------------------------------------------ |
| `GET`    | `/matches`                                | List active authoritative workers                            |
| `POST`   | `/matches`                                | Idempotently create/start an authoritative worker            |
| `GET`    | `/matches/:matchId`                       | Read worker status                                           |
| `DELETE` | `/matches/:matchId`                       | Stop and remove a worker                                     |
| `PUT`    | `/matches/:matchId/players/:playerNumber` | Configure or replace player 1 or 2 during a stage transition |
| `GET`    | `/past-matches`                           | List archived matches                                        |
| `POST`   | `/past-matches/:matchId/replay`           | Start an authenticated archive replay                        |

Creating a broadcaster match accepts `201 Created`. `409 Match is already running` is also treated as success so request retries remain idempotent.

## Required service configuration

### Combined Ubuntu API

Configure these values only in `/etc/battlecities/api.env`:

```env
BATTLECITY_EMBED_BROADCASTER=1
BROADCASTER_BASE_URL=http://127.0.0.1:3001
BROADCASTER_API_URL=http://127.0.0.1:3001
BROADCASTER_PUBLIC_URL=https://api.battlecities.com
BROADCASTER_CLIENT_URL=https://www.battlecities.com
```

Build with `npm run server:build` and start the single process with
`npm run server:start`. Caddy forwards `api.battlecities.com` to
`127.0.0.1:3001`; no port `7777` or broadcaster hostname is used.

The embedded broadcaster credential is generated in memory and is never returned to browsers. Never expose database credentials, Google client secrets, or event-admin secrets to browser code.

## Source of truth

- Game API router: [`api-server/src/api/router.ts`](../api-server/src/api/router.ts)
- Route implementations: [`api-server/src/routes`](../api-server/src/routes)
- Broadcaster API client: [`api-server/src/services/broadcasterService.js`](../api-server/src/services/broadcasterService.js)
- Broadcaster HTTP runtime: [`scripts/headless-broadcaster-runtime.ts`](../scripts/headless-broadcaster-runtime.ts)
- Shared multiplayer contracts: [`shared/src`](../shared/src)

Update this document whenever a route, method, authentication rule, or runtime contract changes.
