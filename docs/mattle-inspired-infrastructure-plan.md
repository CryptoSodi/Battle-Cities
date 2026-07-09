# Mattle-Inspired Infrastructure Plan

Last updated: 2026-07-09

## Goal

Build the infrastructure that made Mattle-style GameFi sticky, adapted to this
Battle City codebase:

- Trading volume that unlocks visible boost status.
- Utility staking.
- Seasons, phases, ranking, quests, and events.
- Airdrop eligibility and claims.
- Server-owned balances, rewards, and match results.

This should not become a second app beside the game. The economy/ranking layer
should grow out of the current wallet auth, player store, replay store, shop, and
match flow.

## Completed So Far

- [x] Separate website and API routing groundwork, including local/dev API
      parity.
- [x] Server-owned economy foundation:
  - [x] `server/economyStore.js`
  - [x] `api/economy/account.ts`
  - [x] `api/economy/purchase.ts`
  - [x] `src/shop/ShopManager.ts` server hydration and sync
- [x] Replay persistence now stores match metadata:
  - [x] score
  - [x] kills
  - [x] game result
  - [x] duration ticks
  - [x] match status
- [x] Replay list now shows newest-first with visible match status.
- [x] Replay validation endpoint wired for pending/verified/rejected status
      updates.

## Source Study

Studied:

- https://app.mattle.fun/whitepaper.pdf
- https://app.mattle.fun/trading
- https://app.mattle.fun/staking
- https://app.mattle.fun/boost
- https://app.mattle.fun/ranking
- https://app.mattle.fun/allocation
- https://app.mattle.fun/campaign
- https://app.mattle.fun/summer-event
- https://app.mattle.fun/kintara-airdrop
- https://app.mattle.fun/seeker-airdrop
- https://wiki.mattle.fun/characters
- https://wiki.mattle.fun/abilities
- https://wiki.mattle.fun/items
- https://wiki.mattle.fun/monsters

Raw browser access to some app routes is Cloudflare/JS-rendered, so the plan
uses the whitepaper, route text exposed by the browser/search renderer, and
visible navigation structure. Any unverified details are marked as design
targets, not copied facts.

## Mattle Mechanics To Adapt

### Trade-to-Boost

Mattle's whitepaper centers the loop around a trading terminal, token swaps,
tracked volume, boost status, and in-game traits.

Observed/confirmed ideas:

- Trading terminal is integrated with Raydium paths for token swaps.
- Trading volume maps into Boost Levels/status.
- Token groups:
  - Stable tokens: SOL, USDC, USDT. Volume does not create boosts.
  - Listed tokens: partner/top-tier assets, each mapped to a specific trait.
  - Unlisted tokens: verified Solana tokens, grouped together for Armor.
  - Hidden tokens: excluded from boost visibility/rewards.
- Eligible volume pairs are Listed/Stable or Unlisted/Stable.
- Boost panel shows total trading volume, boost percentages per trait, and token
  breakdown.
- Traits called out by the whitepaper: Health, Armor, Speed, Luck.

Trading Boost screen details supplied by the user:

- The page headline is "Trade and Boost".
- The swap form lets the user trade from SOL into MATTLE/another token.
- The page explains:
  - "Listed tokens boost specific traits via trading volume."
  - "Unlisted token volume combines to boost Armor."
- Listed tokens are displayed in a token-to-trait table.
- Example visible mappings:
  - MATTLE -> All Stats.
  - KINS -> Health.
  - SKR -> Speed.
  - POPCAT -> Luck.
  - PENGU -> Speed.
  - BONK -> Health.
  - SNS -> Speed.
  - HEGE -> Luck.
  - MASK -> Health.
  - CUDIS -> Armor.
  - STREAM -> Luck.
  - TRUMP -> Armor.
  - FARTCOIN -> Speed.
  - $WIF -> Health.
  - SEND -> Luck.
  - WORK -> Armor.
  - CHONKY -> Health.
  - MOUTAI -> Armor.
  - SOLCAT -> Speed.
  - Unlisted -> Armor.
- UX pattern to copy:
  - Top area: swap terminal plus short explanation.
  - Bottom area: searchable/filterable token boost catalog.
  - Each token row shows token icon/name, arrow, target trait, and info icon.

Battle City adaptation:

- Use the same "trade activity creates boost status" flywheel, but keep ranked
  fairness explicit.
- Recommended split:
  - Ranked/season leaderboards use server-validated match score and either no
    gameplay boosts or a separate "boosted" bracket.
  - Arcade/events can allow trade/stake boosts to affect fuel, loadout slots,
    drop rate, temporary shields, speed, or reward multipliers.
