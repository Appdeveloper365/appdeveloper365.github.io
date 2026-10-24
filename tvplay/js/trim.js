/**
 * trim.js — TVPlay Trim Studio
 *
 * Self-contained clip editor:
 *   1. Source:  load a local video file, or record the currently playing
 *               live stream (MediaRecorder on the app's own <video>).
 *   2. Trim:    draggable IN/OUT handles on a canvas timeline with an
 *               adaptive time scale (1s..10min ticks) and zoom.
 *   3. Preview: plays ONLY the [in, out] range (loops) so you can judge
 *               the result before committing.
 *   4. Export:  real-time capture of the preview range → downloads .webm.
 *
 * The module owns its own <video> element, so the main player keeps
 * working while a clip is being edited.
 */
(function () {
  'use strict';

  var state = {
    srcUrl: null,        // object URL of loaded source
    srcKind: null,       // 'file' | 'record'
    duration: 0,
    tIn: 0,
    tOut: -1,
    zoomIndex: 3,        // px per second → ZOOMS
    loop: true,
    dragging: null,      // 'in' | 'out' | 'seek' | null
    exporting: false,
    recExport: null,     // MediaRecorder of the export render
    rec: null, recChunks: [], recTimer: null, recStart: 0,
    prevMutedSave: null,
    wasPlaying: false
  };

  var ZOOMS = [2, 3, 6, 10, 20, 40, 80]; // px per second

  var els = {};          // bound in init()
  function q(id) { return document.getElementById(id); }

  /* ================= helpers ================= */

  function fmt(t) {
    if (t < 0 || !isFinite(t)) return '--:--';
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function fmtMs(t) {
    var base = fmt(t);
    if (t < 0 || !isFinite(t)) return base;
    return base + '.' + String(Math.floor((t % 1) * 10));
  }
  function status(msg) { els.status.textContent = msg || ''; }

  function pickMime() {
    var candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(candidates[i])) {
        return candidates[i];
      }
    }
    return '';
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ================= lifecycle ================= */

  function open() {
    els.overlay.classList.remove('hidden');
    if (state.srcUrl) {
      // return to editor with previous clip intact
      els.source.classList.add('hidden');
      els.editor.classList.remove('hidden');
    } else {
      els.source.classList.remove('hidden');
      els.editor.classList.add('hidden');
    }
    status('');
  }

  function close() {
    if (state.exporting) { status('Export in progress — wait or press Export Stop.'); return; }
    if (state.rec) { stopRecord(); }   // leaving while recording? stop gracefully
    els.overlay.classList.add('hidden');
  }

  function resetSource() {
    if (state.exporting) { status('Rendering in progress — stop it first.'); return; }
    if (state.srcUrl) { URL.revokeObjectURL(state.srcUrl); state.srcUrl = null; }
    state.srcKind = null; state.duration = 0;
    state.tIn = 0; state.tOut = -1;
    els.stage.classList.remove('ready');
    els.editor.classList.add('hidden');
    els.source.classList.remove('hidden');
    els.video.removeAttribute('src');
    drawRuler();
  }

  /* ================= source A: local file ================= */

  function loadFile(file) {
    if (!file || !/^video\//.test(file.type)) { status('Not a video file.'); return; }
    resetSource();
    state.srcUrl = URL.createObjectURL(file);
    state.srcKind = 'file';
    els.video.src = state.srcUrl;
    status('Loading ' + file.name + ' …');
  }

  /* ================= source B: record live stream ================= */

  function startRecord() {
    var live = q('video');
    if (!live || live.readyState < 2 || !(live.captureStream || live.mozCaptureStream)) {
      status('Open a channel in the player first, then return here to record.');
      return;
    }
    var stream;
    try { stream = (live.captureStream || live.mozCaptureStream).call(live); }
    catch (e) { status('Capture refused by the browser: ' + e.message); return; }

    if (stream.getVideoTracks().length === 0) { status('No video track available to capture.'); return; }

    state.prevMutedSave = live.muted;
    live.muted = false; // captureStream yields the element's audio; keep it audible & captured

    var mime = pickMime();
    try {
      state.rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4e6 } : undefined);
    } catch (e) { status('MediaRecorder unavailable: ' + e.message); live.muted = state.prevMutedSave; return; }

    state.recChunks = [];
    state.rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) state.recChunks.push(ev.data); };
    state.rec.onstop = function () {
      live.muted = state.prevMutedSave;
      state.prevMutedSave = null;
      if (state.recTimer) { clearInterval(state.recTimer); state.recTimer = null; }
      var blob = new Blob(state.recChunks, { type: state.rec.mimeType || 'video/webm' });
      state.rec = null;
      if (!blob.size) { status('Recording produced no data (stream may have stalled).'); return; }
      approveBlob(blob, 'record');
    };
    state.rec.start(1000);
    state.recStart = Date.now();
    els.source.classList.add('hidden');
    els.recordBar.classList.remove('hidden');
    state.recTimer = setInterval(function () {
      var s = Math.floor((Date.now() - state.recStart) / 1000);
      els.recElapsed.textContent = fmt(s);
    }, 500);
    status('Recording live stream — recording continues even if you hide this panel. Press Stop when done.');
  }

  function stopRecord() {
    if (!state.rec) return;
    try { state.rec.stop(); } catch (e) { /* already stopped */ }
    els.recordBar.classList.add('hidden');
    status('Finalising recording…');
  }

  function approveBlob(blob, kind) {
    resetSource();
    state.srcUrl = URL.createObjectURL(blob);
    state.srcKind = kind;
    els.video.src = state.srcUrl;
    status(kind === 'record' ? 'Recording captured.' : 'File loaded.');
    els.stage.classList.add('ready');
  }

  /* ================= editor binding ================= */

  function videoLoaded(ev) {
    state.duration = els.video.duration || 0;
    if (state.duration === Infinity) { // webm blobs sometimes report Infinity until seeked
      els.video.currentTime = 1e7;
      els.video.addEventListener('timeupdate', function fix() {
        els.video.removeEventListener('timeupdate', fix);
        state.duration = els.video.duration || 0;
        els.video.currentTime = 0;
        afterDuration();
      });
      return;
    }
    afterDuration();
  }

  function afterDuration() {
    state.tIn = 0;
    state.tOut = state.duration;
    els.source.classList.add('hidden');
    els.editor.classList.remove('hidden');
    els.recordBar.classList.add('hidden');
    els.stage.classList.add('ready');
    status('Clip: 00:00 – ' + fmt(state.duration) + ' · drag the handles, or reposition with Playhead buttons.');
    layoutRuler();
    updateTimecodes();
  }

  function zoom() { return ZOOMS[state.zoomIndex]; }
  function zoomIn()  { state.zoomIndex = Math.min(ZOOMS.length - 1, state.zoomIndex + 1); layoutRuler(); }
  function zoomOut() { state.zoomIndex = Math.max(0, state.zoomIndex - 1); layoutRuler(); }

  // Ruler canvas width can exceed the screen; we scroll it. Height fixed.
  function layoutRuler() {
    if (!state.duration) return;
    var w = Math.max(els.rulerWrap.clientWidth, Math.ceil(state.duration * zoom()) + 160);
    els.ruler.style.width = w + 'px';
    els.ruler.width = w * (window.devicePixelRatio || 1);
    els.ruler.style.height = '64px';
    els.ruler.height = 64 * (window.devicePixelRatio || 1);
    els.rulerWrap.scrollLeft = 0;
    drawRuler();
  }

  function niceStep() {
    var candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800];
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i] * zoom() >= 70) return candidates[i];
    }
    return 1800;
  }

  function drawRuler() {
    var c = els.ruler, ctx = c.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var W = c.width / dpr, H = c.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // theme colors (match style.css vars where possible)
    var bg = '#141419', bar = '#24242c', clip = 'rgba(79,195,247,0.25)',
        clipBd = '#4fc3f7', tick = '#5a5a66', txt = '#9a9aa4', head = '#ff5252';

    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    var z = zoom();
    var xIn = state.tOut < 0 ? 0 : state.tIn * z;
    var xOut = state.tOut < 0 ? W : state.tOut * z;

    // dim outside-trim regions; hue the clip region
    ctx.fillStyle = bar; ctx.fillRect(0, 0, W, H);
    if (xOut > xIn) {
      ctx.fillStyle = clip; ctx.fillRect(xIn, 0, xOut - xIn, H - 18);
      ctx.strokeStyle = clipBd; ctx.lineWidth = 2;
      ctx.strokeRect(xIn, 2, xOut - xIn, H - 22);
    }

    // time scale ticks
    var step = niceStep();
    ctx.fillStyle = txt; ctx.font = '10px monospace'; ctx.textBaseline = 'top';
    for (var t = 0, i = 0; t * z <= W; t += step, i++) {
      var x = t * z;
      var major = i % 1 === 0;
      ctx.fillStyle = tick;
      ctx.fillRect(x, major ? 26 : 34, 1, major ? 12 : 6);
      ctx.fillStyle = txt;
      ctx.fillText(fmt(t), x + 3, major ? 40 : 0);
    }

    // playhead
    var px = els.video.currentTime * z;
    ctx.fillStyle = head; ctx.fillRect(px - 1, 0, 2, H - 4);

    // handles
    drawHandle(ctx, xIn, true);
    drawHandle(ctx, xOut, false);
  }

  function drawHandle(ctx, x, isIn) {
    ctx.fillStyle = isIn ? '#66bb6a' : '#ef5350';
    ctx.beginPath();
    ctx.moveTo(x, 4); ctx.lineTo(x + (isIn ? 10 : -10), 4);
    ctx.lineTo(x, 20); ctx.lineTo(x + (isIn ? 10 : -10), 20);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(x - 2, 4, 4, 20);
  }

  function updateTimecodes() {
    els.tcIn.textContent  = fmtMs(state.tIn);
    els.tcOut.textContent = fmtMs(state.tOut);
    els.tcDur.textContent = fmtMs(Math.max(0, (state.tOut - state.tIn)));
    var pct = state.duration ? Math.round(els.video.currentTime / state.duration * 100) : 0;
    els.tcPos.textContent = fmtMs(els.video.currentTime) + ' · ' + pct + '%';
  }

  /* ---------- ruler pointer interaction ---------- */

  function rulerPos(ev) {
    var r = els.ruler.getBoundingClientRect();
    var clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
    return clamp(clientX - r.left, 0, r.width) / zoom();
  }

  function nearHandle(t) {
    var epsilon = 12 / zoom();
    if (Math.abs(t - state.tIn) <= epsilon) return 'in';
    if (Math.abs(t - state.tOut) <= epsilon) return 'out';
    return null;
  }

  function onRulerDown(ev) {
    if (state.exporting || !state.duration) return;
    ev.preventDefault();
    var t = rulerPos(ev);
    state.dragging = nearHandle(t) || 'seek';   // null → scrub the playhead
    if (state.dragging === 'seek' && !els.video.paused) {
      state.wasPlaying = true;
      els.video.pause();
    } else { state.wasPlaying = false; }
    moveRulerDrag(ev);
    window.addEventListener('pointermove', moveRulerDrag, { passive: false });
    window.addEventListener('pointerup', onRulerUp);
  }

  function onRulerUp() {
    state.dragging = null;
    window.removeEventListener('pointermove', moveRulerDrag);
    window.removeEventListener('pointerup', onRulerUp);
    if (state.wasPlaying) { state.wasPlaying = false; els.video.play().catch(function () {}); }
  }

  function moveRulerDrag(ev) {
    if (!state.dragging) return;
    if (ev.cancelable) ev.preventDefault();
    var t = clamp(rulerPos(ev), 0, state.duration);
    if (state.dragging === 'in')       state.tIn  = clamp(t, 0, state.tOut - 0.5);
    else if (state.dragging === 'out') state.tOut = clamp(t, state.tIn + 0.5, state.duration);
    else                                els.video.currentTime = t;
    drawRuler(); updateTimecodes();
  }

  /* ---------- transport & marker buttons (TV-remote friendly) ---------- */

  function previewPlay() {
    if (!state.duration || state.exporting) return;
    var v = els.video;
    if (v.currentTime >= state.tOut - 0.05 || v.currentTime < state.tIn) {
      v.currentTime = state.tIn;
    }
    v.play();
  }
  function previewStop() { els.video.pause(); }

  function setIn()  { state.tIn = clamp(els.video.currentTime, 0, state.tOut - 0.5); drawRuler(); updateTimecodes(); }
  function setOut() { state.tOut = clamp(els.video.currentTime, state.tIn + 0.5, state.duration); drawRuler(); updateTimecodes(); }
  function nudge(who, dt) {
    if (who === 'in') state.tIn = clamp(state.tIn + dt, 0, state.tOut - 0.5);
    else state.tOut = clamp(state.tOut + dt, state.tIn + 0.5, state.duration);
    drawRuler(); updateTimecodes();
  }
  function toIn()  { els.video.currentTime = state.tIn; }
  function toOut() { els.video.currentTime = state.tOut; }

  /* ================= export ================= */

  function doExport() {
    if (state.exporting || !state.duration) return;
    if (state.tOut - state.tIn < 1) { status('Clip too short — at least 1 second.'); return; }
    var v = els.video;
    var cap = v.captureStream || v.mozCaptureStream;
    if (!cap || !window.MediaRecorder) { status('This browser cannot render clips (no captureStream / MediaRecorder).'); return; }

    state.exporting = true;
    setExportUI(true);
    status('Rendering clip… (runs in real time — ' + fmt(state.tOut - state.tIn) + ')');

    v.currentTime = state.tIn;
    state.prevMutedSave = v.muted;
    v.muted = false;

    var onReady = function () {
      var stream = cap.call(v);
      var rec;
      var mime = pickMime();
      try {
        rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4e6 } : undefined);
      } catch (e) {
        state.exporting = false; setExportUI(false); status('Export failed: ' + e.message); return;
      }
      state.recExport = rec;
      var chunks = [];
      rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
      rec.onstop = function () {
        var aborted = !state.exporting;   // abortExport flipped it before stopping
        state.exporting = false;
        state.recExport = null;
        setExportUI(false);
        v.pause();
        if (state.prevMutedSave !== null) { v.muted = state.prevMutedSave; state.prevMutedSave = null; }
        if (aborted) { status('Rendering stopped — nothing was saved.'); return; }
        var blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
        if (!blob.size) { status('Export produced empty data — try a slightly later IN point.'); return; }
        downloadBlob(blob);
        status('Saved tvplay-clip-….webm (' + Math.round(blob.size / 1024) + ' KB)');
      };

      var watch = function () {
        var pct = Math.round((v.currentTime - state.tIn) / (state.tOut - state.tIn) * 100);
        els.exportBar.style.width = clamp(pct, 0, 100) + '%';
        if (v.currentTime >= state.tOut - 0.05 || v.ended) {
          v.removeEventListener('timeupdate', watch);
          try { rec.stop(); } catch (e) { /* */ }
          els.exportBar.style.width = '100%';
        }
      };
      v.addEventListener('timeupdate', watch);
      rec.start(1000);
      v.play();
      status('Rendering… rendering continues even if the preview is paused.');
    };
    if (v.seeking) {
      v.addEventListener('seeked', function once() { v.removeEventListener('seeked', once); onReady(); }, { once: true });
    } else {
      onReady();
    }
  }

  function abortExport() {
    if (!state.exporting) return;
    state.exporting = false;          // onstop checks this → discards data, no download
    if (state.recExport) { try { state.recExport.stop(); } catch (e) {} state.recExport = null; }
    setExportUI(false);
    els.video.pause();
    if (state.prevMutedSave !== null) { els.video.muted = state.prevMutedSave; state.prevMutedSave = null; }
    status('Rendering stopped — nothing was saved. Adjust handles and try again.');
  }

  function setExportUI(busy) {
    els.btnExport.textContent = busy ? '⏹ Stop Render' : '⬇ Download Clip';
    els.exportRow.classList.toggle('exporting', busy);
    if (busy) els.exportBar.style.width = '0%';
  }

  function downloadBlob(blob) {
    var a = document.createElement('a');
    var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    a.href = URL.createObjectURL(blob);
    a.download = 'tvplay-clip-' +
      d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
      '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.webm';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  /* ================= wiring ================= */

  function init() {
    // key → DOM id (markup uses kebab-case)
    var IDS = {
      overlay: 'trim-overlay', stage: 'trim-stage', video: 'trim-video',
      ruler: 'trim-ruler', rulerWrap: 'trim-ruler-wrap', file: 'trim-file',
      editor: 'trim-editor', source: 'trim-source', status: 'trim-status',
      recordBar: 'trim-record-bar', recElapsed: 'trim-rec-elapsed',
      tcIn: 'tc-in', tcOut: 'tc-out', tcDur: 'tc-dur', tcPos: 'tc-pos',
      btnLoadFile: 'btn-trim-loadfile', btnRecord: 'btn-trim-record',
      btnTrimClose: 'btn-trim-close', btnStopRecord: 'btn-trim-stop-record',
      btnPreviewPlay: 'btn-trim-play', btnPreviewStop: 'btn-trim-pause',
      btnSetIn: 'btn-trim-set-in', btnSetOut: 'btn-trim-set-out',
      btnToIn: 'btn-trim-to-in', btnToOut: 'btn-trim-to-out',
      btnZoomIn: 'btn-trim-zoom-in', btnZoomOut: 'btn-trim-zoom-out',
      chkLoop: 'chk-loop', btnExport: 'btn-trim-export',
      exportBar: 'trim-export-bar', exportRow: 'trim-export-row'
    };
    Object.keys(IDS).forEach(function (key) {
      var el = q(IDS[key]);
      if (!el) throw new Error('trim.js missing element #' + IDS[key]);
      els[key] = el;
    });

    els.video.addEventListener('loadedmetadata', videoLoaded);
    els.video.addEventListener('timeupdate', function () {
      if (state.exporting) { updateTimecodes(); return; }
      if (state.duration && (els.video.currentTime > state.tOut || els.video.currentTime < state.tIn - 0.5)) {
        if (els.chkLoop.checked) els.video.currentTime = state.tIn;
        else { els.video.pause(); els.video.currentTime = state.tOut; }
      }
      updateTimecodes();
      if (state.dragging) drawRuler(); // playhead follows during scout seeks
    });

    els.btnLoadFile.addEventListener('click', function () { els.file.click(); });
    els.file.addEventListener('change', function () {
      if (els.file.files && els.file.files[0]) loadFile(els.file.files[0]);
      els.file.value = '';
    });
    els.btnRecord.addEventListener('click', startRecord);
    els.btnStopRecord.addEventListener('click', stopRecord);

    q('btn-trim').addEventListener('click', open);
    els.btnTrimClose.addEventListener('click', close);
    els.ruler.addEventListener('pointerdown', onRulerDown);
    els.ruler.addEventListener('touchstart', function (ev) { ev.preventDefault(); }, { passive: false });

    q('btn-trim-play').addEventListener('click', previewPlay);
    q('btn-trim-pause').addEventListener('click', previewStop);
    els.btnSetIn.addEventListener('click', function () { setIn();  toIn(); });
    els.btnSetOut.addEventListener('click', function () { setOut(); toOut(); });
    els.btnToIn.addEventListener('click', toIn);
    els.btnToOut.addEventListener('click', toOut);
    els.chkLoop.addEventListener('change', function () { state.loop = els.chkLoop.checked; });

    q('btn-nudge-in-minus').addEventListener('click',  function () { nudge('in', -0.5); });
    q('btn-nudge-in-plus').addEventListener('click',   function () { nudge('in', 0.5); });
    q('btn-nudge-out-minus').addEventListener('click', function () { nudge('out', -0.5); });
    q('btn-nudge-out-plus').addEventListener('click',  function () { nudge('out', 0.5); });
    els.btnZoomIn.addEventListener('click', zoomIn);
    els.btnZoomOut.addEventListener('click', zoomOut);

    q('btn-trim-reset').addEventListener('click', resetSource);
    els.btnExport.addEventListener('click', function () {
      if (state.exporting) abortExport(); else doExport();
    });

    layoutRuler();
    window.addEventListener('resize', layoutRuler);
    drawRuler();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
