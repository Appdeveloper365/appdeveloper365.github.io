/**
 * settings.js
 * localStorage-backed settings for TVPlay
 */

const STORAGE_KEY = 'tvplay.settings';

class Settings {
  constructor() {
    this.defaults = {
      customPlaylists: [],
      favorites: [],
      lastChannelId: null,
      volume: 0.8,
      muted: false
    };
    this.data = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...this.defaults, ...JSON.parse(raw) };
    } catch (e) {
      console.warn('Settings load failed', e);
    }
    return { ...this.defaults };
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Settings save failed', e);
    }
  }

  get(key) { return this.data[key]; }
  set(key, value) { this.data[key] = value; this.save(); }

  getPlaylists() {
    return this.data.customPlaylists || [];
  }

  addPlaylist(name, url) {
    const playlists = this.getPlaylists();
    playlists.push({ name, url });
    this.set('customPlaylists', playlists);
  }

  removePlaylist(index) {
    const playlists = this.getPlaylists();
    playlists.splice(index, 1);
    this.set('customPlaylists', playlists);
  }

  setLastChannel(id) { this.set('lastChannelId', id); }
  getLastChannel() { return this.get('lastChannelId'); }

  setVolume(v) { this.set('volume', v); }
  getVolume() { return this.get('volume'); }

  setMuted(m) { this.set('muted', m); }
  getMuted() { return this.get('muted'); }
}

window.Settings = Settings;
window.STORAGE_KEY = STORAGE_KEY;