/**
 * health.js
 * Stream health checker for TVPlay.
 *
 * Streams live and die all the time — this module probes every channel
 * from the user's own device/network and caches the result in
 * localStorage so dead channels can be filtered out automatically.
 */

const HEALTH_KEY = 'tvplay.streamHealth';

class StreamHealth {
  constructor() {
    try {
      this.cache = JSON.parse(localStorage.getItem(HEALTH_KEY) || '{}');
    } catch (e) { this.cache = {}; }
  }

  flush() {
    try { localStorage.setItem(HEALTH_KEY, JSON.stringify(this.cache)); } catch (e) {}
  }

  /** Remove cache entries older than `days` so channels get re-tested. */
  prune(maxAgeDays = 3) {
    const cutoff = Date.now() - maxAgeDays * 864e5;
    let changed = false;
    for (const url of Object.keys(this.cache)) {
      if (this.cache[url].time < cutoff) { delete this.cache[url]; changed = true; }
    }
    if (changed) this.flush();
    return changed;
  }

  isDead(url) { return this.cache[url] && this.cache[url].alive === false; }

  /**
   * Probe a single stream URL.
   * An HLS playlist must look like #EXTM3U / #EXT-X / #EXTINF.
   * @returns {Promise<boolean>} true if alive
   */
  async probe(url) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 9000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: {}
      });
      clearTimeout(timer);
      if (!res.ok) return false;
      const head = (await res.text()).slice(0, 2048);
      if (/^\s*#EXTM3U|#EXT-X-VERSION|#EXTINF/i.test(head)) return true;
      // Some hosts return binary/f4m — an MK/TS fallback: accept 200 + video-ish content type
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('video') || ct.includes('mpegurl')) return true;
      return false;
    } catch (e) {
      // CORS-blocked hosts can still be playable via hls.js in some setups;
      // only confirm death once so the user can rescan.
      return false;
    }
  }

  /**
   * Scan a list of channels in parallel.
   * @param {Array<{url,id,name}>} channels
   * @param {{concurrency:number, onProgress:function, force:boolean}} opts
   * @returns {Promise<{alive:number, dead:number, deadUrls:Set<string>}>}
   */
  async scan(channels, opts = {}) {
    const concurrency = opts.concurrency || 12;
    const deadUrls = new Set();
    let alive = 0, dead = 0, done = 0;
    const targets = opts.force ? channels : channels.filter(c => !this.cache[c.url]);

    const queue = targets.slice();
    const worker = async () => {
      while (queue.length) {
        const ch = queue.shift();
        if (!ch) break;
        const ok = await this.probe(ch.url);
        this.cache[ch.url] = { alive: ok, time: Date.now() };
        if (ok) alive++; else { dead++; deadUrls.add(ch.url); }
        done++;
        if (opts.onProgress) {
          try { opts.onProgress(done, targets.length, alive, dead); } catch (e) {}
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    this.flush();
    return { alive, dead, deadUrls };
  }
}

window.StreamHealth = StreamHealth;
window.HEALTH_KEY = HEALTH_KEY;
