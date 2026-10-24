/**
 * player.js
 * Hardened HLS media engine for TVPlay.
 *
 * Recovery ladder when a stream stalls (per channel, reset on channel change):
 *   1. nudge hls.startLoad() / re-issue play()          — free/fast
 *   2. walk the bitrate DOWN one level (adaptive ladder) — quality trade
 *   3. full reload of hls context / video.src            — heavier
 *   4. surfacing a clear error to the caller, no silent black screen
 *
 * The caller (app.js) receives onBuffering(seconds|null) updates so the UI
 * can show a non-blocking "Buffering… Ns" chip instead of guessing.
 */

const HLS_TUNING = {
  enableWorker: true,
  // Prefer stability over max buffer: chunked, resilient fetching.
  maxBufferLength: 45,
  maxMaxBufferLength: 90,
  maxBufferSize: 120 * 1000 * 1000,
  backBufferLength: 30,
  liveSyncDurationCount: 6,
  // Tolerant loading — weak CDNs and busy networks get real retries:
  manifestLoadingMaxRetry: 4,
  manifestLoadingTimeOut: 15000,
  levelLoadingMaxRetry: 6,
  levelLoadingTimeOut: 15000,
  fragLoadingMaxRetry: 8,
  fragLoadingTimeOut: 30000,
  fragLoadingRetryDelay: 500,
  fragLoadingMaxRetryTimeout: 8000,
  // Faster ABR downshift when throughput collapses mid-stream.
  abrEwmaFastLive: 2.0,
  abrEwmaSlowLive: 8.0,
  abrBandWidthUpFactor: 0.6
};

class Player {
  constructor(videoEl, options = {}) {
    this.video = videoEl;
    this.hls = null;
    this.currentChannel = null;
    this.onError = options.onError || (() => {});
    this.onLoadingChange = options.onLoadingChange || (() => {});
    this.onBuffering = options.onBuffering || (() => {});

    // --- stall/recovery state ---
    this.monitor = null;
    this.lastTime = -1;
    this.stalledSince = 0;      // ms timestamp when the current stall began
    this.stallCount = 0;        // stalls in the current 90 s window
    this.stallWindowStart = 0;
    this.ladderStep = 0;        // recovery rungs used for this channel
    this.reloading = false;
    this.repliedStalled = false;
  }

  /**
   * Load and play a channel stream.
   * @param {Object} channel - {name, url, logo, group, id}
   */
  play(channel) {
    this.currentChannel = channel;
    this.video.pause();
    this.video.removeAttribute('src'); // fully reset the media element
    this.video.load();
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.resetRecoveryState();
    this.startMonitor();

    const url = channel && channel.url;
    if (!url) {
      this.onError('No stream URL');
      return;
    }

    // Native HLS support (Safari, tvOS WebKit, modern browsers)
    if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
      this.video.src = url;
      this.video.play().catch(() => {});
      return;
    }

    // hls.js for MSE-based browsers (Chrome, Firefox, Edge)
    if (window.Hls && Hls.isSupported()) {
      this.hls = new Hls(HLS_TUNING);
      this.hls.loadSource(url);
      this.hls.attachMedia(this.video);

      this.hls.on(Hls.Events.ERROR, (event, data) => {
        if (!data.fatal) return;
        this.handleFatalHlsError(data);
      });

      // Measure ABR level drops — evidence for the ladder.
      this.hls.on(Hls.Events.LEVEL_SWITCHED, () => { this.repliedStalled = false; });

      this.video.play().catch(() => {});
      return;
    }

