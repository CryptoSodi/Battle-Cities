# Cloudflare Pages frontend

Cloudflare Pages serves only the browser game and static assets. The API stays
on Oracle at `https://api.battlecities.com`.

## Project settings

Connect the `CryptoSodi/Battle-Cities` GitHub repository and configure:

| Setting | Value |
| --- | --- |
| Production branch | `master` |
| Root directory | `/` |
| Build command | `npm run build` |
| Build output directory | `dist` |

Set this environment variable for both production and preview builds:

```env
BATTLECITY_API_BASE_URL=https://api.battlecities.com
```

Do not add backend secrets to the Pages project. The API base URL is compiled
into the public browser bundle and is intentionally not secret.

## Verification before DNS cutover

1. Open the generated `pages.dev` deployment and verify static assets load.
2. Verify `/terms`, `/privacy`, `/admin`, and a `/player-profile/<id>` URL.
3. Verify `service-worker.js` and `web-version.json` return no-cache headers.
4. Verify API requests target `https://api.battlecities.com`.
5. Add `battlecities.com` and `www.battlecities.com` as Pages custom domains.
6. Keep the Vercel project available until the Cloudflare deployment is stable.

The Oracle API allowlist includes `battlecities-web.pages.dev` and its preview
subdomains so authenticated flows can be tested before the custom-domain
cutover. Deploy the API change before completing preview verification.