- All trade volume must be verified server-side from Solana transaction
  signatures before it changes any account state.
- Our token should map to "All Stats" or "All Perks" to make the native coin the
  strongest/cleanest boost asset.
- Unlisted tokens can safely map to Armor because they are broad, lower-trust
  volume and should not outperform curated listed tokens.

### Ranking, Seasons, Phases

Observed/confirmed ideas:

- Ranking page includes Hall of Fame.
- It exposes Gaming Rank and Trading Rank.
- The visible route showed Season 15, dated 21 Jun - 20 Jul.
- Ranking columns include Rank, Wallet, Perks, and Total Points.
- Whitepaper uses a unified Game Point metric for rankings and rewards.
- Mattle Run score uses survival time, monsters killed, damage dealt, win bonus,
  a per-match cap, and mode scaling.
- Game Points contribute to seasonal rewards and airdrop eligibility.
- Allocation route exposes phase rewards:
  - Phase 1: 15 May 2025 - 15 Oct 2025, 6M MATTLE prize pool.
  - Phase 2: 16 Oct 2025 - 10 Mar 2026, 4M MATTLE prize pool.
  - Phase 3: 11 Mar 2026 - 10 Jul 2026, live, 4M MATTLE prize pool.

Hall of Fame screen details supplied by the user:

- Page title is "Hall of Fame".
- Top summary shows the current user's:
  - Gaming Rank for the selected season, e.g. `Gaming Rank (S15)`.
  - Trading Rank across all time, e.g. `Trading Rank (all)`.
- Main tabs:
  - Gaming.
  - Trading.
- There is a season dropdown, e.g. `Season 15 (21 Jun - 20 Jul)`.
- Leaderboard columns:
  - Rank.
  - Wallet/player name.
  - Perks.
  - Total Points.
- Perks are shown as icon badges in leaderboard rows.
- Top ranks are color-highlighted.
- The season banner shows reward pool/prize visuals.

Battle City adaptation:

- Define seasons as first-class server records.
- Define phases as long-running reward windows that may span multiple seasons.
- Maintain separate rankings:
  - Game Points by season.
  - All-time Game Points.
  - Trading volume by season/all-time.
  - Event-specific leaderboards.
- Store snapshots so reward calculations cannot shift after a season closes.
- Keep Gaming Rank and Trading Rank as separate tabs by default.
- Show perk badges from staking/trading/shop/event systems, but make their
  effects explicit so users understand why a row has each badge.

### Events, Quests, Campaigns, Airdrops

Observed/confirmed ideas:

- Navigation groups Events and Rewards separately.
- Menus include Season, Phase, All Events, Heat Rush, Seeker, Kintara.
- Campaign route exposes Live and Ended tabs.
- Airdrop pages exist for Kintara and Seeker.
- Whitepaper states Game Points can determine airdrop eligibility during special
  events, including token allocations proportional to all-time Game Points.

Screenshot details supplied by the user:

- Phase Rewards page:
  - Title: "Welcome to Phase Rewards".
  - Phase cards show date range, status, phase number, and prize pool.
  - Visible examples:
    - Phase 3: 11 Mar 2026 - 10 Jul 2026, Live, 4M prize pool.
    - Phase 2: 16 Oct 2025 - 10 Mar 2026, Ended, 4M prize pool.
    - Phase 1: 15 May 2025 - 15 Oct 2025, Ended, 6M prize pool.
- Campaign page:
  - Title: "Welcome to Campaign".
  - Tabs: Live and Ended.
  - Campaign cards show image, date range, title, live badge, and prize pool.
  - Visible examples:
    - Mattle Run Season 15, 21 Jun - 20 Jul, $8000 prize pool.
    - Heat Rush summer event, 18 Jun - 08 Jul, $8000 prize pool.
    - Exclusive Loot for Kintara, 16 Jun - 20 Jul, $5000 prize pool.
    - Seeker Game Boost, 09 Feb - 30 Aug, $15000 prize pool.
- Heat Rush event page:
  - Event hero shows event name and date range.
  - Top event bar shows current event rank and a "View Leaderboard" action.
  - Event currencies include Shells and Ice Cubes.
  - Reward tracks unlock milestone rewards and final rewards.
  - Quest groups include Legacy Quests, Daily Tasks, and meme/social tasks.
  - Quest examples include Discord join/chat, X follow, reply URL submission,
    daily login, and complete 1 game.
