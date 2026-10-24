# Deploying TVPlay Online

The app is now a **PWA** ( Progressive Web App ): it has a manifest, icons and a
service worker, so once hosted over HTTPS it can be opened from a public URL,
added to a TV/tablet home screen, and opened even offline (the UI and the
bundled soccer/sports playlist work without internet; live streams still need it).

The ready-to-deploy bundle is **`tvplay-site.zip`** (rebuilt when you run the
zip command in Option 1) — it contains only the runtime files.

---

## Option 1 — Netlify Drop (fastest, no account needed to preview, ~30 seconds)

1. Run in the terminal if you edited files since the last build:
   ```bash
   cd /Users/bt/Downloads/TV && python3 - <<'PY'
   import zipfile
   files = ['index.html','manifest.json','sw.js','css/style.css',
            'js/app.js','js/player.js','js/playlist.js','js/channels.js',
            'js/settings.js','js/health.js','lib/hls.min.js',
            'assets/sports-world.m3u','assets/icons/icon-192.png',
            'assets/icons/icon-512.png','assets/icons/icon-512-maskable.png']
   with zipfile.ZipFile('tvplay-site.zip','w',zipfile.ZIP_DEFLATED) as z:
       for f in files: z.write(f)
   print('tvplay-site.zip rebuilt')
   PY
   ```
2. Open **https://app.netlify.com/drop** and drag `tvplay-site.zip` onto the page.
3. Netlify gives you a permanent `https://<name>.netlify.app` URL. Sign in with
   any account to keep it from expiring.

## Option 2 — GitHub Pages (free, permanent)

```bash
cd /Users/bt/Downloads/TV
git remote add origin https://github.com/<YOUR-USER>/tvplay.git
git push -u origin main
# then on github.com: Repo → Settings → Pages → Branch: main / root → Save
# App appears at https://<YOUR-USER>.github.io/tvplay/
```

## Option 3 — Cloudflare Pages / Vercel (free, faster CDN)

Both have dashboard uploaders (no CLI):
- **Cloudflare Pages** → dash.cloudflare.com → Workers & Pages → Create →
  Upload assets → select the files in this folder.
- **Vercel** → vercel.com/new, then drag-and-drop upload.

## After it's hosted

- **TV install:** open the URL in a browser on the device and use
  "Add to Home screen". For a true Android TV launcher icon, either use the
  APK wrapper in `apk/` or feed the hosted URL to https://www.pwabuilder.com
  and download its signed Android package — the manifest is already set up
  for it (fullscreen, landscape, maskable icon).
- **Updates:** edit files, rebuild the zip, re-drop. The service worker is
  network-first for `index.html`, so a reload picks up new `js/css` from the
  cache-busting behavior of the rebuild; if cached JS ever seems stale,
  bump `const CACHE = 'tvplay-v1'` in `sw.js` to `v2`.
