# Battle Cities Mobile

Capacitor wrapper that ships a local game build and updates its web assets from
`https://play.battlecities.com` in the background.

## Android

1. Install Android Studio and an Android SDK.
2. Run `npm install` in this folder.
3. Run `npm run sync`.
4. Run `npm run open:android` and launch the app from Android Studio.

The Android app is portrait-only because the mobile game UI is designed as a top game canvas with controls beneath it.

## Authentication and wallets

The wrapper loads the existing website, so guest sessions work immediately. Google may reject OAuth inside an embedded WebView. Phantom browser injection is also unavailable in a native WebView. Those flows should be moved to native browser/deep-link handoffs before publishing the app.

## Web bundle updates

Android builds run the root web build automatically and package `dist` as the
offline baseline. Persistent Android background work checks `/web-version.json`,
downloads only changed files into app-private storage, verifies the complete
bundle, and uses it from the next launch after the update finishes. The work
continues if the app is closed, and the previous downloaded bundle is retained
for rollback.

## dApp Store release APK

The release build expects the signing key at
`D:\keys\battle-cities-dappstore.keystore`. Override this location with
`BATTLE_CITIES_KEYSTORE_PATH` when needed.

From PowerShell, set the Android Studio JDK and signing passwords only in the
current terminal session:

```powershell
cd C:\repos\BattleCity

$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'

$env:BATTLE_CITIES_KEYSTORE_PASSWORD = [System.Net.NetworkCredential]::new(
  '', (Read-Host 'Keystore password' -AsSecureString)
).Password

$env:BATTLE_CITIES_KEY_PASSWORD = [System.Net.NetworkCredential]::new(
  '', (Read-Host 'Key password' -AsSecureString)
).Password

cd mobile\android
.\gradlew.bat assembleRelease
```

The signed APK is generated at:

`C:\repos\BattleCity\mobile\android\app\build\outputs\apk\release\app-release.apk`

Because the game assets are bundled for fast offline startup, the current APK
should be roughly 85-90 MB. Do not publish an older 9.4 MB APK; that build
predates the bundled web assets.
