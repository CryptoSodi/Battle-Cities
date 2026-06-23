# BattleCity — Project Roadmap & Decisions

> Living record of where this project is headed. Last updated: 2026-06-22.

## 1. What this is

A Battle City–style tank game built on the `cattle-bity` codebase (clone of Namco's Battle City, 1985), written from scratch in **TypeScript** with a **custom canvas/WebGL engine** — no Phaser/Unity. Currently a **client-only static site** deployed on Vercel: 1–2 local players, 35 original maps, a level editor, gamepad support. Recently added: camera system, editor-mode tile/enemy/brink features, responsive layout.

The goal is to turn it into a polished arcade game with **its own Solana crypto coin**, inspired by **mattle.fun**.

## 2. Current priority (set 2026-06-22)

**GAME + ART FIRST. The economy and coin are explicitly deferred.**

Build the gameplay and the HD art overhaul now. All money/crypto features come later, designed behind swappable interfaces so they bolt on without a rewrite.

## 3. Art direction

High-detail HD pixel art inspired by **Metal Slug, Eastward, Blazing Chrome**, and classic SNK arcade games. Top-down. Hand-crafted pixel work: rich metallic shading, strong highlights, deep shadows, subtle ambient occlusion, vibrant high-contrast palettes, crisp pixel-perfect edges (no anti-aliasing/blur), battle-worn textures, readable silhouettes, dynamic pixel lighting, glowing effects, cinematic explosions/smoke/sparks. Target 32×32–64×64 sprite resolution. (Full canonical prompt kept in Claude memory.)

### Production method
- **No text-to-image/diffusion model is available in the current toolchain.** Art is **authored programmatically as real PNG sprites** the engine loads. This is a large upgrade over the NES-era art; for AAA diffusion sprites later, the same pipeline ingests them.
- **Process:** prove the style on a hero sprite (player tank) → get approval → fan out the full set (tank tiers, enemies, terrain, effects, UI) → bake to PNG sheet(s) + update `data/sprite.manifest.json`.

### Current asset sizes to match/replace
- Terrain tiles: brick 16px; steel/water/jungle/ice 32px.
- Tank frames: ~52–60px in the sheet (2 animation frames per direction × 4 directions).
- Explosions up to ~136px; powerups ~64px.

## 4. Game roadmap

### Milestone 1 — Vertical slice (chosen first milestone)
One polished, demoable match that closes the **earn → spend → play** loop, **fully off-chain** with soft currency:
1. Economy spine — `LedgerService` interface + soft-currency balance/transactions (local now, server/Solana later).
2. Fuel-to-start — a resource consumed to begin a match; regenerates or is bought.
3. Shop + powerups — buy boosts (wired into existing `powerup` system); purchases persist.
4. Reward loop — match completion awards currency by score.
5. Art re-skin (slice scope) — player tank, 1–2 enemies, core tiles, one explosion set, + the reusable art pipeline.
6. HUD — fuel meter, balance, shop button, in the new style.

(With game-first priority, art + core gameplay polish lead; economy pieces are stubbed behind interfaces.)

### Later — multiplayer
Per `Agents.md`: server-authoritative online play (match state, enemy/bullet validation, scores). Required before any real-prize tournaments.

## 5. Economy & coin (DEFERRED — design only)

Inspired by **mattle.fun** (Solana GameFi "trade-to-power" arena: trading buffs in-game stats; Shop, Staking, Ranking; native SPL token `$MATTLE`, pump.fun-style, tradeable in Phantom; market cap only ~$2.4K late May 2026 — a mechanics template, not a proof of success).

### Non-custodial model (per user)
- **No deposits.** Players buy fuel/powerups directly through **Phantom** — each purchase is its own on-chain transaction (wallet → treasury).
- Server **verifies the tx** (amount, recipient, idempotent by signature) and credits an **entitlement keyed to the wallet address**. Consuming items is off-chain (instant, no mid-match signing).
- Team holds a **treasury** (revenue + prize pool) but **never custodies player funds**.
- **Tournaments:** winners paid treasury → winner wallet, **only after server-validated results**.

### Recommendations (Claude)
- Price fuel/powerups in the **project coin** so playing drives coin demand (allow SOL-pay with auto-swap under the hood for UX).
- **Utility-staking** (buffs / fuel discounts / tournament tiers) rather than pure yield.
- **Multisig treasury** (Squads) + publish payout txs for trust.
- A **no-purchase entry path** (sweepstakes-style) to lower gambling exposure.
- Powerups/skins as tradeable NFTs — later flywheel, parked.

### Compliance flags
Stake-to-earn / play-to-earn with real payouts is **securities- and gambling-sensitive**. Isolate the earn/withdraw surface, geofence restricted regions, and **get legal counsel before flipping any real cash-out switch**. Server-authoritative anti-cheat is mandatory once real prizes exist.

## 6. Decision log

| Date | Decision |
|------|----------|
| 2026-06-22 | First milestone = off-chain vertical slice (earn → spend → play). |
| 2026-06-22 | Token: when tokenized, launch on **Solana (SPL)**; gameplay never on-chain. |
| 2026-06-22 | Art: AI-style HD pixel art, authored in code (no diffusion tool available); hero-first then fan out. |
| 2026-06-22 | Economy model = stake/play-to-earn, **non-custodial** via Phantom, no deposits, team-paid tournament payouts. |
| 2026-06-22 | **Reprioritized: build GAME + ART first; economy + coin deferred.** |