- Heat Rush leaderboard modal:
  - Header explains that users complete quests, collect Shells, and climb the
    leaderboard.
  - Shows current user rank.
  - Shows reward tiers.
  - Table columns are Rank, Wallet, and Shells.
- Global nav pattern:
  - Top promotional ticker can point users into the live event.
  - Main nav includes Trading, Quests, Staking, Shop, and More.

Battle City adaptation:

- Treat "airdrop" as an eligibility and allocation system first.
- On-chain claim is a later integration once treasury/token mechanics are ready.
- Add quest/event definitions that can reward points, soft currency, fuel,
  loadout items, trophies, or allocation weight.
- Events should be config driven, not hardcoded scenes.
- Rename event flavor to our game world:
  - Heat Rush style events become tank operations, warfronts, sieges, or
    seasonal battle campaigns.
  - Shells/Ice Cubes become medals, bolts, intel, scrap, fuel cells, or event
    badges.
  - Social quests are optional growth tasks; core progress should come from
    actual Battle City matches, boss clears, enemy waves, and team objectives.

### Staking

Observed/confirmed ideas from whitepaper:

- Holding/staking token can reduce trading fees.
- Staking can unlock passive rewards and gameplay enhancements.
- Token utility includes in-game purchases, temporary trait boosting, seasonal
  access/event entry, character upgrades, premium modes, tournaments, listing
  fees, reward pooling, burns, and governance.

Battle City adaptation:

- Start with utility staking, not pure yield.
- Staking perks should be things we can defend:
  - Fuel regeneration discount/bonus.
  - Event entry tier.
  - Cosmetic/trophy access.
  - Trading fee discount once real swaps exist.
  - Reward multiplier caps for unranked/events.
- Do not launch real yield or payout promises without legal review.

Mattle staking details supplied by the user:

- Users lock MATTLE tokens and earn monthly rewards.
- Staking rewards are funded from Mattle Shop revenue.
- A Staking Point (SP) accounting system determines reward share.
- `1 staked MATTLE = 1 SP per day`.
- More tokens and longer staking duration create more SP.
- Rewards are distributed in fixed 30-day epochs.
- SP resets at the start of each epoch.
- SP accumulates daily during the epoch and is finalized at epoch end.
- Reward formula:
  - `userReward = (userTotalSP / totalCommunitySP) * epochReward`
- Users can stake any amount at any time and start earning SP immediately.
- Unstaking stops SP accumulation for the unstaked amount.
- Unstaking has a 10-day cooldown before tokens can be claimed.
- Tokens in cooldown do not earn SP.
- Daily snapshot happens at 23:59 UTC.
- The end-of-day staking balance earns the daily SP.
- Latest SP is yesterday's SP and is added to Total SP automatically.
- Epoch rewards can be claimed until the end of the next epoch.
- Minimum claim threshold is 1 MATTLE.

Staking screen details supplied by the user:

- Header shows the active epoch and day, e.g. `Epoch 7 - Day 11/30`.
- Community Stats column:
  - Locked Tokens.
  - Staking Point (SP).
  - Epoch Reward.
  - Estimated APR.
  - Link to SP leaderboard.
- Your Stats panel:
  - Your Stake.
  - Latest SP.
  - Total SP.
  - Estimated Reward.
  - Stake and Unstake actions.
  - Unstake Position table with token, cooldown, and action columns.
- SP Leaderboard modal:
  - Columns: Rank, Wallet, Stake Amount, Total SP.
  - Top ranks are color-highlighted.
  - Close action is a simple modal X.

Revenue split note:

- The supplied text says rewards are funded by 50% of Mattle Shop revenue in one
  place.
- It later says 40% funds staking rewards, 30% funds in-game rewards, and 30% is
  burned.
- For our implementation, choose one explicit split before launch. The cleaner
  starting model is:
  - 40% staking epoch rewards.
  - 30% in-game/season rewards.
  - 30% burn or buyback/burn.

### Staking Economics For Our Token

Staking benefits the token by creating demand, reducing liquid supply, and
turning the token into an access/reward asset rather than only a speculative
coin.

Core loop:

- Players buy or hold the token to stake.
- Staked tokens are locked in a vault, reducing circulating sell pressure.
- Longer lock tiers reduce short-term dumping.
- Staking unlocks game perks, event access, airdrop weight, and season reward
  eligibility.
- A share of shop/event/trading revenue can fund seasonal reward pools.
- Rewards should be based on stake plus activity, so players cannot stake once
  and disappear.

Recommended reward model:

