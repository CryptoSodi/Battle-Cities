# Web3 Planning Prompt

We are building a Web3 crypto game variation of Battle City called Battle Cities.

The current codebase is based on dogballs/cattle-bity and is being extended into a multiplayer browser game. The game side is being handled separately first: dynamic maps, construction/editor tools, responsive canvas, stable gameplay loop, and eventually authoritative multiplayer.

Your task is to plan the Web3 layer only. Do not modify gameplay code yet. Design the Web3 product, economy, progression, and backend architecture so it can later be integrated into the game.

Context:
- Inspiration: mattle.fun
- Mattle.fun appears successful because it links on-chain activity to gameplay progression, rankings, events, and repeatable play.
- We do not want to blindly copy it.
- We want Battle Cities to stay skill-first and not become pay-to-win.
- Web3 should amplify retention, social competition, progression, ownership, and tournaments.
- The core game should remain playable without wallet connection.
- Wallet connection should unlock extra progression, cosmetics, events, and rewards.

Main product concept:
"Trade or participate on-chain to prepare your war machine, then prove your skill in short destructible multiplayer tank battles."

Important design rules:
- Do not make raw spending equal raw combat power.
- Do not allow whales to dominate ranked gameplay.
- Keep ranked PvP fair.
- Use server-authoritative gameplay for matches.
- Do not put gameplay logic on-chain.
- Do not do per-match blockchain transactions.
- Web3 should mostly handle identity, ownership, passes, rewards, cosmetics, token utility, and tournament access.
- The server should validate match results, scores, base destruction, player deaths, and rewards.
- The client should not be trusted for damage, score, or match outcome.

Design the following in detail:

1. Web3 Product Vision
- What is the Web3 identity of Battle Cities?
- What makes it different from a normal Battle City clone?
- What should players feel they own, earn, and compete for?
- What is the simplest explanation for non-crypto users?

2. Core Web3 Game Loop
Design the loop inspired by mattle.fun:
on-chain activity -> game progression/prep -> battle performance -> rankings/rewards -> repeat

Adapt this specifically for Battle Cities:
- wallet actions
- battle preparation
- tank loadouts
- seasonal progression
- tournaments
- rewards
- cosmetics
- factions/clans

3. Player Segments
Design for:
- guest players
- wallet-connected free players
- battle pass holders
- token holders
- competitive tournament players
- guild/clan/faction players
- whales without letting them break ranked fairness

4. Economy Design
Create a clean economy with multiple resources:
- fungible token
- off-chain season points
- off-chain soft currency like Scrap
- energy/resource like Fuel
- cosmetics/inventory items
- tournament tickets
- optional NFT battle pass or commander pass

For each resource explain:
- how it is earned
- how it is spent
- whether it is on-chain or off-chain
- whether it resets
- how it affects gameplay
- abuse risks

5. Token Utility
Design utility for the token without making it pay-to-win:
- tournament entry
- premium pass
- cosmetics
- marketplace fees
- faction events
- staking/holding bonuses
- governance-lite voting
- creator/community map rewards

Also list what the token should NOT do.

6. NFT / Pass Design
Decide whether Battle Cities should use:
- NFT commander pass
- seasonal battle pass
- cosmetic NFTs
- tank skins
- base skins
- faction banners
- map ownership or creator badges

Explain what should be MVP and what should wait.

7. Ranked Fairness Rules
Define rules for ranked PvP:
- what Web3 bonuses are allowed
- what bonuses are banned
- what belongs only in casual/PvE/event modes
- how to cap boosts
- how to prevent wallet advantage from ruining skill-based play

8. Game Modes and Web3 Integration
Design Web3 usage for:
- ranked 1v1
- casual PvP
- 2v2 squad mode
- PvE base defense/survival
- weekend tournaments
- seasonal faction campaign
- creator/custom maps

9. Seasonal System
Design seasons:
- duration
- season points
- rank reset
- battle pass
- rewards
- top leaderboard prizes
- faction score
- tournament schedule
- end-of-season claim flow

10. Quest System
Design daily/weekly/seasonal quests:
- gameplay quests
- wallet quests
- partner quests
- social/community quests
- anti-bot rules
- reward types

11. Tournament System
Design:
- entry rules
- ticket/token/pass requirements
- brackets vs score attack
- anti-cheat
- prize distribution
- sponsor/partner events
- spectator potential

12. Backend Architecture
Design backend services needed:
- auth service
- wallet verification
- player profile
- inventory
- season service
- leaderboard service
- quest service
- rewards service
- tournament service
- admin/liveops panel
- analytics/events

Assume gameplay server is authoritative and separate from Web3/backend services.

13. Smart Contract Scope
Design minimal smart contract scope:
- token contract
- NFT/pass contract if needed
- reward claim contract
- marketplace integration if needed

Avoid on-chain gameplay. Explain why.

14. Anti-Abuse and Security
Plan for:
- botting
- fake match results
- multi-wallet farming
- leaderboard manipulation
- quest abuse
- replay attacks
- wallet signature safety
- reward claim abuse
- tournament cheating

15. MVP Scope
Create a lean MVP for the Web3 layer only.

MVP should include:
- wallet connect
- guest account linking
- profile
- season points
- leaderboard
- premium pass or pass verification
- cosmetic inventory
- one tournament/event system
- one simple reward claim flow
- admin controls for rewards/events

Do not include too much blockchain complexity in MVP.

16. Phased Roadmap
Break into:
- Phase 0: game core dependency assumptions
- Phase 1: Web3 MVP
- Phase 2: tournaments and seasons
- Phase 3: token/cosmetic economy
- Phase 4: faction campaigns and creator maps
- Phase 5: advanced marketplace/social systems

17. Data Models
Propose backend data models for:
- User
- Wallet
- PlayerProfile
- Season
- SeasonProgress
- InventoryItem
- Cosmetic
- Quest
- QuestProgress
- Tournament
- TournamentEntry
- MatchResult
- RewardClaim
- TokenHoldingSnapshot
- BattlePass

18. API Design
Propose REST or WebSocket APIs:
- auth
- wallet challenge/verify
- profile
- inventory
- season progress
- leaderboard
- quests
- tournament registration
- reward claiming
- admin event creation

19. Integration Points With Game
List exactly where the existing Battle Cities game should later integrate:
- main menu
- profile screen
- post-match screen
- matchmaking
- loadout screen
- construction/custom maps
- leaderboard
- tournament screen
- rewards screen

20. Final Recommendation
End with a clear recommendation:
- what to build first
- what to avoid first
- what the first public Web3 alpha should contain
- how to keep the game fun even if token price goes down

Produce a detailed but practical plan. Prioritize execution over hype. Avoid vague GameFi buzzwords. Keep the design skill-first, server-authoritative, and compatible with a future multiplayer Battle City-style game.
