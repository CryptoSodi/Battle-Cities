# PSG1 UI Conversion Status

Target display: 1240 × 1080. PSG1 mode reuses the desktop visual system while
using the full console viewport and hiding the phone-only gameplay joystick.

## Completed — UI conversion

- Main menu
- Shop: Token Shop and SOL Shop
- Shop: Loadout
- Headquarters hub
- Treasury
- Campaigns
- Staking
- Trading
- Boosts
- Airdrop
- Field Manual
- Login and authentication
- Loading and boot splash
- Tank selection
- Rankings
- Socials
- Settings
- Player profile and replay history
- Battle results
- Events and campaign detail flows
- Gameplay HUD, pause, game over, and victory canvas presentation
- Dialogs, empty states, error states, and transient status treatments

These screens use the PSG1 device profile, responsive console-sized type and
controls, independently scrolling content, fixed navigation, and Shop-standard
active/selected/Back treatments. Gameplay reclaims the full screen when the
PSG1 profile is detected and the hidden touch controller no longer reserves
the lower 40 percent of the viewport.

## Remaining — hardware validation

- Native PSG1 or DevKit safe areas and effective CSS viewport size
- Longest live labels, wallet values, empty/error states, and multiplayer data
- Performance and focus visibility during extended controller-only play

## Verified locally

- Production components compile in the development webpack build
- 1240 × 1080 target viewport stays within both axes
- 620 × 540 density-scaled viewport stays within both axes
- Tank, ranking, settings, and results content scrolls inside its intended panel

Physical controller mappings and button-prompt copy remain outside this UI-only
pass.