- Mattle-style base model:
  - `dailySP = endOfDayStakedAmount`
  - `epochSP = sum(dailySP across the 30-day epoch)`
  - `playerReward = epochRewardPool * playerEpochSP / totalEpochSP`
- Optional BattleCity extension:
  - `adjustedSP = epochSP * lockMultiplier * activityMultiplier`
  - Use this only if we want staking rewards to also reward active players.

Possible revenue routing:

- Mattle-style split:
  - 40% staking epoch rewards.
  - 30% in-game/season rewards.
  - 30% burn or buyback/burn.
- Alternative conservative split:
  - 50% treasury/operations/liquidity.
  - 30% seasonal staking + player reward pool.
  - 10% buyback or burn.
  - 10% future events, airdrops, or creator/partner pools.

Use cautious wording. Avoid promising fixed profit, guaranteed APR, or dividends.
Frame rewards as variable season reward pools funded by treasury/game activity.

## Boost Page Details

Mattle separates the trading page from a boost status page. The boost page is
important because it turns wallet/economy activity into visible game status.

Screenshot details supplied by the user:

- Page title: "Boost".
- Top summary shows:
  - Health Boost.
  - Armor Boost.
  - Speed Boost.
  - Luck Boost.
- Main panel shows 30-day trading volume.
- Main table columns:
  - Asset.
  - Type.
  - Perks.
  - Volume.
- Empty state says no trades were recorded in the last 30 days and prompts the
  user to start trading to boost in-game traits.
- Actions include Receive and Send.
- Side panel includes Shop Perks.
- Side panel includes Staking Perks with current level, progress, and tier table.
- Visible staking perk tiers:
  - Level 0, stake 0: +0% Health, +0% Armor, +0% Speed, +0% Luck.
  - Level 1, stake 2000: +2% Health, +3% Armor, +2% Speed, +3% Luck.
  - Level 2, stake 10000: +5% Health, +8% Armor, +5% Speed, +8% Luck.
  - Level 3, stake 50000: +10% Health, +15% Armor, +10% Speed, +15% Luck.
  - Level 4, stake 200000: +20% Health, +30% Armor, +20% Speed, +30% Luck.

Battle City adaptation:

- Keep this as a status dashboard for all active perks:
  - Shop perks.
  - Staking perks.
  - Trading perks.
  - Event perks.
- Rename traits to our tank language where helpful:
  - Health = Hull.
  - Armor = Armor.
  - Speed = Engine.
  - Luck = Salvage/Drop Chance.
- For ranked fairness, display whether each perk applies to Ranked, Events,
  Arcade, or Rewards Only.

## Wiki / Lore Adaptation

Use Mattle's wiki structure, not its lore. Our wiki should teach players about
our Battle City world: player tanks, enemy tanks, weapons/modules, and powerups.

Mattle wiki structure observed in screenshots:

- Header: "MATTLE WIKI".
- Tabs:
  - Characters.
  - Abilities.
  - Items.
  - Monster.
- Character/ability/monster pages use collectible card grids.
- Item pages use larger detail rows with item art, description, acquisition
  source, and a "View Item Demo" action.

Battle City wiki structure:

- `Our Tanks`
  - Replaces Mattle Characters.
  - Catalog player tank classes, skins, commanders, and factions.
  - Example categories: Scout Tank, Assault Tank, Heavy Tank, Engineer Tank,
    Artillery Tank, Flame Tank, Ice Tank, Boss Hunter.
- `Weapons & Modules`
  - Replaces Mattle Abilities.
  - Catalog tank abilities and upgrades.
  - Examples: Cannon, Twin Shot, Rockets, Mine Layer, Shield, Freeze Blast,
    Overdrive, Repair Kit, Radar, Magnet, Cooldown+, Projectiles+.
- `Powerups`
  - Replaces Mattle Items.
  - Catalog in-match pickups and shop consumables.
  - Existing direction can include Shield, Base Defence, Freeze, Speed, Upgrade,
    Zoom Out, Wipeout, Extra Life, Repair Kit, Magnet, Bomb, and fuel rewards.
- `Enemy Tanks`
  - Replaces Mattle Monster.
  - Catalog enemy tank families and bosses.
  - Examples: Scout, Rapid, Armored, Heavy, Drop Carrier, Base Breaker, Turret
    Tank, Mine Tank, Artillery Boss, Siege Boss, seasonal enemy variants.

Wiki requirements:

- Each entry should have:
  - Name.
  - Pixel art/icon.
  - Role/type.
  - Short lore line.
  - Gameplay stats or effect.
  - Unlock/acquire source where relevant.
