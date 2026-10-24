---
name: tvplay-handoff
description: TVPlay IPTV app — build state, verified, plus generated TVPlay.m3u8 export.
metadata:
  type: project
---

# TVPlay — HANDOFF (resume point)

Project: `/Users/bt/Downloads/TV` — personal, TV-optimized, free/legal IPTV web app (HLS via hls.js, remote/keyboard nav, zapping, favorites, dead-stream health checker) with an optional Capacitor Android APK wrapper.

## Status
App is **built and verified working**. Settings UI has in-app **Export Playlist (.m3u8)** button (`btn-export-m3u8`). **Fixed the "no back button" player trap** (2026-10-18, window W22) and made the m3u8 export LAN-accessible. If the IPTV player still can't load the playlist, ask which player/device — file itself validated 100% well-formed.

## Current window (this one) did
- Verified project state: all 15 files present & match README; every `js/*.js` passes `node --check`; `lib/hls.min.js` is a valid 375 KB hls.js UMD bundle.
- Ran local server `python3 -m http.server 8099` → all referenced assets serve **200** (left running on :8099).
- Probed live feeds (raw curl): FIFA+ English → 200; CBS Golazo → 500; Sportitalia → 403; Futbol TV → 301 (expected geo/header behavior; in-app health checker judges from device).
- **Generated `TVPlay.m3u8`** (243 unique channels, deduped by URL): 237 from `assets/sports-world.m3u` + 13 direct feeds from `js/channels.js`. Soccer ⚽ (Free) group = 10 channels. Grouped by `group-title` (country/category). Valid: 243 `#EXTINF` each followed by a URL, 0 orphans. Copies at:
  - `~/Downloads/TV/TVPlay.m3u8` (served at `http://localhost:8099/TVPlay.m3u8`)
  - `~/Downloads/TVPlay.m3u8`

## W22 (this window) — fixed user-reported issues
**"No back button to return to playlist in browser"** — back button existed but was unreachable; fixed:
- Loading overlay (spinner) covered the screen AND blocked clicks while buffering — on a slow/dead stream it could persist forever with no escape. Now `pointer-events: none` + always-visible **"◄ Back to channels" button** inside it (`#btn-back-loading`), hidden during grid-load phase.
- Controls `z-index` 1002 (above loading overlay 1001); error overlay 1003 (above controls) so Retry/X always reachable.
- Touch devices never fire `mousemove` (which reveals the controls); added `touchstart` on player overlay so any tap reveals them.
- Search input kept focus after launching a channel → global keydown early-returned on INPUT and swallowed all remote/keyboard keys. `closeSearch()` now blurs.
- `closePlayer()` now restores keyboard/remote focus to the last-watched card (also implemented `highlightChannel()` — was placeholder — marks card with `.last-watched` accent border).
- Esc/Backspace during number-zap now cancels the buffer without restarting the stream (was replaying the channel).

**"m3u8 does not load in IPTV player"** — validated `TVPlay.m3u8` is perfectly well-formed (line 1 `#EXTM3U`, UTF-8, LF, 243/243 EXTINF followed by URL, balanced quotes, no data-URIs, no dupes). Cause is almost certainly **`localhost` not resolving on the TV/phone** (player device's own localhost). Mac LAN IP: **192.168.1.161** — use `http://192.168.1.161:8099/TVPlay.m3u8` (verified 200 from LAN IP, served bytes == disk). Also created **`TVPlay.m3u`** copies (repo + `~/Downloads/`) for file-pickers that only list `.m3u`.

## Loose ends noticed (minor, not yet fixed)
- ~~`highlightChannel()` placeholder~~ — **done W22** (marks last-watched card, focus restored on back).
- Diagnostics overlay exists in `index.html` but no UI control opens it (dev leftover).
- `js/app.js` `zapToNumber()` is dead code (digit zapping handled inline in `handlePlayerKeydown`).
- Stray copy `~/Downloads/sports-world.m3u` (leftover from an earlier delivery).

## Environment notes
- `node`/`npm` live at `~/.local/bin` — **not on default PATH**; call as `~/.local/bin/node` or `export PATH="$HOME/.local/bin:$PATH"`.
- **No Android SDK / Android Studio** installed → APK Option A (Capacitor) needs a multi-GB install; Option B (PWABuilder, `apk/BUILD-APK.md`) needs a public URL for the app.
- Run app: `cd /Users/bt/Downloads/TV && python3 -m http.server 8080` → http://localhost:8080 (browser), http://192.168.1.161:8080 (other devices on LAN — Mac IP may change across reboots; check `ipconfig getifaddr en0`).
- Server currently on **:8099** (started W21; serves repo root, verified 200 for all assets). `python3 -m http.server` binds 0.0.0.0 by default, so LAN devices can reach it.

## How to resume (new window)
1. Enable auto-approve (acceptEdits) in the new window.
2. Run `handoff resume` (from `~/.local/bin/handoff`) — it prints state + this file.
3. Read this HANDOFF.md, confirm the open next-step option with the user, continue.

## Key decisions
- m3u8 is **self-contained** (bundled M3U + direct feeds), not a live fetch — always complete even offline.
- Dedup by stream URL; direct (curated) channels take precedence.
- Legal sourcing: iptv-org index + its blocklist; pay/PPV tiers excluded (see README "Legal / sourcing notes").

## History
- W21: resumed after no-HANDOFF.md state; verified app; generated TVPlay.m3u8; added in-app export button; handed off.
- W22 (this window): fixed player back-button trap (overlay z-order/pointer-events, touch support, search focus trap, focus restore, highlightChannel); validated m3u8 well-formed; added TVPlay.m3u copies + LAN-verified serving.
