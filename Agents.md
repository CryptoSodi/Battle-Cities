# AGENTS.md

## Project Overview
This project is based on:

https://github.com/dogballs/cattle-bity

The goal is to use this codebase as the foundation for a multiplayer Battle City-style game and build new features on top of it.

## Main Goal
Port and extend the project into a multiplayer game while keeping token usage low and avoiding unnecessary code exploration.

## Token Saving Rules
- Do not scan the full repository unless required.
- Start with only files related to the current task.
- Prefer targeted search by class, function, scene, asset, or folder name.
- Do not summarize unrelated files.
- Do not explain basic concepts unless asked.
- Keep responses short and implementation-focused.
- When changing code, show only changed files or patches unless complete files are requested.
- Avoid rewriting systems that already work.
- Do not inspect assets unless the task involves visuals, maps, sprites, or UI.

## Source Project
The original source is:

`dogballs/cattle-bity`

Treat this as the current base project.

## Project Direction
Build toward:
- Multiplayer gameplay.
- Online rooms/lobbies.
- Player synchronization.
- Enemy synchronization.
- Bullet synchronization.
- Match state synchronization.
- Score and win/loss tracking.
- Future extensible game modes.

## Work Rules
- Preserve the original game logic where possible.
- Make small, safe changes.
- Avoid large rewrites unless needed for multiplayer architecture.
- Separate networking logic from core gameplay logic.
- Keep shared gameplay rules deterministic where possible.
- Prefer server-authoritative multiplayer for important gameplay.
- Do not trust client-side damage, score, or match result decisions.
- Keep the code easy to extend.

## Multiplayer Architecture Rules
- Server should control:
  - Match state.
  - Enemy spawning.
  - Bullet hit validation.
  - Base destruction.
  - Player deaths.
  - Score updates.
  - Game over state.

- Client should control:
  - Local input.
  - Rendering.
  - UI.
  - Prediction only where safe.

## Search Strategy
Use this order:
1. Find game loop / main update loop.
2. Find player tank logic.
3. Find enemy tank logic.
4. Find bullet/projectile logic.
5. Find map/base/destruction logic.
6. Find UI/menu/state management.
7. Modify only the needed files.

## Response Style
- Be concise.
- Mention exact file paths.
- Explain only necessary decisions.
- Prefer patches over full rewrites.
- Ask before major architectural changes.