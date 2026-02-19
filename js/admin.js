/* ============================================
   ADMIN PANEL - Login & Asset Upload Logic
   V4: Fixed init, explicit save buttons, debug
   ============================================ */

(function () {
    'use strict';

    console.log('[admin.js] IIFE starting...');

    // ---- CONFIG ----
    var ADMIN_USER = 'hi';
    var ADMIN_PASS = 'hi123';
    var DEFAULT_SPRITE_W = 85;
    var DEFAULT_SPRITE_H = 60;
    var SPRITE_FRAMES = 3;

    // ---- STORAGE KEYS ----
    var KEY_BIRD = 'customBirdSprite';
    var KEY_BIRD_SIZE = 'customBirdSize';
    var KEY_CROP = 'customBirdCrop';
    var KEY_WING_LIST = 'customSounds_wing';
    var KEY_HIT_LIST = 'customSounds_hit';
    var KEY_LOSE_LIST = 'customSounds_lose';

    // ---- CROP EDITOR STATE ----
    var cropEditor = {
        canvas: null, ctx: null, img: null,
        sx: 0, sy: 0, sw: 0, sh: 0,
        dragging: false, dragStart: { x: 0, y: 0 },
        scale: 1
    };

    // ---- AUDIO TRIM STATE ----
    var trimState = {
        audioCtx: null, buffer: null, dataUrl: null,
        startPct: 0, endPct: 100,
        storageKey: null, soundIdx: null,
        playing: false, sourceNode: null
    };

    // ---- HELPERS ----
    function $(id) { return document.getElementById(id); }

    function showToast(msg, type) {
        var toast = $('admin-toast');
        if (!toast) { console.warn('[admin] toast element not found'); return; }
        toast.textContent = msg;
        toast.className = 'admin-toast ' + (type || 'success');
        void toast.offsetWidth;
        toast.classList.add('show');
        setTimeout(function () { toast.classList.remove('show'); }, 2500);
    }

    function showOverlay(id) { var el = $(id); if (el) el.classList.add('active'); }
    function hideOverlay(id) { var el = $(id); if (el) el.classList.remove('active'); }

    function getJSON(key, fallback) {
        try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
        catch (e) { return fallback; }
    }

    function safeAddListener(id, event, handler) {
        var el = $(id);
        if (el) {
            el.addEventListener(event, handler);
            return true;
        } else {
            console.error('[admin] Element not found: #' + id);
            return false;
        }
    }

    // ---- ADMIN BUTTON ----
    function onAdminBtnClick() {
        showOverlay('login-modal');
        var u = $('login-user'), p = $('login-pass'), e = $('login-error');
        if (u) { u.value = ''; u.focus(); }
        if (p) p.value = '';
        if (e) e.textContent = '';
    }

    // ---- LOGIN ----
    function onLoginSubmit(e) {
        e.preventDefault();
        var user = ($('login-user') || {}).value || '';
        var pass = ($('login-pass') || {}).value || '';
        if (user.trim() === ADMIN_USER && pass === ADMIN_PASS) {
            hideOverlay('login-modal');
            openAdminPanel();
        } else {
            var err = $('login-error');
            if (err) err.textContent = 'Invalid credentials. Try again.';
            var p = $('login-pass');
            if (p) p.value = '';
        }
    }

    // ---- ADMIN PANEL ----
    function openAdminPanel() {
        refreshPanelState();
        showOverlay('admin-panel');
    }

    function refreshPanelState() {
        try {
            // Face preview
            var birdData = localStorage.getItem(KEY_BIRD);
            var facePreview = $('face-preview');
            var faceStatus = $('face-status');
            if (facePreview && faceStatus) {
                if (birdData) {
                    facePreview.src = birdData;
                    facePreview.style.display = 'block';
                    faceStatus.className = 'status-badge active';
                    faceStatus.innerHTML = '&#10003; Custom sprite active';
                } else {
                    facePreview.style.display = 'none';
                    faceStatus.className = 'status-badge inactive';
                    faceStatus.innerHTML = '&#9679; Using default bird';
                }
            }

            // Sprite size
            var sizeData = getJSON(KEY_BIRD_SIZE, null);
            var sw = $('sprite-width'), sh = $('sprite-height');
            var swv = $('size-w-val'), shv = $('size-h-val');
            if (sw && sh && swv && shv) {
                var w = sizeData ? sizeData.w : DEFAULT_SPRITE_W;
                var h = sizeData ? sizeData.h : DEFAULT_SPRITE_H;
                sw.value = w; sh.value = h;
                swv.textContent = w + 'px'; shv.textContent = h + 'px';
            }

            // Sound lists
            refreshSoundSection(KEY_WING_LIST, 'wing-status', 'wing-list', 'Flap');
            refreshSoundSection(KEY_HIT_LIST, 'hit-status', 'hit-list', 'Hit');
            refreshSoundSection(KEY_LOSE_LIST, 'lose-status', 'lose-list', 'Fail');
        } catch (err) {
            console.error('[admin] refreshPanelState error:', err);
        }
    }

    function refreshSoundSection(key, statusId, listId, label) {
        var list = getJSON(key, []);
        var statusEl = $(statusId);
        var listEl = $(listId);
        if (!statusEl || !listEl) return;

        listEl.innerHTML = '';
        if (list.length > 0) {
            statusEl.className = 'status-badge active';
            statusEl.innerHTML = '&#10003; ' + list.length + ' custom ' + label + ' sound(s)';
            list.forEach(function (dataUrl, idx) {
                if (typeof dataUrl !== 'string') dataUrl = '';
                var div = document.createElement('div');
                div.className = 'sound-list-item';

                var numSpan = document.createElement('span');
                numSpan.className = 'sound-num';
                numSpan.textContent = '#' + (idx + 1);
                div.appendChild(numSpan);

                var audio = document.createElement('audio');
                audio.controls = true;
                audio.className = 'audio-preview';
                audio.src = dataUrl;
                div.appendChild(audio);

                var trimBtn = document.createElement('button');
                trimBtn.className = 'btn-trim-sound';
                trimBtn.title = 'Trim';
                trimBtn.innerHTML = '&#9986;';
                trimBtn.addEventListener('click', (function (k, i) {
                    return function () { openTrimEditor(k, i); };
                })(key, idx));
                div.appendChild(trimBtn);

                var removeBtn = document.createElement('button');
                removeBtn.className = 'btn-remove-sound';
                removeBtn.title = 'Remove';
                removeBtn.innerHTML = '&#10006;';
                removeBtn.addEventListener('click', (function (k, i) {
                    return function () {
                        var arr = getJSON(k, []);
                        arr.splice(i, 1);
                        try { localStorage.setItem(k, JSON.stringify(arr)); } catch (e) { }
                        showToast('Sound removed.', 'success');
                        refreshPanelState();
                    };
                })(key, idx));
                div.appendChild(removeBtn);

                listEl.appendChild(div);
            });
        } else {
            statusEl.className = 'status-badge inactive';
            statusEl.innerHTML = '&#9679; Using default ' + label + ' sound';
        }
    }

    // ========================================
    // CANVAS CROP EDITOR
    // ========================================

    function initCropEditor() {
        cropEditor.canvas = $('crop-canvas');
        if (!cropEditor.canvas) {
            console.warn('[admin] crop-canvas not found');
            return;
        }
        cropEditor.ctx = cropEditor.canvas.getContext('2d');

        cropEditor.canvas.addEventListener('mousedown', cropMouseDown);
        cropEditor.canvas.addEventListener('mousemove', cropMouseMove);
        cropEditor.canvas.addEventListener('mouseup', cropMouseUp);
        cropEditor.canvas.addEventListener('mouseleave', cropMouseUp);
        cropEditor.canvas.addEventListener('touchstart', cropTouchStart, { passive: false });
        cropEditor.canvas.addEventListener('touchmove', cropTouchMove, { passive: false });
        cropEditor.canvas.addEventListener('touchend', cropMouseUp);
    }

    function loadImageIntoCropEditor(dataUrl) {
        var img = new Image();
        img.onload = function () {
            cropEditor.img = img;
            var maxW = 460, maxH = 300;
            var scale = Math.min(maxW / img.width, maxH / img.height, 1);
            cropEditor.scale = scale;
            cropEditor.canvas.width = Math.ceil(img.width * scale);
            cropEditor.canvas.height = Math.ceil(img.height * scale);
            cropEditor.sx = 0; cropEditor.sy = 0;
            cropEditor.sw = img.width; cropEditor.sh = img.height;

            var saved = getJSON(KEY_CROP, null);
            if (saved) {
                cropEditor.sx = saved.x; cropEditor.sy = saved.y;
                cropEditor.sw = saved.w; cropEditor.sh = saved.h;
            }
            drawCropEditor();
            cropEditor.canvas.style.display = 'block';
            var sec = $('crop-editor-section');
            if (sec) sec.style.display = 'block';
        };
        img.src = dataUrl;
    }

    function drawCropEditor() {
        var c = cropEditor, ctx = c.ctx;
        if (!c.img) return;
        var s = c.scale;
        ctx.clearRect(0, 0, c.canvas.width, c.canvas.height);
        ctx.globalAlpha = 0.3;
        ctx.drawImage(c.img, 0, 0, c.canvas.width, c.canvas.height);
        ctx.globalAlpha = 1.0;
        var dx = c.sx * s, dy = c.sy * s, dw = c.sw * s, dh = c.sh * s;
        ctx.drawImage(c.img, c.sx, c.sy, c.sw, c.sh, dx, dy, dw, dh);
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(dx, dy, dw, dh);
        ctx.setLineDash([]);
        ctx.fillStyle = '#FFD700';
        [[dx, dy], [dx + dw, dy], [dx, dy + dh], [dx + dw, dy + dh]].forEach(function (p) {
            ctx.fillRect(p[0] - 4, p[1] - 4, 8, 8);
        });
        updateSpritePreview();
    }

    function canvasCoords(e) {
        var rect = cropEditor.canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function cropMouseDown(e) { e.preventDefault(); cropEditor.dragging = true; cropEditor.dragStart = canvasCoords(e); }
    function cropTouchStart(e) { e.preventDefault(); cropEditor.dragging = true; cropEditor.dragStart = canvasCoords(e.touches[0]); }
    function cropMouseMove(e) { if (cropEditor.dragging) updateCropSelection(canvasCoords(e)); }
    function cropTouchMove(e) { e.preventDefault(); if (cropEditor.dragging) updateCropSelection(canvasCoords(e.touches[0])); }
    function cropMouseUp() { cropEditor.dragging = false; }

    function updateCropSelection(pos) {
        var s = cropEditor.scale;
        var x1 = cropEditor.dragStart.x / s, y1 = cropEditor.dragStart.y / s;
        var x2 = pos.x / s, y2 = pos.y / s;
        var sx = Math.max(0, Math.min(x1, x2)), sy = Math.max(0, Math.min(y1, y2));
        var sw = Math.min(cropEditor.img.width - sx, Math.abs(x2 - x1));
        var sh = Math.min(cropEditor.img.height - sy, Math.abs(y2 - y1));
        if (sw > 5 && sh > 5) {
            cropEditor.sx = sx; cropEditor.sy = sy;
            cropEditor.sw = sw; cropEditor.sh = sh;
            drawCropEditor();
        }
    }

    function selectAllCrop() {
        if (!cropEditor.img) return;
        cropEditor.sx = 0; cropEditor.sy = 0;
        cropEditor.sw = cropEditor.img.width; cropEditor.sh = cropEditor.img.height;
        drawCropEditor();
    }

    function updateSpritePreview() {
        if (!cropEditor.img) return;
        var spriteW = parseInt(($('sprite-width') || {}).value) || DEFAULT_SPRITE_W;
        var spriteH = parseInt(($('sprite-height') || {}).value) || DEFAULT_SPRITE_H;
        var preview = $('sprite-preview-canvas');
        if (!preview) return;
        preview.width = spriteW; preview.height = spriteH;
        var ctx = preview.getContext('2d');
        ctx.clearRect(0, 0, spriteW, spriteH);
        ctx.drawImage(cropEditor.img, cropEditor.sx, cropEditor.sy, cropEditor.sw, cropEditor.sh, 0, 0, spriteW, spriteH);
        preview.style.display = 'block';
    }

    // ---- SAVE SPRITE ----
    function generateSprite() {
        if (!cropEditor.img) { showToast('Please select an image first.', 'error'); return; }
        var spriteW = parseInt(($('sprite-width') || {}).value) || DEFAULT_SPRITE_W;
        var spriteH = parseInt(($('sprite-height') || {}).value) || DEFAULT_SPRITE_H;
        try {
            localStorage.setItem(KEY_BIRD_SIZE, JSON.stringify({ w: spriteW, h: spriteH }));
            localStorage.setItem(KEY_CROP, JSON.stringify({ x: cropEditor.sx, y: cropEditor.sy, w: cropEditor.sw, h: cropEditor.sh }));
        } catch (e) { }
        var canvas = document.createElement('canvas');
        canvas.width = spriteW * SPRITE_FRAMES; canvas.height = spriteH;
        var ctx = canvas.getContext('2d');
        for (var i = 0; i < SPRITE_FRAMES; i++) {
            ctx.drawImage(cropEditor.img, cropEditor.sx, cropEditor.sy, cropEditor.sw, cropEditor.sh, spriteW * i, 0, spriteW, spriteH);
        }
        var dataURL = canvas.toDataURL('image/png');
        try {
            localStorage.setItem(KEY_BIRD, dataURL);
            showToast('Sprite saved! Refresh to apply.', 'success');
            refreshPanelState();
        } catch (err) { showToast('Storage full!', 'error'); }
    }

    function onFaceFileChange() {
        var fileInput = $('face-file');
        if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
        var reader = new FileReader();
        reader.onload = function (e) {
            try { localStorage.setItem('customBirdRaw', e.target.result); }
            catch (err) { showToast('Storage full!', 'error'); return; }
            loadImageIntoCropEditor(e.target.result);
        };
        reader.readAsDataURL(fileInput.files[0]);
    }

    function onFaceClear() {
        localStorage.removeItem(KEY_BIRD); localStorage.removeItem(KEY_BIRD_SIZE);
        localStorage.removeItem(KEY_CROP); localStorage.removeItem('customBirdRaw');
        var fi = $('face-file'); if (fi) fi.value = '';
        cropEditor.img = null;
        var cc = $('crop-canvas'); if (cc) cc.style.display = 'none';
        var sp = $('sprite-preview-canvas'); if (sp) sp.style.display = 'none';
        var es = $('crop-editor-section'); if (es) es.style.display = 'none';
        showToast('Custom sprite removed.', 'success');
        refreshPanelState();
    }

    // ========================================
    // AUDIO TRIM EDITOR
    // ========================================

    function openTrimEditor(key, idx) {
        var list = getJSON(key, []);
        if (idx >= list.length) return;
        var dataUrl = typeof list[idx] === 'string' ? list[idx] : '';
        trimState.storageKey = key; trimState.soundIdx = idx;
        trimState.dataUrl = dataUrl; trimState.startPct = 0; trimState.endPct = 100;
        var ts = $('trim-start'), te = $('trim-end'), tsv = $('trim-start-val'), tev = $('trim-end-val');
        if (ts) ts.value = 0; if (te) te.value = 100;
        if (tsv) tsv.textContent = '0%'; if (tev) tev.textContent = '100%';

        if (!trimState.audioCtx) {
            trimState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        fetch(dataUrl).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
            return trimState.audioCtx.decodeAudioData(buf);
        }).then(function (buffer) {
            trimState.buffer = buffer;
            drawWaveform();
            showOverlay('trim-modal');
        }).catch(function (e) { console.error('[trim] decode error:', e); showToast('Could not decode audio.', 'error'); });
    }

    function drawWaveform() {
        var canvas = $('waveform-canvas');
        if (!canvas || !trimState.buffer) return;
        var ctx = canvas.getContext('2d');
        var w = canvas.width = 460, h = canvas.height = 100;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, 0, w, h);
        var data = trimState.buffer.getChannelData(0);
        var step = Math.ceil(data.length / w), mid = h / 2;
        ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 1; ctx.beginPath();
        for (var i = 0; i < w; i++) {
            var min = 1, max = -1;
            for (var j = 0; j < step; j++) {
                var val = data[i * step + j] || 0;
                if (val < min) min = val; if (val > max) max = val;
            }
            ctx.moveTo(i, mid + min * mid); ctx.lineTo(i, mid + max * mid);
        }
        ctx.stroke();
        var startX = (trimState.startPct / 100) * w, endX = (trimState.endPct / 100) * w;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, startX, h); ctx.fillRect(endX, 0, w - endX, h);
        ctx.strokeStyle = '#34d399'; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(startX, 0); ctx.lineTo(startX, h);
        ctx.moveTo(endX, 0); ctx.lineTo(endX, h); ctx.stroke();
        var dur = trimState.buffer.duration;
        var st = (trimState.startPct / 100) * dur, et = (trimState.endPct / 100) * dur;
        var td = $('trim-duration');
        if (td) td.textContent = st.toFixed(2) + 's - ' + et.toFixed(2) + 's (' + (et - st).toFixed(2) + 's)';
    }

    function trimPreview() {
        if (!trimState.buffer || !trimState.audioCtx) return;
        if (trimState.playing && trimState.sourceNode) {
            trimState.sourceNode.stop(); trimState.playing = false;
            var btn = $('trim-preview-btn'); if (btn) btn.textContent = '\u25B6 Preview';
            return;
        }
        var buf = trimState.buffer;
        var startTime = (trimState.startPct / 100) * buf.duration;
        var endTime = (trimState.endPct / 100) * buf.duration;
        var source = trimState.audioCtx.createBufferSource();
        source.buffer = buf; source.connect(trimState.audioCtx.destination);
        source.start(0, startTime, endTime - startTime);
        trimState.sourceNode = source; trimState.playing = true;
        var btn = $('trim-preview-btn'); if (btn) btn.textContent = '\u23F9 Stop';
        source.onended = function () {
            trimState.playing = false;
            var b = $('trim-preview-btn'); if (b) b.textContent = '\u25B6 Preview';
        };
    }

    function trimSave() {
        if (!trimState.buffer || !trimState.audioCtx) return;
        var buf = trimState.buffer, sr = buf.sampleRate;
        var startSample = Math.floor((trimState.startPct / 100) * buf.length);
        var endSample = Math.floor((trimState.endPct / 100) * buf.length);
        var numSamples = endSample - startSample;
        if (numSamples < 100) { showToast('Selection too short.', 'error'); return; }
        var channels = buf.numberOfChannels;
        var newBuf = new AudioBuffer({ numberOfChannels: channels, length: numSamples, sampleRate: sr });
        for (var ch = 0; ch < channels; ch++) {
            var oldData = buf.getChannelData(ch), newData = newBuf.getChannelData(ch);
            for (var i = 0; i < numSamples; i++) newData[i] = oldData[startSample + i];
        }
        var wavBlob = bufferToWav(newBuf);
        var reader = new FileReader();
        reader.onload = function (e) {
            var list = getJSON(trimState.storageKey, []);
            list[trimState.soundIdx] = e.target.result;
            try {
                localStorage.setItem(trimState.storageKey, JSON.stringify(list));
                showToast('Trimmed audio saved!', 'success');
                hideOverlay('trim-modal'); refreshPanelState();
            } catch (err) { showToast('Storage full!', 'error'); }
        };
        reader.readAsDataURL(wavBlob);
    }

    function bufferToWav(buffer) {
        var nc = buffer.numberOfChannels, sr = buffer.sampleRate;
        var len = buffer.length * nc * 2 + 44;
        var out = new ArrayBuffer(len), v = new DataView(out), channels = [], pos = 44;
        function ws(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
        ws(0, 'RIFF'); v.setUint32(4, len - 8, true); ws(8, 'WAVE'); ws(12, 'fmt ');
        v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nc, true);
        v.setUint32(24, sr, true); v.setUint32(28, sr * nc * 2, true);
        v.setUint16(32, nc * 2, true); v.setUint16(34, 16, true);
        ws(36, 'data'); v.setUint32(40, buffer.length * nc * 2, true);
        for (var i = 0; i < nc; i++) channels.push(buffer.getChannelData(i));
        for (var s = 0; s < buffer.length; s++) {
            for (var ch = 0; ch < nc; ch++) {
                var sample = Math.max(-1, Math.min(1, channels[ch][s]));
                v.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                pos += 2;
            }
        }
        return new Blob([out], { type: 'audio/wav' });
    }

    // ========================================
    // SOUND SAVE (explicit save button)
    // ========================================

    function saveSound(fileInputId, storageKey, label) {
        var fileInput = $(fileInputId);
        if (!fileInput || !fileInput.files || !fileInput.files.length) {
            showToast('Please select audio file(s) for ' + label + ' first.', 'error');
            return;
        }
        var files = Array.prototype.slice.call(fileInput.files);
        var list = getJSON(storageKey, []);
        var loaded = 0;

        console.log('[saveSound] Saving ' + files.length + ' file(s) to ' + storageKey);

        files.forEach(function (file) {
            var reader = new FileReader();
            reader.onload = function (e) {
                var dataUrl = e.target.result;
                console.log('[saveSound] Read: ' + file.name + ' (' + dataUrl.length + ' chars)');
                list.push(dataUrl);
                loaded++;
                if (loaded === files.length) {
                    try {
                        var json = JSON.stringify(list);
                        console.log('[saveSound] Writing ' + json.length + ' bytes to localStorage key: ' + storageKey);
                        localStorage.setItem(storageKey, json);
                        // Verify
                        var check = localStorage.getItem(storageKey);
                        if (check) {
                            console.log('[saveSound] SUCCESS: verified ' + JSON.parse(check).length + ' sounds in ' + storageKey);
                            showToast(files.length + ' ' + label + ' sound(s) saved! Refresh to apply.', 'success');
                        } else {
                            console.error('[saveSound] FAILED: data not in localStorage after save!');
                            showToast('Save failed!', 'error');
                        }
                        refreshPanelState();
                    } catch (err) {
                        console.error('[saveSound] Error:', err);
                        showToast('Storage full! Try a smaller file.', 'error');
                    }
                    fileInput.value = '';
                }
            };
            reader.onerror = function () {
                console.error('[saveSound] FileReader error: ' + file.name);
                showToast('Error reading file: ' + file.name, 'error');
            };
            reader.readAsDataURL(file);
        });
    }

    function clearAllSounds(storageKey, fileInputId, label) {
        localStorage.removeItem(storageKey);
        var fi = $(fileInputId); if (fi) fi.value = '';
        showToast('All ' + label + ' sounds removed.', 'success');
        refreshPanelState();
    }

    // ---- SLIDER LABELS ----
    function wireSlider(sliderId, labelId, suffix, onChange) {
        var slider = $(sliderId), label = $(labelId);
        if (!slider || !label) { console.warn('[admin] slider not found: #' + sliderId); return; }
        slider.addEventListener('input', function () {
            label.textContent = this.value + suffix;
            if (onChange) onChange();
        });
    }

    function setupBackdropClose(overlayId) {
        var el = $(overlayId);
        if (el) el.addEventListener('click', function (e) { if (e.target === this) hideOverlay(overlayId); });
    }

    // ---- INIT ----
    function init() {
        console.log('[admin] init() starting...');
        try {
            safeAddListener('admin-btn', 'click', onAdminBtnClick);
            safeAddListener('login-form', 'submit', onLoginSubmit);
            setupBackdropClose('login-modal');
            setupBackdropClose('admin-panel');
            setupBackdropClose('trim-modal');

            safeAddListener('logout-btn', 'click', function () {
                hideOverlay('admin-panel');
                showToast('Logged out.', 'success');
            });

            // Face
            safeAddListener('face-file', 'change', onFaceFileChange);
            safeAddListener('face-save-btn', 'click', generateSprite);
            safeAddListener('face-clear-btn', 'click', onFaceClear);
            safeAddListener('crop-select-all', 'click', selectAllCrop);

            // Size sliders
            wireSlider('sprite-width', 'size-w-val', 'px', function () { if (cropEditor.img) updateSpritePreview(); });
            wireSlider('sprite-height', 'size-h-val', 'px', function () { if (cropEditor.img) updateSpritePreview(); });

            // Init crop canvas
            initCropEditor();

            // --- SOUND SAVE BUTTONS ---
            console.log('[admin] Wiring sound save buttons...');
            safeAddListener('wing-save-btn', 'click', function () {
                console.log('[admin] wing-save-btn clicked');
                saveSound('wing-file', KEY_WING_LIST, 'Flap');
            });
            safeAddListener('wing-clear-btn', 'click', function () {
                clearAllSounds(KEY_WING_LIST, 'wing-file', 'Flap');
            });
            safeAddListener('hit-save-btn', 'click', function () {
                console.log('[admin] hit-save-btn clicked');
                saveSound('hit-file', KEY_HIT_LIST, 'Hit');
            });
            safeAddListener('hit-clear-btn', 'click', function () {
                clearAllSounds(KEY_HIT_LIST, 'hit-file', 'Hit');
            });
            safeAddListener('lose-save-btn', 'click', function () {
                console.log('[admin] lose-save-btn clicked');
                saveSound('lose-file', KEY_LOSE_LIST, 'Fail');
            });
            safeAddListener('lose-clear-btn', 'click', function () {
                clearAllSounds(KEY_LOSE_LIST, 'lose-file', 'Fail');
            });

            // Trim editor
            wireSlider('trim-start', 'trim-start-val', '%', function () {
                trimState.startPct = parseInt($('trim-start').value);
                if (trimState.startPct >= trimState.endPct) {
                    trimState.startPct = trimState.endPct - 1;
                    $('trim-start').value = trimState.startPct;
                    $('trim-start-val').textContent = trimState.startPct + '%';
                }
                drawWaveform();
            });
            wireSlider('trim-end', 'trim-end-val', '%', function () {
                trimState.endPct = parseInt($('trim-end').value);
                if (trimState.endPct <= trimState.startPct) {
                    trimState.endPct = trimState.startPct + 1;
                    $('trim-end').value = trimState.endPct;
                    $('trim-end-val').textContent = trimState.endPct + '%';
                }
                drawWaveform();
            });
            safeAddListener('trim-preview-btn', 'click', trimPreview);
            safeAddListener('trim-save-btn', 'click', trimSave);
            safeAddListener('trim-cancel-btn', 'click', function () {
                if (trimState.playing && trimState.sourceNode) {
                    trimState.sourceNode.stop(); trimState.playing = false;
                }
                hideOverlay('trim-modal');
            });

            // Load raw image if exists
            var raw = localStorage.getItem('customBirdRaw');
            if (raw) loadImageIntoCropEditor(raw);

            console.log('[admin] init() completed successfully!');
        } catch (err) {
            console.error('[admin] init() FAILED:', err);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('[admin.js] IIFE completed, readyState=' + document.readyState);
})();
