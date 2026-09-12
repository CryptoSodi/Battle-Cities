# Desktop monitor navigation

Desktop web (1280px and wider in automatic presentation) retains MainMenuWebUi
as the live outer console. Subpage scenes mount through `getWebUiHost()` into
`data-monitor-page`; they retain their existing scene history and controllers.
Play in the sidebar restores home. Start on the banner enters tank selection.
Battle/replay scenes unmount the console and remain full-screen.

Shop/loadout, Ranking, Quarters and all seven quarters pages, Socials, Settings,
player profiles, Tank Select and Results use this host. Android, explicit PSG1
and compact/medium automatic presentation keep their full-screen screens.
Crossing the desktop breakpoint remounts the current page using the same UI
instance, deferring a host change while a dialog is open.

`monitorStyles.ts` scopes the existing PSG1 screen styles through CSSOM rather
than maintaining a second copy. Viewport units become container units and
size media queries become monitor container queries. `web-monitor.css` supplies
the embedding geometry and short-display adjustments. Native device attributes
and physical input bindings are not overridden.

Verification: `npm run build:dev`; `node scripts/test-web-monitor.cjs` with
Playwright installed (or `PLAYWRIGHT_MODULE` pointing at it). The browser fixture
uses real UI classes, local data and offline API responses; it does not perform
wallet connections or purchases. It checks all hosted screens at 1920x1080 and
1280x720, stable outer DOM, document bounds, Back/focus restoration, purchase
focus visibility, Play/home, and native full-screen layouts.
