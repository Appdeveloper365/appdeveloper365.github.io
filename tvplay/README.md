# TVPlay – Personal TV IPTV Application

A TV-compatible, URL-based IPTV application that streams **free and legal**
live TV over the internet. Designed for personal use in a browser (desktop,
smart TV, or tablet) or as an installable Android APK, with full
remote-control / keyboard navigation.

> **What's inside:** a dedicated **free soccer group** (FIFA+ in 8 languages,
> FIFA+ Women, CBS Sports Golazo, Sportitalia Solocalcio, Futbol TV), plus
> **237 curated free-to-air and free-ad-supported (FAST) channels from ~70
> countries** and news, movies, documentary, music and kids categories from the
> community-maintained iptv-org index — with rights-holder blocks applied and
> pay/PPV tiers excluded.

## Legal / sourcing notes

All default sources are either broadcaster-published HLS feeds or channels
listed by [iptv-org](https://github.com/iptv-org/iptv), which indexes only
publicly available streams and maintains an official [blocklist](https://github.com/iptv-org/iptv#blocklist)
for channels whose owners request removal. This app applies that blocklist and
additionally filters obvious pay tiers (Premium/PPV/DAZN/…) from the curated
bundled playlist. No descrambled or credential-gated satellite/cable feeds are
included.

## Features

- **Free soccer group** – `Soccer ⚽ (Free)`: FIFA+ (English, Spanish, French,
  German, Italian, Portuguese), FIFA+ Women, CBS Sports Golazo Network,
  Sportitalia Solocalcio, Futbol TV — all published free by their owners.
- **Curated worldwide sports lineup** – bundled `assets/sports-world.m3u`
  (streamed even when the iptv-org index is slow or unreachable).
- **Live playlists** – iptv-org sports/news/etc. fetched at startup for fresh
  streams; add your own M3U URLs via Settings.
- **Dead-stream removal** – a built-in health checker probes every channel
  from your own device on first run (background) or on demand
  (Settings → *Scan & Remove Dead Streams*). Dead channels are permanently
  filtered until they pass a rescan. Results refresh every 3 days.
- **IPTV-style numbering & zapping**:
  - Every channel shows its preset number; type digits while watching to
    zap (e.g. `1`, `2`, `3` → channel 123).
  - Page Up/Down or `N`/`B` = next/previous channel.
- **Favorites** – star any channel (card or player); the sidebar gets a
  ★ Favorites group; persisted in localStorage.
- **TV-optimized UI** – large buttons, high-contrast dark theme, safe-area
  padding, focus rings for remote navigation.
- **Remote control / keyboard** – arrows navigate, Enter/OK selects,
  Backspace/Escape goes back, media keys and number keys control playback.
- **HLS playback** – hls.js with native HLS fallback for Safari/WebKit.
- **No build step** – plain static HTML/CSS/JS; host anywhere or package as APK.

## Project Structure

```
/Users/bt/Downloads/TV/
├── index.html                # Single-page app entry point
├── css/
│   └── style.css             # TV-optimized dark theme
├── js/
│   ├── app.js                # Main app: routing, state, TV input, zapping
│   ├── player.js             # Video player (hls.js + native fallback)
│   ├── playlist.js           # M3U/M3U8 parser
│   ├── channels.js           # Default channel & playlist list
│   ├── health.js             # Stream health checker (removes dead streams)
│   └── settings.js           # localStorage-backed settings
├── assets/
│   └── sports-world.m3u      # Curated free worldwide sports channels
├── apk/
│   ├── package.json          # Capacitor wrapper config
│   ├── capacitor.config.json # Android app shell config
│   └── BUILD-APK.md          # Step-by-step APK build instructions
├── lib/
│   └── hls.min.js            # hls.js library (local copy for offline use)
└── README.md
```

## Running locally

```bash
cd /Users/bt/Downloads/TV
python3 -m http.server 8080
# open http://localhost:8080
```

Opening `index.html` directly also works for most browsers, but a local
server avoids any file:// fetch quirks.

## Packaging as APK

See [`apk/BUILD-APK.md`](apk/BUILD-APK.md) — either build locally with
Capacitor (`npm install && npm run add && npm run sync && npm run build`)
or use PWABuilder for a no-toolchain signed APK.

## Geo-restrictions

Some free channels are geo-fenced by their owners (a US FAST channel may
only serve US IPs). If a channel "is alive but won't play", that's why —
the health checker handles genuinely dead URLs; geo-fenced ones depend on
your location.

## License & credit

Personal-use application. Channel data and streams are the property of
their respective owners. Deserves thanks: the
[iptv-org](https://github.com/iptv-org/iptv) community index.