- Wiki content can start as static JSON in the client.
- Later, admin-managed wiki content can move server-side if needed.
- Do not copy Mattle's character, monster, or item roster literally.

## Current Repo Fit

Existing anchors:

- Wallet/guest sessions: `api/session.ts`, `server/sessionStore.js`,
  `server/walletAuth.js`.
- Player records: `api/player.ts`, `server/playerStore.js`.
- Replay records: `api/replays.ts`, `server/replayStore.js`.
- Shop model: `src/shop/ShopManager.ts`, `src/shop/ShopTypes.ts`.
- Shop UI: `src/scenes/main/MainShopScene.ts`.
- Match points/highscore flow: `src/scenes/main/MainHighscoreScene.ts`,
  `src/points/PointsHighscoreManager.ts`.
- Fuel/start hook already exists in `src/scenes/main/MainMenuScene.ts`.

Important current limitation:

- Shop balances, fuel, inventory, wallet-connected state, and mock tx hashes are
  local-storage only.
- There is no server-owned ledger yet.
- There is no server result submission for rankings yet.
- Replays exist, but validation status is only stored as pending.

## Architecture Rules

- Keep the website and API deployable separately:
  - website on `battlecities.com`
  - API on `api.battlecities.com`
  - database only reachable by the API
- Server owns account state, balances, rewards, seasons, rankings, claims, and
  transaction ingestion.
- Client owns UI, wallet signing, rendering, and local responsiveness.
- Never trust client-submitted score, damage, deaths, rewards, or final result.
- Every transaction signature is idempotent and stored once.
- Every reward is a ledger entry with reason, source id, and season/phase/event
  context when applicable.
- Trading/staking integrations must be non-custodial by default.
- Gameplay boosts must be separated from ranked fairness.
- Keep storage compatible with the existing pattern:
  - Postgres when configured.
  - Local JSON files for dev/fallback where practical.

## Core Data Model

Add server stores/tables incrementally.

### Economy

- `battlecity_accounts`
  - `player_id`
  - `wallet_address`
  - `soft_balance`
  - `fuel_balance`
  - `created_at`
  - `updated_at`
- `battlecity_ledger_entries`
  - `id`
  - `player_id`
  - `wallet_address`
  - `currency`
  - `amount`
  - `reason`
  - `source_type`
  - `source_id`
  - `season_id`
  - `phase_id`
  - `event_id`
  - `created_at`
- `battlecity_wallet_transactions`
  - `signature`
  - `wallet_address`
  - `kind`
  - `status`
  - `amount`
  - `mint`
  - `recipient`
  - `raw_summary`
  - `created_at`

### Shop/Inventory

- `battlecity_inventory_items`
  - `player_id`
  - `item_id`
  - `quantity`
  - `updated_at`
- `battlecity_loadouts`
  - `player_id`
  - `slot`
  - `item_id`
  - `updated_at`
- `battlecity_shop_catalog`
  - optional later if catalog stops being static TS config.

### Matches/Rankings

- `battlecity_match_results`
  - `id`
  - `player_id`
  - `wallet_address`
  - `season_id`
  - `event_id`
  - `mode`
  - `seed`
  - `replay_id`
  - `score`
  - `game_points`
  - `kills`
  - `damage_dealt`
  - `survival_seconds`
  - `won`
  - `validation_status`
  - `created_at`
- `battlecity_leaderboard_rows`
  - materialized/snapshot rows for season/event/all-time rankings.
  - include `rank`, `player_id`, `wallet_address`, `display_name`,
    `points`, `scope`, `season_id`, `perk_badges_json`, `snapshot_at`.

### Seasons/Events/Quests

- `battlecity_seasons`
  - `id`, `name`, `starts_at`, `ends_at`, `status`, `reward_pool`
- `battlecity_phases`
  - `id`, `name`, `starts_at`, `ends_at`, `status`, `reward_pool`
- `battlecity_events`
  - `id`, `slug`, `name`, `starts_at`, `ends_at`, `status`, `rules_json`
- `battlecity_quests`
  - `id`, `event_id`, `name`, `metric`, `target`, `reward_json`
- `battlecity_quest_progress`
  - `player_id`, `quest_id`, `value`, `claimed_at`
- `battlecity_event_currency_balances`
  - `player_id`, `event_id`, `currency`, `amount`, `updated_at`
- `battlecity_event_leaderboard_rows`
  - materialized/snapshot rows for event-specific currencies or points.
  - include `rank`, `player_id`, `wallet_address`, `display_name`,
    `event_id`, `metric`, `points`, `snapshot_at`.
