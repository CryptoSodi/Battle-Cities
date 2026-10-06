# Standalone admin dashboard

The Command Center was extracted from the game on 2026-10-06.

- Local repository: `C:\repos\BattleCitiesAdmin`
- GitHub: https://github.com/CryptoSodi/BattleCities-Admin
- Site: https://admin.battlecities.com
- API: https://api.battlecities.com
- Replay viewer: https://play.battlecities.com
- Hosting: GitHub Pages, built/deployed from `main` in the admin repository.
- DNS: Cloudflare `admin` CNAME to `cryptosodi.github.io`, DNS-only, with GitHub Pages HTTPS.

The admin repository owns the dashboard HTML/CSS/TypeScript, wallet sign-in,
player directory/profile views, match/replay tables, notification composer,
live-user toggle, and X campaign controls. The game's old `/admin/` URL now
redirects to the admin domain, and webpack no longer builds `admin.js`.

The API and its database remain separate. Every dashboard request uses the API's
existing HttpOnly session cookie (`credentials: include`) and server-side admin
authorization. No keys or secrets are needed in the dashboard or GitHub Pages.
Moving/building the admin UI does not redeploy the API or game. Replay links
open the game domain with the existing replay ID query; profiles link to the
standalone HTML viewer. Public profile links in the game remain supported.

Admin changes: `npm ci`, `npm run check`, `npm test`, `npm run build`, then push
to `main` in the admin repo. `npm start` serves a local preview on port 8082.
