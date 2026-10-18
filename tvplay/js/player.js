/**
 * player.js
 * Video player wrapper using hls.js with native HLS fallback
 */

class Player {
  constructor(videoEl, options = {}) {
    this.video = videoEl;
    this.hls = null;
    this.currentChannel = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.onError = options.onError || (() => {});
    this.onLoadingChange = options.onLoadingChange || (() => {});
  }

  /**
   * Load and play a channel stream
   * @param {Object} channel - {name, url, logo, group, id}
   */
  async play(channel) {
    this.currentChannel = channel;
    this.retryCount = 0;
    this.video.pause();
    this.video.src = '';
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    const url = channel.url;
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
    if (Hls.isSupported()) {
      this.hls = new Hls({ enableWorker: true });
      this.hls.loadSource(url);
      this.hls.attachMedia(this.video);

      this.hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          this.retryCount++;
          if (this.retryCount <= this.maxRetries) {
            setTimeout(() => this.hls.startLoad(), 1000 * this.retryCount);
          } else {
            this.onError(`Stream error: ${data.type} - ${data.details}`);
          }
        }
      });

      this.video.play().catch(() => {});
      return;
    }

    // Last resort: try direct src anyway
    this.video.src = url;
    this.video.play().catch(() => {
      this.onError('Browser does not support HLS playback');
    });
  }

  // Diagnostic: log video info
  logVideoInfo() {
    console.log('Video element:', {
      videoWidth: this.video.videoWidth,
      videoHeight: this.video.videoHeight,
      readyState: this.video.readyState,
      paused: this.video.paused,
      muted: this.video.muted,
      volume: this.video.volume,
      src: this.video.currentSrc,
      hasVideoTracks: this.video.videoTracks ? this.video.videoTracks.length : 'N/A',
      hasAudioTracks: this.video.audioTracks ? this.video.audioTracks.length : 'N/A'
    });
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
    if (this.hls) this.hls.destroy();
    this.video.src = '';
  }
}

window.Player = Player;