- `battlecity_event_reward_tracks`
  - `id`, `event_id`, `currency`, `threshold`, `reward_json`, `sort_order`

### Trading/Boost

- `battlecity_token_catalog`
  - `mint`, `symbol`, `name`, `icon_url`, `group`, `trait`, `enabled`,
    `featured`, `sort_order`
- `battlecity_trading_volume`
  - `player_id`, `wallet_address`, `mint`, `stable_mint`, `volume_usd`,
    `season_id`, `source_signature`, `swap_from_mint`, `swap_to_mint`
- `battlecity_boost_status`
  - materialized per player/season: All Stats, Health, Armor, Speed, Luck
    percentages.

### Staking/Airdrops

- `battlecity_staking_positions`
  - `player_id`, `wallet_address`, `mint`, `amount`, `lock_tier`,
    `starts_at`, `ends_at`, `status`, `source_signature`
- `battlecity_staking_epochs`
  - `id`, `starts_at`, `ends_at`, `status`, `reward_pool`,
    `total_sp`, `closed_at`
- `battlecity_staking_snapshots`
  - `epoch_id`, `snapshot_date`, `player_id`, `wallet_address`,
    `staked_amount`, `daily_sp`, `total_sp_after_snapshot`
- `battlecity_unstake_requests`
  - `id`, `player_id`, `wallet_address`, `amount`, `requested_at`,
    `claimable_at`, `claimed_at`, `status`, `source_signature`
- `battlecity_staking_rewards`
  - `epoch_id`, `player_id`, `wallet_address`, `total_sp`,
    `reward_amount`, `claimed_at`, `claim_signature`
- `battlecity_airdrop_campaigns`
  - `id`, `slug`, `name`, `starts_at`, `ends_at`, `allocation_pool`,
    `rules_json`
- `battlecity_airdrop_allocations`
  - `campaign_id`, `player_id`, `wallet_address`, `points_weight`,
    `allocation_amount`, `claimed_at`, `claim_signature`

### Wiki

- Start as static client JSON:
  - tanks.
  - weapons/modules.
  - powerups.
  - enemy tanks.
- Optional later table: `battlecity_wiki_entries`
  - `id`, `category`, `slug`, `name`, `icon_url`, `role`, `lore`,
    `stats_json`, `acquire_source`, `sort_order`, `enabled`

## API Plan

Add endpoints in the API deployment (`api.battlecities.com`) using the
existing Vercel handler style.

- `GET /api/economy/account`
  - Current server balance, fuel, inventory, loadout, boost status.
- `POST /api/economy/purchase`
  - Server-side purchase with soft currency first.
- `POST /api/economy/verify-transaction`
  - Verify a wallet transaction signature and credit the ledger idempotently.
- `GET /api/seasons/current`
  - Current season, phase, reward windows.
- `GET /api/rankings?scope=gaming|trading&seasonId=...`
  - Leaderboard rows, user rank summary, season dropdown options, and perk
    badge metadata.
- `POST /api/matches/submit`
  - Submit replay/result artifact; server stores pending result.
- `POST /api/matches/validate`
  - Later: worker/admin path to validate/re-sim and publish score.
- `GET /api/events`
  - Live/ended event list.
- `GET /api/events/:slug`
  - Event hero, reward tracks, event currencies, quests, and user rank.
- `GET /api/events/:slug/leaderboard`
  - Event leaderboard rows and reward tier metadata.
- `GET /api/quests`
  - Active quests and player progress.
- `POST /api/quests/claim`
  - Claim completed quest reward through ledger.
- `GET /api/staking/positions`
  - Player staking status and perks.
- `GET /api/staking/summary`
  - Community stats, epoch/day, player stats, unstake positions, and estimated
    reward.
- `GET /api/staking/leaderboard`
  - SP leaderboard rows with rank, wallet, stake amount, and total SP.
- `POST /api/staking/verify`
  - Verify stake/unstake tx signature.
- `POST /api/staking/stake`
  - Dev/off-chain staking action first; later returns/signs verified on-chain
    staking instructions.
- `POST /api/staking/unstake`
  - Starts unstake cooldown.
- `POST /api/staking/claim`
  - Claims claimable unstaked tokens or epoch reward depending on request type.
- `GET /api/trading/tokens`
  - Token groups and trait mapping.
- `POST /api/trading/verify-swap`
  - Verify swap signature, derive eligible volume, update boost status.
- `GET /api/boost/status`
  - Current Health/Hull, Armor, Speed/Engine, Luck/Salvage boosts, 30-day
    trading volume, shop perks, staking perk tier, and perk applicability.
