# Battle Cities Mobile

Capacitor wrapper that opens the production game at `https://www.battlecities.com`.

## Android

1. Install Android Studio and an Android SDK.
2. Run `npm install` in this folder.
3. Run `npm run sync`.
4. Run `npm run open:android` and launch the app from Android Studio.

The Android app is portrait-only because the mobile game UI is designed as a top game canvas with controls beneath it.

## Authentication and wallets

The wrapper loads the existing website, so guest sessions work immediately. Google may reject OAuth inside an embedded WebView. Phantom browser injection is also unavailable in a native WebView. Those flows should be moved to native browser/deep-link handoffs before publishing the app.

## Changing the hosted URL

Update `server.url` and `server.allowNavigation` in `capacitor.config.json`, then run `npm run sync`.