    // Last resort: try direct src anyway
    this.video.src = url;
    this.video.play().catch(() => {
      this.onError('Browser does not support HLS playback');
    });
  }

  /** Fatal hls.js errors get ladder recovery, not just retries. */
  handleFatalHlsError(data) {
    if (this.ladderStep >= 4) {
      this.onError(`Stream error: ${data.type || 'network'} — ${data.details}`);
      return;
    }
    this.ladderStep++;
    const wait = 1200 * this.ladderStep;
    setTimeout(() => {
      if (!this.hls || !this.currentChannel) return;
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        try { this.hls.recoverMediaError(); return; } catch (e) { /* fall through */ }
      }
      this.hls.startLoad();
    }, wait);
  }

  /** One-second health tick over the video element. */
  startMonitor() {
    this.stopMonitor();
    this.stallWindowStart = Date.now();
    this.monitor = setInterval(() => this.tick(), 1000);
  }

  stopMonitor() {
    if (this.monitor) { clearInterval(this.monitor); this.monitor = null; }
    if (this.stalledSince) { this.notifyBuffering(null); this.stalledSince = 0; }
  }

  resetRecoveryState() {
    this.lastTime = -1;
    this.stalledSince = 0;
    this.stallCount = 0;
    this.stallWindowStart = Date.now();
    this.ladderStep = 0;
    this.reloading = false;
    this.repliedStalled = false;
  }

  tick() {
    if (!this.currentChannel || this.video.paused) {
      if (this.stalledSince) { this.stalledSince = 0; this.notifyBuffering(null); }
      return;
    }
    const t = this.video.currentTime;
    const advancing = this.lastTime === -1 || t - this.lastTime > 0.001;
    this.lastTime = t;

    if (advancing) {
      if (this.stalledSince) { this.stalledSince = 0; this.notifyBuffering(null); this.repliedStalled = false; }
      // Stable for 90 s → forget recent stalls, allow ABR to climb back.
      if (Date.now() - this.stallWindowStart > 90000) {
        this.stallCount = 0;
        this.stallWindowStart = Date.now();
        if (this.hls) this.hls.autoLevelCapping = -1;
      }
      return;
    }

    // --- stalled: paused frame, not playing ---
    if (!this.stalledSince) {
      this.stalledSince = Date.now();
      this.stallCount++;
      // Three stalls in 90 s → stop fighting for top quality.
      if (this.stallCount >= 3 && this.hls) {
        const cap = Math.max(0, (this.hls.currentLevel || 0) - 1);
        if (this.hls.autoLevelCapping !== cap) {
          this.hls.autoLevelCapping = cap;
          this.hls.currentLevel = cap;
        }
      }
    }
    const stallSecs = Math.round((Date.now() - this.stalledSince) / 1000);
    this.notifyBuffering(stallSecs);

    // Steady stall → run the recovery ladder.
    if (stallSecs >= 8 && this.repliedStalled === false) {
      this.repliedStalled = true;
      this.recover(1);
    } else if (stallSecs >= 20 && this.repliedStalled === 1) {
      this.repliedStalled = 2;
      this.recover(2);
    } else if (stallSecs >= 45 && this.repliedStalled === 2) {
      this.repliedStalled = 3;
      this.recover(3);
    } else if (stallSecs >= 70 && this.repliedStalled === 3) {
      this.repliedStalled = 4;
      this.recover(4);
    }
  }

  /** Recovery rungs. */
  recover(level) {
    if (level === 1) {
      if (this.hls) { try { this.hls.startLoad(); } catch (e) {} }
      this.video.play().catch(() => {});
    } else if (level === 2) {
      if (this.hls) { // drop one bitrate rung for throughput
        const cap = Math.max(0, (this.hls.currentLevel || 0) - 1);
        this.hls.autoLevelCapping = cap;
        this.hls.currentLevel = cap;
        try { this.hls.startLoad(); } catch (e) {}
      } else {
        this.reloadVideo();
      }
    } else if (level === 3) {
      if (this.hls) { this.hls.destroy(); this.hls = null; }
      this.reloadVideo();
    } else if (level >= 4) {
      this.stopMonitor();
      this.onError('This stream keeps stalling. It may be overloaded or geo-fenced — try another channel or run the health scan in Settings.');
    }
  }

  /**
   * Full restart of the current channel. Re-uses play() so the correct
   * engine is rebuilt: a fresh Hls instance on MSE browsers, or a direct
   * src on native-HLS browsers. A raw m3u8 src on an MSE browser would
   * just fail — always re-route through play().
   */
  reloadVideo() {
    if (this.reloading || !this.currentChannel) return;
    this.reloading = true;
    const ch = this.currentChannel;
    setTimeout(() => {
      this.reloading = false;
      if (!this.currentChannel || this.currentChannel !== ch) return;
      this.play(ch);
    }, 800);
  }

  notifyBuffering(seconds) {
    try { this.onBuffering(seconds); } catch (e) {}
  }

  pause() { this.video.pause(); }
  playPause() {
    if (this.video.paused) this.video.play();
    else this.video.pause();
  }
  toggleMute() { this.video.muted = !this.video.muted; }
  setVolume(v) { this.video.volume = v; }
  requestFullscreen() {
    if (this.video.requestFullscreen) this.video.requestFullscreen();
    else if (this.video.webkitRequestFullscreen) this.video.webkitRequestFullscreen();
  }

  destroy() {
    this.stopMonitor();
    if (this.hls) this.hls.destroy();
    this.video.removeAttribute('src');
    this.video.load();
  }
}

window.Player = Player;