- `GET /api/airdrops/:slug/eligibility`
  - Allocation/eligibility for current wallet.
- `POST /api/airdrops/:slug/claim`
  - Mark claim or verify on-chain claim later.

## Client Plan

Keep the current canvas app but add new main-menu scenes and service clients.

- `src/economy/`
  - `EconomyClient`
  - `EconomyTypes`
  - `Ledger/Account` DTOs
- `src/ranking/`
  - `RankingClient`
  - `SeasonTypes`
- `src/events/`
  - `EventClient`
  - `QuestTypes`
- `src/trading/`
  - `TradingClient`
  - token/boost DTOs
- `src/staking/`
  - `StakingClient`
- `src/wiki/`
  - static wiki data and DTOs for tanks, weapons/modules, powerups, and enemy
    tanks.
- Scenes:
  - `MainRankingScene`
  - `MainSeasonScene`
  - `MainEventsScene`
  - `MainQuestScene`
  - `MainAirdropScene`
  - `MainTradingScene`
  - `MainStakingScene`
  - `MainBoostScene`
  - `MainWikiScene`
  - later `MainProfileScene`, `MainTreasuryScene`, `MainHistoryScene`,
    `MainTrophiesScene`

Migration path for the current shop:

1. Keep `ShopManager` API stable for scenes.
2. Add a server-backed implementation behind it.
3. Keep local storage fallback for dev/offline.
4. Replace mock tx hashes with server ledger ids or verified signatures.

## Build Order

### Milestone 1 - Server Economy Foundation

Purpose: make balances, fuel, inventory, and purchases server-owned.

Tasks:

- Add `server/economyStore.js`.
- Add account, ledger, inventory, and loadout schema.
- Add `api/economy/account.ts`.
- Add `api/economy/purchase.ts`.
- Change `ShopManager` to hydrate from server when authenticated.
- Keep local fallback for dev/guest.

Acceptance:

- Wallet login sees persistent server fuel/balance/inventory.
- Shop purchase creates ledger entry.
- Reload/browser switch preserves account state.
- Local dev still works without Postgres.

### Milestone 2 - Match Results, Seasons, Ranking

Purpose: launch the leaderboard and season spine.

Tasks:

- Add `server/seasonStore.js`.
- Add `server/matchResultStore.js`.
- Add current season seed data.
- Add `api/seasons/current.ts`.
- Add `api/matches/submit.ts`.
- Submit score/result when `MainHighscoreScene` finishes.
- Add `api/rankings.ts`.
- Add rank summary response for current player: Gaming Rank by selected season
  and Trading Rank all-time.
- Add perk badge metadata to leaderboard rows.
- Add `MainRankingScene` and `MainSeasonScene`.

Acceptance:

- Each completed wallet match creates a pending/accepted result.
- Current season leaderboard displays ranked rows.
- Gaming rank is by server-stored Game Points, not local highscore.
- Hall of Fame has Gaming and Trading tabs.
- Season selector switches Gaming Rank rows by season.
- Rows show Rank, Wallet, Perks, and Total Points.

### Milestone 3 - Quests, Events, Phase Rewards

Purpose: create the campaign/event layer before real token rewards.

Tasks:

- Add events, phases, quests stores.
- Add live/ended event APIs.
- Add campaign card model with image, date range, status, and prize pool.
- Add phase reward card model with phase window and reward pool.
- Add event currencies and reward tracks.
- Add event leaderboard endpoint for event currencies/points.
- Add quest progress updates from match results.
- Add claim flow through ledger.
- Add event/quest/phase scenes.
- Add event ticker/banner entry point to the main nav.

Acceptance:

- Live and ended events render.
- Phase Rewards page shows live/ended phase cards.
- Campaign page shows live/ended campaign cards.
- Event page shows quest groups, event currencies, reward tracks, and player
  rank.
- Event leaderboard modal displays Rank, Wallet, and event score/currency.
- Completing a match can progress a quest.
- Claiming a quest reward creates ledger entries.

### Milestone 4 - Staking V1

Purpose: ship utility staking safely.

Tasks:

- Add staking position store.
- Add staking epoch, daily snapshot, unstake request, and staking reward stores.
- Define stake tiers and perk rules.
- Start with off-chain/dev staking for soft currency or test token.
- Add daily SP calculation:
  - `dailySP = endOfDayStakedAmount`
  - `totalSP = sum(dailySP in the active epoch)`
