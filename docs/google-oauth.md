# Google OAuth Setup

Google login uses these server env vars:

```text
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_STATE_SECRET=
```

`GOOGLE_OAUTH_STATE_SECRET` can be any long random secret. Keep it different
from the client secret if possible.

## Current Project URLs

Production:

```text
https://www.battlecities.com/api/auth/google/callback
```

Webpack dev on this machine:

```text
https://192.168.1.15:8080/api/auth/google/callback
```

Localhost, if the game is served through localhost:

```text
http://localhost:8080/api/auth/google/callback
https://localhost:8080/api/auth/google/callback
```

Vercel dev, if used:

```text
http://localhost:3000/api/auth/google/callback
```

## Google Console

In Google Cloud Console, create or edit an OAuth client:

1. Application type: Web application.
2. Add the matching authorized redirect URIs from above.
3. Add matching authorized JavaScript origins:

```text
https://www.battlecities.com
https://192.168.1.15:8080
http://localhost:8080
https://localhost:8080
http://localhost:3000
```

If Google rejects a LAN IP callback, test Google login through localhost or the
production domain instead.

## Vercel

Add the three env vars to the `battle-cities` Vercel project for Production,
Preview, and Development, then redeploy production.

## Local Dev

Add the same vars to `.env.local`. The dev server loads `.env.local` through
`server/loadLocalEnv`.

After setup, `GET /api/auth/google/start` should redirect to
`accounts.google.com` instead of `/?authError=google_config`.
