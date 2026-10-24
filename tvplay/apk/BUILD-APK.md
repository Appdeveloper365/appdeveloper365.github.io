# Building TVPlay as an Android APK

The web app in the parent folder (`index.html` + `js/` + `css/` + `lib/` + `assets/`)
is packaged inside a native Android shell using Capacitor, which produces a real
installable `TVPlay.apk` with fullscreen video, remote-friendly D-pad navigation,
and access to the local bundled playlist.

## Option A — Build on your own machine (full control, ~10 min)

### Prerequisites
1. **Node.js** 18+ — https://nodejs.org
2. **Android Studio** (includes the Android SDK + Java) — https://developer.android.com/studio
   - During setup, accept the default SDK location.
3. JDK 17 (bundled with recent Android Studio).

### Steps
```bash
cd apk
npm install          # installs Capacitor CLI + Android platform
npm run add          # creates the android/ native project (first time only)
npm run sync         # copies the web app into the native project
npm run build        # emits android/app/build/outputs/apk/debug/app-debug.apk
```

The result is at:
```
apk/android/app/build/outputs/apk/debug/app-debug.apk
```

Copy it to your Android TV (e.g. via `adb install app-debug.apk` or USB) and allow
"Install unknown apps" when prompted.

### HTTPS / stream note
`capacitor.config.json` sets `cleartext: true` so plain-HTTP streams still play
(some free feeds are served over http). If you only use HTTPS feeds you may
remove it.

## Option B — PWABuilder (no toolchain needed)

1. Serve the app online (e.g. `python3 -m http.server` + a tunnel, or GitHub
   Pages) — the app must be reachable via public URL.
2. Go to https://www.pwabuilder.com, enter your URL, and choose **Android package**.
3. Download the generated `apk.zip`, extract `app-release-signed.apk`.

## Rebuilding after editing channels
Any time you change `js/channels.js`, `assets/sports-world.m3u`, or other files:
```bash
cd apk && npm run sync && npm run build
```

## TV remote support
The web app already supports D-pad navigation, so the APK works with any
Android TV remote out of the box:
- Arrows: navigate grid / player
- OK / Enter: select
- Back / Escape: close overlay or leave player
- Digits 0-9 in the player: jump to channel number (e.g. 1-2-3 → channel 123)
- Page Up / Page Down (or Channel +/-): next / previous channel