- Add 10-day unstake cooldown in dev mode.
- Add SP leaderboard endpoint.
- Add `MainStakingScene`.
- Add perk calculation to account response.
- Add staking summary cards:
  - Locked Tokens.
  - Staking Point.
  - Epoch Reward.
  - Estimated APR/reward range, if enabled.
  - Your Stake.
  - Latest SP.
  - Total SP.
  - Estimated Reward.
- Add unstake position table.

Acceptance:

- A wallet can stake/unstake in dev mode.
- Unstake creates a cooldown position before claim.
- Daily snapshot script/job can calculate SP idempotently.
- SP leaderboard displays rank, wallet, stake amount, and total SP.
- Epoch reward calculation can be dry-run from SP totals.
- Staking tier affects non-cash perks like fuel discount or event access.
- Perks are visible in account/season UI.

### Milestone 5 - Trading And Boost V1

Purpose: implement the key Mattle-style flywheel.

Tasks:

- Add token catalog and boost rules.
- Add trading volume store.
- Add token list and boost status APIs.
- Add boost status API that aggregates shop, staking, trading, and event perks.
- Add token-to-trait catalog UI: Featured/All tabs, filter, icon/name, trait,
  info tooltip.
- Add swap terminal UI: from token, to token, balance, 50%/100% quick amounts,
  swap action.
- Add Boost page with:
  - Health/Hull, Armor, Speed/Engine, and Luck/Salvage summary.
  - 30-day trading volume.
  - Asset/Type/Perks/Volume table.
  - Shop Perks side panel.
  - Staking Perks level/progress table.
- Add Raydium quote/swap UI after backend verification contract is clear.
- Add swap signature verification against Solana RPC.
- Add `MainTradingScene` and `MainBoostScene`.

Acceptance:

- Verified swap signature creates a trading-volume record once.
- Eligible volume updates All Stats/Health/Armor/Speed/Luck boost status.
- Listed tokens boost their configured trait.
- Unlisted token volume combines into Armor.
- Native project token boosts All Stats/All Perks.
- Boost page clearly states where each perk applies: Ranked, Events, Arcade, or
  Rewards Only.
- Trading and gaming leaderboards are separate.

### Milestone 5.5 - Wiki V1

Purpose: create a game knowledge base that fits our lore.

Tasks:

- Add static wiki data for our tanks, weapons/modules, powerups, and enemy
  tanks.
- Add `MainWikiScene`.
- Add tabbed wiki UI using the Mattle-style book/card layout.
- Add detail cards for powerups with effect and acquire source.
- Link wiki from the More menu.

Acceptance:

- Wiki does not use Mattle character/monster names as our production lore.
- Tanks, enemy tanks, weapons/modules, and powerups are readable in-game.
- Existing shop/game powerups are represented before adding new lore-only
  entries.

### Milestone 6 - Airdrop System

Purpose: turn seasons/events into allocation mechanics.

Tasks:

- Add airdrop campaign store.
- Add eligibility calculation from Game Points, quests, staking tier, and/or
  trading volume.
- Add allocation snapshot job/script.
- Add `MainAirdropScene`.
- Later: generate Merkle root or integrate distributor program.

Acceptance:

- Wallet can view eligibility.
- Admin/script can freeze allocations.
- Claim state is idempotent.

### Milestone 7 - Security, Admin, Compliance

Purpose: make the system survivable before real value.

Tasks:

- Add admin-only scripts for season close and allocation snapshots.
- Add replay/result validation worker.
- Add treasury wallet config and tx audit logs.
- Add rate limits for tx verification and match submit.
- Add restricted-region/compliance hooks before payouts/yield.

Acceptance:

- No duplicated rewards from repeated signatures or repeated claims.
- Season rewards can be closed and audited.
- Real-money features remain disabled behind explicit config flags.

## Immediate Next Step

Recommended first implementation after this document:

1. Build Milestone 1 server economy foundation.
2. Move the existing shop off mock local balances while preserving its UI.
3. Then build Milestone 2 leaderboard/seasons on top of the same ledger/account
   identity layer.

This order makes staking, trading, quests, seasons, and airdrops much simpler
because they all become ledger/account events instead of separate one-off
features.

## Open Decisions

- What is the final token symbol/name for this game?
- Which Solana RPC provider should verify swaps/staking transactions?
- What is the treasury wallet address?
- Should trade/stake boosts affect ranked gameplay, or only unranked/events?
- Should season rewards be soft currency first, token allocation later?
- Which jurisdictions should be blocked before real payouts/yield?
- Do we want an admin dashboard, or scripts-only for the first version?
