(function() {
  'use strict';

  var els = {
    app: document.getElementById('app'),
    categoryList: document.getElementById('category-list'),
    channelGrid: document.getElementById('channel-grid'),
    categoryTitle: document.getElementById('current-category'),
    searchBox: document.getElementById('search-box'),
    searchInput: document.getElementById('search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    emptyState: document.getElementById('empty-state'),

    playerOverlay: document.getElementById('player-overlay'),
    video: document.getElementById('video'),
    playerControls: document.getElementById('player-controls'),
    channelLogo: document.getElementById('channel-logo'),
    channelTitle: document.getElementById('channel-title'),
    channelGroup: document.getElementById('channel-group'),
    loadingOverlay: document.getElementById('loading-overlay'),
    btnBackLoading: document.getElementById('btn-back-loading'),
    errorOverlay: document.getElementById('error-overlay'),
    errorMessage: document.getElementById('error-message'),
    btnRetry: document.getElementById('btn-retry'),
    btnCloseError: document.getElementById('btn-close-error'),

    settingsPanel: document.getElementById('settings-panel'),
    playlistUrls: document.getElementById('playlist-urls'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    btnResetDefaults: document.getElementById('btn-reset-defaults'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnHealthScan: document.getElementById('btn-health-scan'),
    healthStatus: document.getElementById('health-status'),
    btnExportM3u8: document.getElementById('btn-export-m3u8'),
    exportStatus: document.getElementById('export-status'),

    btnSettings: document.getElementById('btn-settings'),
    btnBack: document.getElementById('btn-back'),
    btnPlayPause: document.getElementById('btn-play-pause'),
    btnVolume: document.getElementById('btn-volume'),
    btnFullscreen: document.getElementById('btn-fullscreen'),
    btnSearch: document.getElementById('btn-search'),
    btnFavorites: document.getElementById('btn-favorites'),

    // Diagnostics
    diagOverlay: document.getElementById('diag-overlay'),
    diagVideo: document.getElementById('diag-video-info'),
    diagError: document.getElementById('diag-error'),
    diagStatus: document.getElementById('diag-status'),
    btnCloseDiag: document.getElementById('btn-close-diag')
  };

  var settings = new Settings();
  window.TVPLAY_FALLBACK_LOGO = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="240" height="135"%3E%3Crect width="240" height="135" fill="%231a1a1a"/%3E%3Ctext x="50%25" y="54%25" dominant-baseline="middle" text-anchor="middle" fill="%23666" font-family="sans-serif" font-size="18"%3ETV%3C/text%3E%3C/svg%3E';
  var player = new Player(els.video, {
    onError: function(msg) { showPlayerError(msg); },
    onLoadingChange: function(loading) {
      if (loading) els.loadingOverlay.classList.remove('hidden');
      else els.loadingOverlay.classList.add('hidden');
    }
  });
  var health = new StreamHealth();
  health.prune(3);
  var allChannels = [];
  var filteredChannels = [];
  var currentCategory = 'All';
  var currentFocusIndex = 0;
  var isFavoritesOnly = false;
  var zapBuffer = '';
  var zapTimer = null;
  var DEFAULT_GROUPS = ['Soccer ⚽ (Free)', 'Sports', 'News', 'USA', 'UK', 'Canada', 'General', 'Unknown'];

  async function init() {
    try {
      applyStoredSettings();
      setupEventListeners();
      await loadAllPlaylists();
      renderSidebar();
      renderChannels();
      var lastId = settings.getLastChannel();
      if (lastId) {
        var ch = allChannels.find(function(c) { return c.id === lastId; });
        if (ch) highlightChannel(ch);
      }
      document.addEventListener('keydown', handleGlobalKeydown);
      // First run: quietly probe streams in the background so dead channels
      // disappear without the user doing anything. Only for reasonably small
      // line-ups — probing thousands of channels should be an explicit choice.
      if (!Object.keys(health.cache).length && allChannels.length <= 600) {
        runHealthScan(false).catch(function() {});
      }
    } catch (e) {
      console.error('Init failed:', e);
      showPlayerError('App init failed: ' + e.message);
    }
  }

  function applyStoredSettings() {
    try {
      var playlists = settings.getPlaylists();
      if (playlists.length) {
        els.playlistUrls.value = playlists.map(function(p) { return p.url; }).join('\n');
      }
      els.video.volume = settings.getVolume();
      els.video.muted = settings.getMuted();
      updateVolumeIcon();
    } catch (e) { console.warn('applyStoredSettings failed:', e); }
  }

  function setupEventListeners() {
    els.btnSettings.addEventListener('click', function() { openSettings(); });
    els.btnCloseSettings.addEventListener('click', function() { closeSettings(); });
    els.btnSaveSettings.addEventListener('click', function() { saveSettings(); });
    els.btnResetDefaults.addEventListener('click', function() { resetDefaults(); });
    els.btnBack.addEventListener('click', function() { closePlayer(); });
    if (els.btnBackLoading) els.btnBackLoading.addEventListener('click', function() { if (player.currentChannel) closePlayer(); });
    // Touch devices (TV/phone browsers) don't get mousemove — reveal controls on any tap
    els.playerOverlay.addEventListener('touchstart', function() { showControls(); }, { passive: true });
    els.btnPlayPause.addEventListener('click', function() { player.playPause(); updatePlayPauseIcon(); });
    els.btnVolume.addEventListener('click', function() { player.toggleMute(); updateVolumeIcon(); });
    els.btnFullscreen.addEventListener('click', function() { player.requestFullscreen(); });
    els.btnRetry.addEventListener('click', function() { if (player.currentChannel) { hideError(); player.play(player.currentChannel); } });
    els.btnCloseError.addEventListener('click', function() { hideError(); });
    els.btnSearch.addEventListener('click', function() { toggleSearch(); });
    els.btnClearSearch.addEventListener('click', function() { clearSearch(); });
    els.searchInput.addEventListener('input', function(e) { filterBySearch(e.target.value); });
    els.btnFavorites.addEventListener('click', function() { isFavoritesOnly = !isFavoritesOnly; els.btnFavorites.classList.toggle('active', isFavoritesOnly); renderChannels(); });
    if (els.btnHealthScan) els.btnHealthScan.addEventListener('click', function() { runHealthScan(false); });
    if (els.btnExportM3u8) els.btnExportM3u8.addEventListener('click', function() { exportPlaylist(); });
    els.btnFavoritePlayer = document.getElementById('btn-favorite-channel');
    if (els.btnFavoritePlayer) els.btnFavoritePlayer.addEventListener('click', function() {
      if (player.currentChannel) { toggleFavorite(player.currentChannel.id); updateFavoriteButton(); }
    });
    els.video.addEventListener('playing', function() { hideLoading(); hideError(); showControls(); updateDiag(); try { settings.setLastChannel(player.currentChannel ? player.currentChannel.id : null); } catch(e) {} });
    els.video.addEventListener('loadedmetadata', function() { updateDiag(); });
    els.video.addEventListener('pause', function() { updatePlayPauseIcon(); });
    els.video.addEventListener('waiting', function() { showLoading(); });
    els.video.addEventListener('canplay', function() { hideLoading(); });
    els.video.addEventListener('ended', function() { closePlayer(); });
    els.video.addEventListener('error', function(e) { hideLoading(); var err = els.video.error; showPlayerError('Video error: ' + (err ? err.message : 'Unknown')); });
    els.playerOverlay.addEventListener('mousemove', function() { showControls(); });
    els.playerOverlay.addEventListener('mouseleave', function() { hideControls(); });

    // Diagnostics close (guarded: markup must exist before this runs)
    if (els.btnCloseDiag && els.diagOverlay) {
      els.btnCloseDiag.addEventListener('click', function() {
        els.diagOverlay.classList.add('hidden');
      });
    }
  }

  async function loadAllPlaylists() {
    showLoadingUI('Loading channels...');
    var sources = [];
    try { sources = sources.concat(window.DEFAULT_PLAYLISTS || []); } catch(e) {}
    try { settings.getPlaylists().forEach(function(p) { sources.push({ name: p.name, url: p.url, group: p.name }); }); } catch(e) {}
    allChannels = [];
    var errors = [];
    for (var i = 0; i < sources.length; i++) {
      var source = sources[i];
      try {
        var channels = await PlaylistParser.fetch(source.url);
        channels.forEach(function(c) { if (!c.group) c.group = source.group || 'General'; if (!c.id) c.id = PlaylistParser.makeId(c.name); });
        allChannels = allChannels.concat(channels);
      } catch (e) { errors.push(source.name + ': ' + e.message); }
    }
    var existingIds = new Set(allChannels.map(function(c) { return c.id; }));
    try { window.DIRECT_CHANNELS.forEach(function(c) { if (!existingIds.has(c.id)) { allChannels.push(c); existingIds.add(c.id); } }); } catch(e) {}
    var seenUrls = new Set();
    allChannels = allChannels.filter(function(c) { if (seenUrls.has(c.url)) return false; seenUrls.add(c.url); return true; });
    // Drop channels known to be dead from a previous health scan
    var deadCount = 0;
    allChannels = allChannels.filter(function(c) { if (health.isDead(c.url)) { deadCount++; return false; } return true; });
    if (deadCount) console.info('Filtered ' + deadCount + ' dead channels from cache.');
    // Assign channel numbers (IPTV-style presets)
    allChannels.forEach(function(c, i) { c.pnr = i + 1; });
    hideLoadingUI();
    renderSidebar();
    renderChannels();
    if (errors.length) console.warn('Some playlists failed:', errors);
  }

  function showLoadingUI(msg) { var p = els.loadingOverlay.querySelector('p'); if (p) p.textContent = msg; els.loadingOverlay.classList.remove('hidden'); if (els.btnBackLoading) els.btnBackLoading.classList.add('hidden'); }
  function hideLoadingUI() { els.loadingOverlay.classList.add('hidden'); }

  /**
   * Probe every channel from this device and permanently drop dead ones.
   * Called from Settings ("Scan & remove dead streams") or automatically
   * on start when the cache has never been populated.
   */
  async function runHealthScan(force) {
    if (!els.btnHealthScan) return;
    var btn = els.btnHealthScan;
    btn.disabled = true;
    var setStatus = function(t) { if (els.healthStatus) els.healthStatus.textContent = t; };
    try {
      setStatus('Scanning ' + allChannels.length + ' channels...');
      var res = await health.scan(allChannels, {
        concurrency: 14,
        force: force,
        onProgress: function(done, total, alive, dead) {
          setStatus('Scanning ' + done + '/' + total + ' — alive: ' + alive + ', dead: ' + dead);
        }
      });
      setStatus('Done — ' + res.alive + ' alive, ' + res.dead + ' dead removed.');
      if (res.dead > 0) {
        var deadSet = res.deadUrls;
        allChannels = allChannels.filter(function(c) { return !deadSet.has(c.url); });
        allChannels.forEach(function(c, i) { c.pnr = i + 1; });
        renderSidebar(); renderChannels();
      }
    } catch (e) {
      setStatus('Scan failed: ' + e.message);
    }
    btn.disabled = false;
  }

  function renderSidebar() {
    var groups = new Set(allChannels.map(function(c) { return c.group || 'General'; }));
    var favs = settings.data.favorites || [];
    var ordered = DEFAULT_GROUPS.filter(function(g) { return groups.has(g); });
    var rest = Array.from(groups).filter(function(g) { return DEFAULT_GROUPS.indexOf(g) === -1; }).sort();
    var allGroups = ['All'];
    if (favs.length) allGroups.push('Favorites');
    allGroups = allGroups.concat(ordered).concat(rest);
    els.categoryList.innerHTML = allGroups.map(function(group) {
      var active = (group === currentCategory) ? 'active' : '';
      return '<li data-group="' + escapeHtml(group) + '" class="' + active + '" role="button" tabindex="0" aria-label="' + escapeHtml(group) + '">' + escapeHtml(group) + '</li>';
    }).join('');
    els.categoryList.querySelectorAll('li').forEach(function(li) {
      li.addEventListener('click', function() { currentCategory = li.dataset.group; renderSidebar(); renderChannels(); currentFocusIndex = 0; });
      li.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { currentCategory = li.dataset.group; renderSidebar(); renderChannels(); currentFocusIndex = 0; } });
    });
  }

  function renderChannels() {
    var channels = allChannels;
    if (currentCategory === 'Favorites') { channels = channels.filter(function(c) { return isFavorite(c.id); }); }
    else if (currentCategory !== 'All') { channels = channels.filter(function(c) { return (c.group || 'General') === currentCategory; }); }
    var search = els.searchInput.value.toLowerCase().trim();
    if (search) { channels = channels.filter(function(c) { return c.name.toLowerCase().indexOf(search) !== -1; }); }
    filteredChannels = channels;
    els.emptyState.style.display = channels.length ? 'none' : 'block';
    var defLogo = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22240%22 height=%22135%22%3E%3Crect width=%22240%22 height=%22135%22 fill=%22%231a1a1a%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23666%22 font-size=%2218%22%3E%3C/text%3E%3C/svg%3E';
    var html = channels.map(function(ch, idx) {
      var logoUrl = ch.logo || defLogo;
      return '<div class="channel-card" data-index="' + idx + '" role="button" tabindex="0" aria-label="' + escapeHtml(ch.name) + '">'
        + '<span class="channel-pnr">' + ch.pnr + '</span>'
        + '<img class="channel-thumb" src="' + logoUrl + '" alt="' + escapeHtml(ch.name) + '" onerror="this.onerror=null;this.src=window.TVPLAY_FALLBACK_LOGO">'
        + '<button class="channel-fav' + (isFavorite(ch.id) ? ' active' : '') + '" data-fav="' + escapeHtml(ch.id) + '" title="Add to favorites">&#9733;</button>'
        + '<div class="channel-name">' + escapeHtml(ch.name) + '</div>'
        + '<div class="channel-group">' + escapeHtml(ch.group || 'General') + '</div>'
        + '</div>';
    }).join('');
    els.channelGrid.innerHTML = html;
    els.channelGrid.querySelectorAll('.channel-card').forEach(function(card) {
      card.addEventListener('click', function(e) {
        if (e.target && e.target.classList && e.target.classList.contains('channel-fav')) {
          var fid = e.target.dataset.fav;
          toggleFavorite(fid);
          e.target.classList.toggle('active', isFavorite(fid));
          return;
        }
        var idx = parseInt(card.dataset.index, 10); playChannel(filteredChannels[idx]);
      });
      card.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); var idx = parseInt(card.dataset.index, 10); playChannel(filteredChannels[idx]); } });
    });
  }

  function isFavorite(id) {
    try { return (settings.data.favorites || []).indexOf(id) !== -1; } catch (e) { return false; }
  }
  function toggleFavorite(id) {
    var favs = settings.data.favorites || [];
    var i = favs.indexOf(id);
    if (i === -1) favs.push(id); else favs.splice(i, 1);
    settings.data.favorites = favs; settings.save();
  }

  function filterBySearch(text) { renderChannels(); }
  function clearSearch() { els.searchInput.value = ''; renderChannels(); }
  function toggleSearch() { var show = els.searchBox.style.display === 'none'; els.searchBox.style.display = show ? 'block' : 'none'; if (show) els.searchInput.focus(); }
  function closeSearch() { els.searchBox.style.display = 'none'; els.searchInput.value = ''; try { els.searchInput.blur(); } catch (e) {} }

  function escapeHtml(text) { var div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

  function playChannel(channel) {
    if (!channel) return;
    player.play(channel);
    els.channelTitle.textContent = (channel.pnr ? channel.pnr + ' · ' : '') + channel.name;
    els.channelGroup.textContent = channel.group || 'General';
    if (channel.logo) { els.channelLogo.src = channel.logo; els.channelLogo.style.display = 'block'; } else { els.channelLogo.style.display = 'none'; }
    updateFavoriteButton();
    closeSearch(); closeSettings(); els.playerOverlay.classList.remove('hidden'); showControls(); currentFocusIndex = -1;
  }

  function updateFavoriteButton() {
    if (!els.btnFavoritePlayer || !player.currentChannel) return;
    els.btnFavoritePlayer.classList.toggle('active', isFavorite(player.currentChannel.id));
    els.btnFavoritePlayer.setAttribute('aria-label', isFavorite(player.currentChannel.id) ? 'Remove from favorites' : 'Add to favorites');
  }

  /**
   * IPTV-style zapping.
   * @param {number} delta - relative channel step in the master list
   */
  function zap(delta) {
    var cur = player.currentChannel;
    var idx = cur ? allChannels.findIndex(function(c) { return c.url === cur.url; }) : 0;
    if (idx === -1) idx = 0;
    var next = (idx + delta + allChannels.length) % allChannels.length;
    playChannel(allChannels[next]);
  }

  /**
   * Zap by preset number (IPTV channel number).
   * @param {number} n 1-based
   */
  function zapToNumber(n) {
    if (!n || n < 1 || n > 9999) return null;
    return allChannels[n - 1] || null;
  }

  function closePlayer() {
    player.pause();
    els.playerOverlay.classList.add('hidden');
    hideControls(); hideLoading(); hideError();
    // Return keyboard/remote focus to the last-watched channel card
    try {
      var ch = player.currentChannel;
      if (ch) {
        var idx = filteredChannels.findIndex(function(c) { return c.id === ch.id; });
        var cards = els.channelGrid.querySelectorAll('.channel-card');
        if (idx !== -1 && cards[idx]) { currentFocusIndex = idx; focusCard(cards[idx]); }
      }
    } catch (e) {}
  }
  function showLoading() { els.loadingOverlay.classList.remove('hidden'); if (els.btnBackLoading) els.btnBackLoading.classList.remove('hidden'); }
  function hideLoading() { els.loadingOverlay.classList.add('hidden'); }
  function showPlayerError(msg) { hideLoading(); els.errorMessage.textContent = msg || 'Failed to load stream.'; els.errorOverlay.classList.remove('hidden'); }
  function hideError() { els.errorOverlay.classList.add('hidden'); }

  function showControls() { els.playerControls.classList.add('visible'); clearTimeout(window._hideControlsTimer); window._hideControlsTimer = setTimeout(hideControls, 5000); }
  function hideControls() { els.playerControls.classList.remove('visible'); }

  function updatePlayPauseIcon() { els.btnPlayPause.textContent = els.video.paused ? '\u25BA' : '\u275A\u275A'; }
  function updateVolumeIcon() { if (els.video.muted || els.video.volume === 0) { els.btnVolume.textContent = '\u{1F507}'; } else { els.btnVolume.textContent = '\u{1F50A}'; } }

  function updateDiag() {
    try {
      var v = els.video;
      if (els.diagVideo) els.diagVideo.textContent = 'Video: ' + v.videoWidth + 'x' + v.videoHeight + ' readyState=' + v.readyState + ' paused=' + v.paused;
      if (els.diagError) els.diagError.textContent = 'Error: ' + (v.error ? v.error.message : 'none');
      if (els.diagStatus) els.diagStatus.textContent = 'Status: src=' + (v.currentSrc || 'none');
    } catch (e) {}
  }

  function openSettings() { els.settingsPanel.classList.remove('hidden'); }
  function closeSettings() { els.settingsPanel.classList.add('hidden'); }

  function saveSettings() {
    var text = els.playlistUrls.value.trim();
    var urls = text.split('\n').map(function(u) { return u.trim(); }).filter(function(u) { return u; });
    settings.data.customPlaylists = urls.map(function(url, idx) { return { name: 'Custom ' + (idx + 1), url: url }; });
    settings.save(); closeSettings(); loadAllPlaylists();
  }

  function resetDefaults() {
    settings.data.customPlaylists = []; settings.save(); els.playlistUrls.value = ''; closeSettings(); loadAllPlaylists();
  }

  /**
   * Build a self-contained M3U8 string from the current channel list.
   * `allChannels` already reflects every source (bundled + custom) with the
   * health filter applied, so this export is exactly what the app is showing.
   * @returns {string} M3U8 text
   */
  function buildPlaylistM3U8() {
    function esc(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;'); }
    var lines = ['#EXTM3U'];
    var d = new Date();
    lines.push('# Generated by TVPlay on ' + d.toISOString().slice(0, 10) + ' (self-contained)');
    lines.push('# Channels: ' + allChannels.length);
    lines.push('# All entries are free/legally published streams.');
    allChannels.forEach(function(c) {
      lines.push('#EXTINF:-1 tvg-logo="' + esc(c.logo) + '" group-title="' + esc(c.group || 'General') + '",' + esc(c.name));
      lines.push(c.url);
    });
    return lines.join('\n') + '\n';
  }

  /** Trigger a browser download of the current channel list as TVPlay.m3u8. */
  function exportPlaylist() {
    if (!els.btnExportM3u8) return;
    var status = function(t) { if (els.exportStatus) els.exportStatus.textContent = t; };
    if (!allChannels.length) { status('No channels to export yet.'); return; }
    try {
      var text = buildPlaylistM3U8();
      var blob = new Blob([text], { type: 'application/x-mpegurl' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'TVPlay.m3u8';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(url); }, 4000);
      status('Exported ' + allChannels.length + ' channels to TVPlay.m3u8.');
    } catch (e) {
      status('Export failed: ' + e.message);
    }
  }

  function handleGlobalKeydown(e) {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') { if (e.key === 'Escape') document.activeElement.blur(); return; }
    var inPlayer = !els.playerOverlay.classList.contains('hidden');
    var inSettings = !els.settingsPanel.classList.contains('hidden');
    if (inSettings) { if (e.key === 'Escape') closeSettings(); return; }
    if (inPlayer) { handlePlayerKeydown(e); return; }
    handleGridKeydown(e);
  }

  function handleGridKeydown(e) {
    var cards = els.channelGrid.querySelectorAll('.channel-card');
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); if (currentFocusIndex < cards.length - 1) currentFocusIndex++; focusCard(cards[currentFocusIndex]); break;
      case 'ArrowUp': e.preventDefault(); if (currentFocusIndex > 0) currentFocusIndex--; focusCard(cards[currentFocusIndex]); break;
      case 'ArrowRight': e.preventDefault(); var colsR = Math.floor(els.channelGrid.offsetWidth / 260) || 3; currentFocusIndex = (currentFocusIndex + colsR < cards.length) ? currentFocusIndex + colsR : Math.min(currentFocusIndex + 1, cards.length - 1); focusCard(cards[currentFocusIndex]); break;
      case 'ArrowLeft': e.preventDefault(); var colsL = Math.floor(els.channelGrid.offsetWidth / 260) || 3; currentFocusIndex = (currentFocusIndex - colsL >= 0) ? currentFocusIndex - colsL : Math.max(currentFocusIndex - 1, 0); focusCard(cards[currentFocusIndex]); break;
      case 'Enter': case ' ': e.preventDefault(); if (cards[currentFocusIndex]) { var idx = parseInt(cards[currentFocusIndex].dataset.index, 10); playChannel(filteredChannels[idx]); } break;
      case 'Backspace': case 'Escape': e.preventDefault(); closePlayer(); break;
    }
  }

  function handlePlayerKeydown(e) {
    // Digits: IPTV preset zapping, buffered for 1.2 s (e.g. "1", "2", "3" -> 123)
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      zapBuffer = (zapBuffer + e.key).slice(0, 4);
      if (els.channelTitle) els.channelTitle.textContent = '# ' + zapBuffer;
      clearTimeout(zapTimer);
      zapTimer = setTimeout(function() {
        var n = parseInt(zapBuffer, 10);
        zapBuffer = '';
        var ch = allChannels[n - 1];
        if (ch) playChannel(ch);
        else if (player.currentChannel) playChannel(player.currentChannel);
      }, 1200);
      return;
    }
    switch (e.key) {
      case 'Backspace': case 'Escape':
        if (zapBuffer) {
          // Cancel in-progress number zap without restarting the stream
          clearTimeout(zapTimer); zapBuffer = '';
          if (player.currentChannel && els.channelTitle) els.channelTitle.textContent = (player.currentChannel.pnr ? player.currentChannel.pnr + ' · ' : '') + player.currentChannel.name;
          e.preventDefault();
        } else { e.preventDefault(); closePlayer(); }
        break;
      case 'PageUp': case 'ChannelUp': e.preventDefault(); zap(+1); break;
      case 'PageDown': case 'ChannelDown': e.preventDefault(); zap(-1); break;
      case 'n': case 'N': e.preventDefault(); zap(+1); break;
      case 'b': case 'B': e.preventDefault(); zap(-1); break;
      case ' ': case 'k': case 'K': e.preventDefault(); player.playPause(); updatePlayPauseIcon(); break;
      case 'm': case 'M': e.preventDefault(); player.toggleMute(); updateVolumeIcon(); break;
      case 'ArrowUp': e.preventDefault(); els.video.volume = Math.min(1, els.video.volume + 0.1); try { settings.setVolume(els.video.volume); } catch(e) {} updateVolumeIcon(); break;
      case 'ArrowDown': e.preventDefault(); els.video.volume = Math.max(0, els.video.volume - 0.1); try { settings.setVolume(els.video.volume); } catch(e) {} updateVolumeIcon(); break;
      case 'f': case 'F': e.preventDefault(); player.requestFullscreen(); break;
      case 'i': case 'I': e.preventDefault(); showControls(); break;
    }
  }

  function focusCard(card) { card.focus(); card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }); }

  /** Mark the last-watched channel card so it's easy to spot when returning. */
  function highlightChannel(channel) {
    try {
      var idx = filteredChannels.findIndex(function(c) { return c.id === channel.id; });
      var cards = els.channelGrid.querySelectorAll('.channel-card');
      if (idx !== -1 && cards[idx]) {
        cards[idx].classList.add('last-watched');
        currentFocusIndex = idx;
        cards[idx].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('error', function(e) { console.error('Uncaught error:', e.message); });
  window.addEventListener('unhandledrejection', function(e) { console.error('Unhandled rejection:', e.reason); });

})();
