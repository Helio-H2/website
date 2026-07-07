// ── SOLARTOOLS COMMON LIBRARY ──────────────────────────────────────────────
// Loaded AFTER type-specific variant file (groundplants.js, parking.js, rooftop.js)
// which must set window.solarToolsConfig before this script runs.
//
// Access type-specific values via:
//   - window.solarToolsConfig.NORME
//   - window.solarToolsConfig.curType
//   - window.solarToolsConfig.CLRS
//   - window.solarToolsConfig.LBLS
//   - window.solarToolsConfig.MARGINS
//   - window.solarToolsConfig.AREA_DEFAULTS
//   - window.solarToolsConfig.isRoof (boolean: true for capannone, false otherwise)

// ── MAP ───────────────────────────────────────────────────────────────────
const map = L.map('map', { center: [41.9, 12.5], zoom: 6, maxZoom: 22 });
const tiles = {
    sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri', maxNativeZoom: 19, maxZoom: 22 }),
    str: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM', maxNativeZoom: 19, maxZoom: 22 }),
    cat: window.createCatastoLayer()
};
tiles.str.addTo(map);
L.control.scale({ imperial: false }).addTo(map);
const drawn = new L.FeatureGroup().addTo(map);

function setTile(t) {
    Object.values(tiles).forEach(l => map.removeLayer(l));
    tiles[t].addTo(map);
    document.getElementById('tSat').classList.toggle('on', t === 'sat');
    document.getElementById('tStr').classList.toggle('on', t === 'str');
    document.getElementById('tCat').classList.toggle('on', t === 'cat');
    if (t === 'cat') {
        map.setMinZoom(14);
        if (map.getZoom() < 14) map.setZoom(14);
    } else {
        map.setMinZoom(1);
    }
}

// ── PANEL ─────────────────────────────────────────────────────────────────
function togglePanel(force) {
    pOpen = force !== undefined ? force : !pOpen;
    document.getElementById('panel').classList.toggle('open', pOpen);
    document.getElementById('btnPanel').classList.toggle('on', pOpen);
    document.getElementById('confarrHam').style.display   = pOpen ? 'none' : '';
    document.getElementById('confarrClose').style.display = pOpen ? ''     : 'none';
    updateHud();
}

// ── PANEL CAROUSEL ────────────────────────────────────────────────────────
function prevArea() {
    if (!areas.length) return;
    panelAreaIdx = Math.max(0, panelAreaIdx - 1);
    renderAreaSlide(true);
    zoomToCurrentArea();
}
function nextArea() {
    if (!areas.length) return;
    panelAreaIdx = Math.min(areas.length - 1, panelAreaIdx + 1);
    renderAreaSlide(true);
    zoomToCurrentArea();
}

function zoomToCurrentArea() {
    const a = areas[panelAreaIdx];
    if (a?.layer) map.fitBounds(a.layer.getBounds(), { padding: [60, 60] });
}

function updateNavBtns() {
    const prev = document.getElementById('pNavPrev');
    const next = document.getElementById('pNavNext');
    const label = document.getElementById('pNavLabel');
    if (!prev || !next || !label) return;
    if (!areas.length) {
        prev.disabled = true; next.disabled = true;
        label.innerHTML = '<span style="font-size:.65rem;color:var(--muted)">Nessuna area</span>';
        return;
    }
    prev.disabled = panelAreaIdx <= 0;
    next.disabled = panelAreaIdx >= areas.length - 1;
    const _a = areas[panelAreaIdx];
    label.innerHTML = `<div style="font-family:'Syne',sans-serif;font-size:.72rem;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px">${esc(_a.name)}</div><div style="font-size:.56rem;color:var(--muted);margin-top:1px">${panelAreaIdx+1} / ${areas.length}</div>`;
}

// ── PANNELLO SECTION (azimut + panel count for current area) ─────────────
function renderPannelloSection() {
    const el = document.getElementById('pAreaInfo');
    if (!el) return;
    if (!areas.length) {
        el.innerHTML = '<div class="pai-empty">Seleziona un\'area per vedere azimut e pannelli</div>';
        return;
    }
    const a = areas[panelAreaIdx];
    const _def = window.solarToolsConfig.AREA_DEFAULTS[a.type] || window.solarToolsConfig.AREA_DEFAULTS[window.solarToolsConfig.curType];
    const _set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    _set('rowsPerString',   a.rowsPerString   ?? _def.rowsPerString);
    _set('stringsPerBlock', a.stringsPerBlock  ?? _def.stringsPerBlock);
    _set('stringGap',       a.stringGap        ?? _def.stringGap);
    _set('blockGap',        a.blockGap         ?? _def.blockGap);
    _set('marginBorder',    a.margin           ?? window.solarToolsConfig.MARGINS[a.type] ?? 1);
    const azDeg = Math.round(a.azimut || 0);
    const azLbl = bearingLabel(azDeg);
    el.innerHTML = `
    <div class="area-params">
        <div class="area-param">
            <div class="area-param-v">${azLbl} ${azDeg}°</div>
            <div class="area-param-l">azimut</div>
        </div>
        <div class="area-param">
            <div class="area-param-v">${a.panelsFromDraw ? a.panels : '—'}</div>
            <div class="area-param-l">pannelli</div>
        </div>
        <div class="area-param sun">
            <div class="area-param-v">${a.panelsFromDraw ? a.kwp.toFixed(1) : '—'}</div>
            <div class="area-param-l">kWp</div>
        </div>
    </div>`;
}

// ── PRODUZIONE E STOCCAGGIO SECTION ──────────────────────────────────────
function renderProduzioneSection() {
    const el = document.getElementById('pProduzioneBody');
    if (!el) return;
    if (!areas.length) {
        el.innerHTML = '<div class="pai-empty">Seleziona un\'area per calcolare la produzione</div>';
        return;
    }
    const a = areas[panelAreaIdx];
    const irrLabel = a.pvgisYield ? `${a.pvgisYield} kWh/kWp/anno (PVGIS)` : `${irr} kWh/kWp/anno (default)`;
    const kwh = fmt(Math.round((a.mwh || 0) * 1000));

    let pvgisBtn = '';
    if (a.pvgisFetching) {
        pvgisBtn = `<div class="area-pvgis-row"><span class="det-spin"><span class="det-spin-ico"></span>Recupero PVGIS…</span></div>`;
    } else if (a.pvgisYield) {
        pvgisBtn = `<div class="area-pvgis-row">
            <span class="pvgis-chip">☀ ${a.pvgisYield} kWh/kWp/anno</span>
            <button class="area-btn-sm" onclick="triggerAreaPVGIS(${a.id})" title="Aggiorna PVGIS">↻</button>
        </div>`;
    } else {
        pvgisBtn = `<div class="area-pvgis-row">
            <button class="area-pvgis-btn" onclick="triggerAreaPVGIS(${a.id})">☀ Calcola irradiazione PVGIS</button>
        </div>`;
    }

    const battOn  = a.batteryInstalled || false;
    const battKwh = a.batteryKwh || 200;
    const battFields = battOn ? `<div class="field">
        <label>Capacità batteria (kWh)</label>
        <input type="number" value="${battKwh}" min="10" max="10000" step="10"
            onchange="updateAreaField(${a.id},'batteryKwh',this.value)" />
    </div>` : '';

    // Grid: all zone types can need MT above 100 kWp
    const isMT    = a.kwp >= 100;
    const gridBadge = `<div class="grid-info-row">
        <span class="prod-label">Connessione rete</span>
        <span class="grid-badge ${isMT ? 'mt' : 'bt'}">${isMT ? '⚡ MT' : '⚡ BT'}</span>
    </div>`;

    // Cabin toggle — MT requirement depends on type
    const cabinOn       = a.cabinInstalled || false;
    const isRoof = window.solarToolsConfig.isRoof;
    const cabinRequired = !isRoof && isMT;
    const cabinRow = isMT ? `
    <div class="batt-toggle-row">
        <label class="batt-toggle-label">
            <input type="checkbox" ${cabinOn ? 'checked' : ''} onchange="updateAreaField(${a.id},'cabinInstalled',this.checked)" />
            Cabina di trasformazione MT
            <span class="grid-badge ${isRoof ? 'bt' : (cabinRequired ? 'mt' : 'bt')}">
                ${isRoof ? 'opzionale' : (cabinRequired ? 'richiesta' : 'opzionale')}
            </span>
        </label>
    </div>` : '';

    el.innerHTML = `
    ${pvgisBtn}
    <div class="prod-stat">
        <div class="prod-stat-row">
            <span class="prod-label">Irradiazione</span>
            <span class="prod-val">${irrLabel}</span>
        </div>
        <div class="prod-stat-row">
            <span class="prod-label">Produzione annua</span>
            <span class="prod-val prod-val-big">${kwh} kWh/anno</span>
        </div>
        ${gridBadge}
    </div>
    <div class="batt-toggle-row">
        <label class="batt-toggle-label">
            <input type="checkbox" ${battOn ? 'checked' : ''} onchange="updateAreaField(${a.id},'batteryInstalled',this.checked)" />
            Installazione batterie
        </label>
    </div>
    ${battFields}
    ${cabinRow}`;
}

function renderAreaSlide(animate = false) {
    const container = document.getElementById('pAreaSlide');
    if (!container) return;

    if (!areas.length) {
        container.innerHTML = '<div class="area-empty">Usa i pulsanti "Disegna" per aggiungere un\'area</div>';
        updateNavBtns();
        renderPrezziSection();
        updateDrawPanelsBtn();
        return;
    }

    panelAreaIdx = Math.max(0, Math.min(panelAreaIdx, areas.length - 1));
    const a = areas[panelAreaIdx];

    if (animate) {
        container.classList.add('sliding');
        setTimeout(() => { _renderSlideContent(container, a); container.classList.remove('sliding'); }, 160);
    } else {
        _renderSlideContent(container, a);
    }
    updateNavBtns();
    renderPannelloSection();
    renderProduzioneSection();
    renderPrezziSection();
    updateDrawPanelsBtn();
}

function _renderSlideContent(container, a) {
    const TYPES = Object.entries(window.solarToolsConfig.NORME).map(([k, v]) => ({
        k, icon: v.icon, label: v.label
    }));
    const isRoof = window.solarToolsConfig.isRoof;

    // Sync geometry in case vertices were edited interactively
    const freshLls = a.layer.getLatLngs().flat(Infinity);
    const freshM2  = Math.round(L.GeometryUtil.geodesicArea(freshLls));
    if (freshM2 !== a.areaM2) {
        a.areaM2    = freshM2;
        a.perimeter = calcPerimeter(a.layer);
        a.azimut    = calcAzimut(a.layer);
        clearAreaPanels(a);
        a.layer.bindTooltip(`<b>${esc(a.name)}</b><br/>${fmt(freshM2)} m²`, { sticky: true });
    }

    // Detection info
    const d = a.detected;
    const c = a.layer.getBounds().getCenter();
    const latStr = c.lat.toFixed(4);
    const lonStr = c.lng.toFixed(4);
    let detHtml = '';
    if (a.detecting) {
        detHtml = `<div class="area-det"><div class="det-row"><span class="det-spin"><span class="det-spin-ico"></span>Analisi zona…</span></div></div>`;
    } else {
        const com = d?.comune
            ? `<span class="comune-chip">📍 ${esc(d.comune)}${d.provincia ? ' (' + esc(d.provincia) + ')' : ''} <span class="coords-chip">${latStr}, ${lonStr}</span></span>`
            : `<span class="comune-chip coords-chip">${latStr}, ${lonStr}</span>`;
        detHtml = `<div class="area-det"><div class="det-row">${com}</div></div>`;
    }

    // Normativa
    const norm = window.solarToolsConfig.NORME[a.type];
    let normHtml = '<div class="norm-no-sel">Tipo zona non riconosciuto</div>';
    if (norm) {
        const comuneStr = d?.comune ? `${esc(d.comune)}${d.provincia ? ' (' + esc(d.provincia) + ')' : ''}` : '';
        normHtml = `<div class="norm-card ${a.type}">
            <div class="norm-head">${norm.icon} ${norm.label}
                ${a.autoType ? '<span class="norm-auto-badge">rilevato OSM</span>' : ''}
                ${a.pvgisYield ? `<span class="norm-auto-badge">☀ PVGIS ${a.pvgisYield}</span>` : ''}
                ${comuneStr ? `<span class="norm-comune">— ${comuneStr}</span>` : ''}
            </div>
            <ul class="norm-items">${norm.items.map(i => `<li>${i}</li>`).join('')}</ul>
            ${norm.cerNote ? `<div class="norm-cer">⚠️ <span>${norm.cerNote}</span></div>` : ''}
        </div>`;
    }

    const usable = calcUsableArea(a.areaM2, a.perimeter || 0, a.margin ?? window.solarToolsConfig.MARGINS[a.type] ?? 1);

    // Roof options — only when isRoof === true
    let roofOptionsHtml = '';
    if (isRoof) {
        const rt = a.roofType || 'piano';
        const fd = a.falde || 1;
        const faldeBlock = rt === 'falda' ? `
            <div class="area-field">
                <label>Numero falde</label>
                <select onchange="updateAreaField(${a.id},'falde',this.value)">
                    <option value="1" ${fd===1?'selected':''}>1 falda</option>
                    <option value="2" ${fd===2?'selected':''}>2 falde</option>
                </select>
            </div>` : '';
        const roofNote = rt === 'curvo'
            ? '<div class="area-roof-note">Riempimento simmetrico dal colmo (2 falde)</div>'
            : rt === 'falda'
            ? '<div class="area-roof-note">Riempimento dal colmo verso i bordi</div>'
            : '';
        roofOptionsHtml = `<div class="area-roof-opts">
            <div class="area-field-row">
                <div class="area-field">
                    <label>Tipo tetto</label>
                    <select onchange="updateAreaField(${a.id},'roofType',this.value)">
                        <option value="piano" ${rt==='piano'?'selected':''}>Tetto Piano</option>
                        <option value="curvo" ${rt==='curvo'?'selected':''}>Tetto Curvo</option>
                        <option value="falda" ${rt==='falda'?'selected':''}>Tetto a Falda</option>
                    </select>
                </div>
                ${faldeBlock}
            </div>
            ${roofNote}
        </div>`;
    }

    container.innerHTML = `
    <input class="area-name-input" type="text" value="${esc(a.name)}"
        onchange="updateAreaField(${a.id},'name',this.value)"
        placeholder="Nome area (obbligatorio)" required />

    <div class="area-types">
        ${TYPES.map(tp => `<button class="atype-btn ${a.type === tp.k ? 'on' : ''} ${tp.disabled ? 'disabled' : ''}"
            onclick="${tp.disabled ? '' : `setAreaType(${a.id},'${tp.k}')`}"
            title="${tp.label}${tp.disabled ? ' (prossimamente)' : ''}">${tp.icon}</button>`).join('')}
    </div>

    ${roofOptionsHtml}
    ${detHtml}

    <div class="area-params area-params-2">
        <div class="area-param">
            <div class="area-param-v">${fmt(a.areaM2)}</div>
            <div class="area-param-l">m² totali</div>
        </div>
        <div class="area-param">
            <div class="area-param-v">${fmt(usable)}</div>
            <div class="area-param-l">m² utili</div>
        </div>
    </div>

    <details class="norm-accordion">
        <summary class="norm-accordion-toggle">
            <span class="slabel">Normativa &amp; Autorizzazioni</span>
            <span class="acc-arrow"></span>
        </summary>
        <div class="norm-accordion-body">${normHtml}</div>
    </details>

    <button class="area-del-btn" onclick="delA(${a.id})">✕ Elimina area</button>`;
}

// ── AREA FIELD UPDATES (inline, immediate) ────────────────────────────────
function updateAreaField(id, field, val) {
    const a = areas.find(x => x.id === id); if (!a) return;
    if (field === 'name') {
        a.name = val.trim() || a.name;
        a.layer.bindTooltip(`<b>${esc(a.name)}</b><br/>${fmt(a.areaM2)} m²`, { sticky: true });
    } else if (field === 'note') {
        a.note = val.trim();
    } else if (field === 'roofType') {
        a.roofType = val;
        clearAreaPanels(a);
        recalc(); renderAreaSlide(); return;
    } else if (field === 'falde') {
        a.falde = parseInt(val);
        clearAreaPanels(a);
        recalc(); renderAreaSlide(); return;
    } else if (field === 'batteryInstalled') {
        a.batteryInstalled = val === true || val === 'true';
        renderProduzioneSection(); return;
    } else if (field === 'cabinInstalled') {
        a.cabinInstalled = val === true || val === 'true';
        recalc(); return;
    } else if (field === 'batteryKwh') {
        a.batteryKwh = parseFloat(val) || 200;
    } else if (field === 'pricePanel')    { a.pricePanel    = parseFloat(val) || 0;
    } else if (field === 'priceInverter') { a.priceInverter = parseFloat(val) || 0;
    } else if (field === 'priceStruct')   { a.priceStruct   = parseFloat(val) || 0;
    } else if (field === 'priceInstall')  { a.priceInstall  = parseFloat(val) || 0;
    } else if (field === 'energyPrice')   { a.energyPrice   = parseFloat(val) || 0;
    } else if (field === 'priceCabin')    { a.priceCabin    = parseFloat(val) || 80000;
    }
    recalc();
}

function setAreaType(id, t) {
    const a = areas.find(x => x.id === id); if (!a) return;
    a.type = t; a.autoType = false;
    a.margin = window.solarToolsConfig.MARGINS[t];
    const _d = window.solarToolsConfig.AREA_DEFAULTS[t] || window.solarToolsConfig.AREA_DEFAULTS[window.solarToolsConfig.curType];
    a.rowsPerString = _d.rowsPerString; a.stringsPerBlock = _d.stringsPerBlock;
    a.stringGap = _d.stringGap; a.blockGap = _d.blockGap;
    a.layer.setStyle({ color: window.solarToolsConfig.CLRS[t], fillColor: window.solarToolsConfig.CLRS[t], weight: 1.5, fillOpacity: 0.04 });
    clearAreaPanels(a);
    if (window.solarToolsConfig.isRoof) a.cabinInstalled = false;
    a.cabinLatLngs = null;
    recalc();
    renderAreaSlide();
}

// ── PVGIS per area (manual trigger) ──────────────────────────────────────
async function triggerAreaPVGIS(id) {
    const a = areas.find(x => x.id === id); if (!a) return;
    a.pvgisFetching = true; a.pvgisYield = null;
    renderAreaSlide();
    try {
        const b = a.layer.getBounds(), c = b.getCenter();
        const { annualkWh } = await window.fetchPVGIS(c.lat, c.lng, 1, { angle: 30, aspect: 0 });
        a.pvgisYield = annualkWh;
    } catch (err) {
        console.warn('[PVGIS]', err.message);
        a.pvgisYield = null;
        notify('⚠', 'PVGIS non disponibile — uso irradiazione fallback');
    }
    a.pvgisFetching = false;
    recalc();
    if (areas[panelAreaIdx]?.id === id) renderProduzioneSection();
}

// ── GEOMETRY HELPERS ──────────────────────────────────────────────────────
function calcPerimeter(layer) {
    const lls = layer.getLatLngs().flat(Infinity);
    let p = 0;
    for (let i = 0; i < lls.length; i++) p += lls[i].distanceTo(lls[(i + 1) % lls.length]);
    return p; // metres
}

function calcAzimut(layer) {
    const lls = layer.getLatLngs().flat(Infinity);
    if (lls.length < 2) return 0;
    let maxLen = 0, bestBearing = 0;
    for (let i = 0; i < lls.length; i++) {
        const p1 = lls[i], p2 = lls[(i + 1) % lls.length];
        const len = p1.distanceTo(p2);
        if (len > maxLen) {
            maxLen = len;
            const lat1 = p1.lat * Math.PI / 180, lat2 = p2.lat * Math.PI / 180;
            const dLon = (p2.lng - p1.lng) * Math.PI / 180;
            const y = Math.sin(dLon) * Math.cos(lat2);
            const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
            bestBearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
        }
    }
    // Normalise to 0–180° (orientation is undirected)
    return bestBearing > 180 ? bestBearing - 180 : bestBearing;
}

function calcUsableArea(areaM2, perimeter, margin) {
    const m = margin || 1;
    // Steiner inset formula: A_inset = A - P·d + π·d²
    return Math.max(0, Math.round(areaM2 - perimeter * m + Math.PI * m * m));
}

function setLayoutParam(key, v, min = 0) {
    const a = areas[panelAreaIdx];
    if (!a) return;
    a[key] = Math.max(min, +v);
    recalc();
}

function bearingLabel(deg) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
}

// ── CABIN INTERACTION (drag + rotate) ────────────────────────────────────
let _cabinInteract = null;

// Returns the lat/lng position for the rotation handle:
// midpoint of corners[2-3] (the "top" edge), extended slightly outward.
function cabinHandlePos(latLngs) {
    const lls = latLngs.map(ll => Array.isArray(ll) ? ll : [ll.lat, ll.lng]);
    const cLat = lls.reduce((s, l) => s + l[0], 0) / 4;
    const cLng = lls.reduce((s, l) => s + l[1], 0) / 4;
    const mLat = (lls[2][0] + lls[3][0]) / 2;
    const mLng = (lls[2][1] + lls[3][1]) / 2;
    const dLat = mLat - cLat, dLng = mLng - cLng;
    const len  = Math.hypot(dLat, dLng) || 1e-10;
    const off  = 0.00004; // ~4 m beyond the edge midpoint
    return [mLat + (dLat / len) * off, mLng + (dLng / len) * off];
}

// Rotate lat/lng corners around a center point by deltaRad (radians).
function rotateCorners(corners, center, deltaRad) {
    const Re = 6371000;
    const cosLat = Math.cos(center.lat * Math.PI / 180);
    const cos = Math.cos(deltaRad), sin = Math.sin(deltaRad);
    return corners.map(([lat, lng]) => {
        const x = (lng - center.lng) * Math.PI / 180 * Re * cosLat;
        const y = (lat - center.lat) * Math.PI / 180 * Re;
        return [
            center.lat + (x * sin + y * cos) / Re * 180 / Math.PI,
            center.lng + (x * cos - y * sin) / (Re * cosLat) * 180 / Math.PI
        ];
    });
}

map.on('mousemove', e => {
    if (!_cabinInteract) return;
    const { mode, area, origin, corners, center, startAngle } = _cabinInteract;
    if (mode === 'drag') {
        const dLat = e.latlng.lat - origin.lat;
        const dLng = e.latlng.lng - origin.lng;
        const moved = corners.map(([lat, lng]) => [lat + dLat, lng + dLng]);
        area.cabinLayer.setLatLngs([moved]);
        if (area.cabinHandle) area.cabinHandle.setLatLng(cabinHandlePos(moved));
    } else {
        const Re = 6371000;
        const cosLat = Math.cos(center.lat * Math.PI / 180);
        const dx = (e.latlng.lng - center.lng) * Math.PI / 180 * Re * cosLat;
        const dy = (e.latlng.lat - center.lat) * Math.PI / 180 * Re;
        const rotated = rotateCorners(corners, center, Math.atan2(dx, dy) - startAngle);
        area.cabinLayer.setLatLngs([rotated]);
        if (area.cabinHandle) area.cabinHandle.setLatLng(cabinHandlePos(rotated));
    }
});

map.on('mouseup', () => {
    if (!_cabinInteract) return;
    const { mode, area } = _cabinInteract;
    area.cabinLatLngs = area.cabinLayer.getLatLngs()[0].map(ll => [ll.lat, ll.lng]);
    map.dragging.enable();
    const bodyEl = area.cabinLayer.getElement();
    if (bodyEl) bodyEl.style.cursor = 'grab';
    _cabinInteract = null;
    notify('⚡', mode === 'rotate'
        ? 'Cabina ruotata — ridisegna i pannelli per aggiornare'
        : 'Cabina spostata — ridisegna i pannelli per aggiornare');
});

function makeCabinInteractive(a) {
    const layer = a.cabinLayer;
    const setCursor = (l, c) => { const el = l.getElement(); if (el) el.style.cursor = c; };

    // Body — drag to move
    layer.once('add', () => setCursor(layer, 'grab'));
    setCursor(layer, 'grab');
    layer.on('mouseover', () => { if (!_cabinInteract) setCursor(layer, 'grab'); });
    layer.on('mousedown', function(e) {
        L.DomEvent.stop(e);
        _cabinInteract = {
            mode: 'drag', area: a, origin: e.latlng,
            corners: layer.getLatLngs()[0].map(ll => [ll.lat, ll.lng])
        };
        map.dragging.disable();
        setCursor(layer, 'grabbing');
    });

    // Handle — drag to rotate
    if (a.cabinHandle) { map.removeLayer(a.cabinHandle); a.cabinHandle = null; }
    const hp = cabinHandlePos(a.cabinLatLngs || layer.getLatLngs()[0].map(ll => [ll.lat, ll.lng]));
    const handle = L.circleMarker(hp, {
        radius: 6, weight: 2,
        color: '#dc2626', fillColor: '#fff', fillOpacity: 1,
        bubblingMouseEvents: false
    }).addTo(map);
    a.cabinHandle = handle;

    handle.once('add', () => setCursor(handle, 'crosshair'));
    setCursor(handle, 'crosshair');
    handle.on('mouseover', () => { if (!_cabinInteract) setCursor(handle, 'crosshair'); });
    handle.on('mousedown', function(e) {
        L.DomEvent.stop(e);
        const lls  = layer.getLatLngs()[0];
        const center = {
            lat: lls.reduce((s, ll) => s + ll.lat, 0) / lls.length,
            lng: lls.reduce((s, ll) => s + ll.lng, 0) / lls.length
        };
        const Re = 6371000, cosLat = Math.cos(center.lat * Math.PI / 180);
        const dx0 = (e.latlng.lng - center.lng) * Math.PI / 180 * Re * cosLat;
        const dy0 = (e.latlng.lat - center.lat) * Math.PI / 180 * Re;
        _cabinInteract = {
            mode: 'rotate', area: a, center,
            startAngle: Math.atan2(dx0, dy0),
            corners: lls.map(ll => [ll.lat, ll.lng])
        };
        map.dragging.disable();
    });
}

// ── DRAW ──────────────────────────────────────────────────────────────────
let drawH = null;
let measureActive = false, measurePoints = [], measureLines = [], measureMarkers = [];

function stopDraw() {
    if (drawH) { drawH.disable(); drawH = null; }
    if (measureActive) stopMeasure();
    ['dRect', 'dPoly'].forEach(id => document.getElementById(id).classList.remove('on'));
    document.getElementById('dStop').style.display = 'none';
    document.body.classList.remove('drawing');
}
const DRAW_STYLE = () => ({ color: window.solarToolsConfig.CLRS[curType], weight: 1.5, fillColor: window.solarToolsConfig.CLRS[curType], fillOpacity: 0.04 });

function startRect() {
    stopDraw(); if (pOpen) togglePanel(false);
    drawH = new L.Draw.Rectangle(map, { shapeOptions: DRAW_STYLE() });
    drawH.enable(); document.getElementById('dRect').classList.add('on');
    document.getElementById('dStop').style.display = 'flex'; document.body.classList.add('drawing');
    notify('▭', 'Clicca e trascina per disegnare il rettangolo');
}
function startPoly() {
    stopDraw(); if (pOpen) togglePanel(false);
    drawH = new L.Draw.Polygon(map, { shapeOptions: DRAW_STYLE(), allowIntersection: false });
    drawH.enable(); document.getElementById('dPoly').classList.add('on');
    document.getElementById('dStop').style.display = 'flex'; document.body.classList.add('drawing');
    notify('⬡', 'Clicca i vertici · doppio click per chiudere');
}

map.on(L.Draw.Event.CREATED, e => {
    stopDraw();
    const layer = e.layer;
    const lls = layer.getLatLngs ? layer.getLatLngs().flat(Infinity) : [];
    const m2 = Math.round(L.GeometryUtil.geodesicArea(lls));
    layer.setStyle({ color: window.solarToolsConfig.CLRS[curType], fillColor: window.solarToolsConfig.CLRS[curType], weight: 1.5, fillOpacity: 0.04 });
    const id = Date.now();
    const perimeter = calcPerimeter(layer);
    const azimut    = calcAzimut(layer);
    const obj = {
        id, layer, type: curType, areaM2: m2,
        name: `${window.solarToolsConfig.LBLS[curType]} #${areas.length + 1}`,
        perimeter, azimut,
        panels: 0, kwp: 0, mwh: 0, usableM2: 0,
        roofType: 'piano', falde: 1,
        batteryInstalled: false, batteryKwh: 200,
        note: '', detecting: false, detected: null, autoType: false,
        pvgisFetching: false, pvgisYield: null,
        panelLayers: [], panelsFromDraw: false,
        cabinInstalled: curType !== 'capannone',
        cabinLayer: null, cabinHandle: null, cabinLatLngs: null,
        margin: window.solarToolsConfig.MARGINS[curType],
        rowsPerString:  window.solarToolsConfig.AREA_DEFAULTS[curType].rowsPerString,
        stringsPerBlock: window.solarToolsConfig.AREA_DEFAULTS[curType].stringsPerBlock,
        stringGap:      window.solarToolsConfig.AREA_DEFAULTS[curType].stringGap,
        blockGap:       window.solarToolsConfig.AREA_DEFAULTS[curType].blockGap,
        pricePanel: 180, priceInverter: 0, priceStruct: 0, priceInstall: 0,
        energyPrice: 0, priceCabin: 80000,
        punFetching: false, punBadgeText: '', punBadgeClass: '',
    };
    drawn.addLayer(layer); areas.push(obj);
    layer.bindTooltip(`<b>${esc(obj.name)}</b><br/>${fmt(m2)} m²`, { sticky: true });
    layer.editing.enable();   // vertex handles + midpoint "+" handles
    layer.on('click', () => {
        if (measureActive) return;   // don't interrupt active measurement
        panelAreaIdx = areas.findIndex(x => x.id === id);
        if (!pOpen) togglePanel(true);
        renderAreaSlide();
        zoomToCurrentArea();
    });
    panelAreaIdx = areas.length - 1;
    if (!pOpen) togglePanel(true);
    recalc(); renderAreaSlide();
    notify('✓', `Area aggiunta: ${fmt(m2)} m² — Analisi zona in corso…`);
    analyzeArea(obj);
});
map.on(L.Draw.Event.DRAWSTOP, () => {
    ['dRect', 'dPoly'].forEach(id => document.getElementById(id).classList.remove('on'));
    document.getElementById('dStop').style.display = 'none';
    document.body.classList.remove('drawing');
});

map.on('draw:editvertex', function (e) {
    const a = areas.find(x => x.layer === e.poly);
    if (!a) return;
    const lls = a.layer.getLatLngs().flat(Infinity);
    a.areaM2    = Math.round(L.GeometryUtil.geodesicArea(lls));
    a.perimeter = calcPerimeter(a.layer);
    a.azimut    = calcAzimut(a.layer);
    clearAreaPanels(a);
    a.layer.bindTooltip(`<b>${esc(a.name)}</b><br/>${fmt(a.areaM2)} m²`, { sticky: true });
    recalc();
    renderAreaSlide();
});

// ── MEASURE ───────────────────────────────────────────────────────────
function toggleMeasure() {
    if (measureActive) { stopMeasure(); return; }
    stopDraw(); measureActive = true;
    document.getElementById('dMeasure').classList.add('on');
    document.getElementById('dStop').style.display = 'flex';
    document.body.classList.add('drawing');
    measurePoints = []; measureLines = []; measureMarkers = [];
    notify('📏', 'Clicca per aggiungere punti · doppio click per terminare');
    map.on('click', onMeasureClick);
    map.on('dblclick', onMeasureDblClick);
}
function onMeasureClick(e) {
    if (!measureActive) return;
    measurePoints.push(e.latlng);
    const marker = L.circleMarker(e.latlng, { radius: 4, color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 1, weight: 2 }).addTo(map);
    measureMarkers.push(marker);
    if (measurePoints.length > 1) {
        const p1 = measurePoints[measurePoints.length - 2], p2 = e.latlng;
        const line = L.polyline([p1, p2], { color: '#F59E0B', weight: 2, dashArray: '6 4' }).addTo(map);
        line.bindTooltip(fmtDist(p1.distanceTo(p2)), { permanent: true, className: 'measure-tip', direction: 'center' });
        measureLines.push(line); updateMeasureTotal();
    }
}
function onMeasureDblClick(e) {
    if (!measureActive) return;
    L.DomEvent.stop(e);
    if (measurePoints.length >= 2) updateMeasureTotal(true);
    stopMeasure(true);
}
function updateMeasureTotal(final = false) {
    let total = 0;
    for (let i = 1; i < measurePoints.length; i++) total += measurePoints[i - 1].distanceTo(measurePoints[i]);
    const el = document.getElementById('measureResult');
    if (total > 0) { el.style.display = 'flex'; el.textContent = `📏 ${fmtDist(total)}`; }
    if (final) notify('📏', `Distanza totale: ${fmtDist(total)}`);
}
function stopMeasure(keepResult = false) {
    measureActive = false;
    map.off('click', onMeasureClick); map.off('dblclick', onMeasureDblClick);
    document.getElementById('dMeasure').classList.remove('on');
    document.getElementById('dStop').style.display = 'none';
    document.body.classList.remove('drawing');
    if (!keepResult) {
        measureLines.forEach(l => map.removeLayer(l));
        measureMarkers.forEach(m => map.removeLayer(m));
        measureLines = []; measureMarkers = []; measurePoints = [];
        document.getElementById('measureResult').style.display = 'none';
    }
}
function fmtDist(m) { return m >= 1000 ? (m / 1000).toFixed(2) + ' km' : Math.round(m) + ' m'; }

// ── ZONE ANALYSIS (OSM + Nominatim only — PVGIS is manual) ───────────────
async function analyzeArea(areaObj) {
    areaObj.detecting = true; renderAreaSlide();
    try {
        const b = areaObj.layer.getBounds(), c = b.getCenter();
        const S = b.getSouth().toFixed(6), W = b.getWest().toFixed(6), N = b.getNorth().toFixed(6), E = b.getEast().toFixed(6);
        const [osmData, nomData] = await Promise.all([
            fetchOverpass(S, W, N, E),
            fetchNominatim(c.lat, c.lng),
        ]);
        const cls = classifyElements(osmData.elements || []);
        const loc = extractComune(nomData);
        areaObj.detected = { ...cls, ...loc };
        if (cls.type && cls.confidence >= 0.4) {
            areaObj.type = cls.type; areaObj.autoType = true;
            areaObj.layer.setStyle({ color: window.solarToolsConfig.CLRS[cls.type], fillColor: window.solarToolsConfig.CLRS[cls.type] });
            if (window.solarToolsConfig.isRoof && cls.type === 'capannone') areaObj.cabinInstalled = false;
            areaObj.cabinLatLngs = null;
            areaObj.margin = window.solarToolsConfig.MARGINS[cls.type];
            const _ad = window.solarToolsConfig.AREA_DEFAULTS[cls.type] || window.solarToolsConfig.AREA_DEFAULTS[window.solarToolsConfig.curType];
            areaObj.rowsPerString = _ad.rowsPerString; areaObj.stringsPerBlock = _ad.stringsPerBlock;
            areaObj.stringGap = _ad.stringGap; areaObj.blockGap = _ad.blockGap;
            notify('🔍', `Rilevato: ${window.solarToolsConfig.NORME[cls.type]?.label || cls.type}${loc.comune ? ' — ' + loc.comune : ''}`);
        } else {
            areaObj.detected.type = null;
        }
    } catch (err) {
        areaObj.detected = { type: null, confidence: 0, comune: '', provincia: '', regione: '' };
    }
    areaObj.detecting = false;
    recalc(); renderAreaSlide();
}

// ── DELETE / CLEAR ────────────────────────────────────────────────────────
function delA(id) {
    const i = areas.findIndex(a => a.id === id);
    if (i > -1) {
        areas[i].panelLayers.forEach(l => map.removeLayer(l));
        if (areas[i].cabinLayer)  map.removeLayer(areas[i].cabinLayer);
        if (areas[i].cabinHandle) map.removeLayer(areas[i].cabinHandle);
        drawn.removeLayer(areas[i].layer);
        areas.splice(i, 1);
    }
    panelAreaIdx = Math.min(panelAreaIdx, Math.max(0, areas.length - 1));
    recalc(); renderAreaSlide();
}
function clearAll() {
    areas.forEach(a => {
        a.panelLayers.forEach(l => map.removeLayer(l));
        if (a.cabinLayer)  map.removeLayer(a.cabinLayer);
        if (a.cabinHandle) map.removeLayer(a.cabinHandle);
        drawn.removeLayer(a.layer);
    });
    areas = []; panelAreaIdx = 0;
    stopDraw(); recalc(); renderAreaSlide();
}

// ── CALC ──────────────────────────────────────────────────────────────────
function recalc() {
    const gwp = parseFloat(document.getElementById('panelWp').value);
    const gpw = parseFloat(document.getElementById('panelW').value);
    const gph = parseFloat(document.getElementById('panelH').value);

    let totM2 = 0, totP = 0, totMwh = 0, totKwp = 0, totBase = 0, totRevenue = 0;
    areas.forEach(a => {
        a.usableM2 = calcUsableArea(a.areaM2, a.perimeter || 0, a.margin ?? window.solarToolsConfig.MARGINS[a.type] ?? 1);
        const pw = gpw, ph = gph, wp = gwp;
        if (a.panelsFromDraw) {
            a.kwp = a.panels * wp / 1000;
        } else {
            const _ad  = window.solarToolsConfig.AREA_DEFAULTS[a.type] || window.solarToolsConfig.AREA_DEFAULTS[window.solarToolsConfig.curType];
            const _rps = a.rowsPerString   ?? _ad.rowsPerString;
            const _spb = a.stringsPerBlock ?? _ad.stringsPerBlock;
            const _sg  = a.stringGap       ?? _ad.stringGap;
            const _bg  = a.blockGap        ?? _ad.blockGap;
            const _sH  = _rps * ph;
            const _bH  = _spb * _sH + Math.max(0, _spb - 1) * _sg;
            const _cyc = _bH + _bg;
            a.panels = _cyc > 0 ? Math.floor(a.usableM2 * _rps * _spb / (_cyc * pw)) : 0;
            a.kwp    = a.panels * wp / 1000;
        }
        const specificYield = a.pvgisYield !== null ? a.pvgisYield : irr;
        a.mwh = a.kwp * specificYield / 1000;
        const kwhAnnual = a.kwp * specificYield;
        a._costBase = a.panels * (a.pricePanel || 0)
                    + (a.priceInverter || 0) * a.kwp          // €/kWp × kWp
                    + (a.priceStruct   || 0)
                    + (a.priceInstall  || 0)
                    + (a.cabinInstalled && a.kwp >= 100 ? (a.priceCabin || 80000) : 0);
        a._revenue = kwhAnnual * (a.energyPrice || 0);
        totM2 += a.areaM2;
        if (a.panelsFromDraw) {
            totP       += a.panels;
            totKwp     += a.kwp;
            totMwh     += a.mwh;
            totBase    += a._costBase;
            totRevenue += a._revenue;
        }
    });

    const totKwh = totMwh * 1000;
    document.getElementById('sArea').textContent    = fmt(totM2);
    document.getElementById('sPanels').textContent  = fmt(totP);
    document.getElementById('sKwp').textContent     = totKwp.toFixed(1);
    document.getElementById('sMwh').textContent     = fmt(Math.round(totKwh));
    document.getElementById('sCost').textContent    = '€ ' + fmt(Math.round(totBase));
    document.getElementById('sCostKwh').textContent = totKwp > 0 ? Math.round(totBase / totKwp) + ' €' : '—';
    document.getElementById('sRevenue').textContent = '€ ' + fmt(Math.round(totRevenue));
    const payback = totRevenue > 0 ? Math.ceil(totBase / (totRevenue * 0.75)) : null;
    document.getElementById('sPayback').textContent = payback !== null ? payback + ' anni' : '—';
    updateHud(totP, totKwp, totBase, totRevenue);
    renderPannelloSection();
    renderProduzioneSection();
    renderPrezziSection();
    return { totM2, totP, kwp: totKwp, mwh: totMwh, sub: totBase, tot: totBase };
}

// ── MINI HUD ──────────────────────────────────────────────────────────────
function updateHud(p, k, c, rev) {
    const h = document.getElementById('hud');
    h.classList.toggle('hide', !(!pOpen && areas.length > 0));
    if (p !== undefined) {
        document.getElementById('hPan').textContent  = fmt(p);
        document.getElementById('hKwp').textContent  = (k || 0).toFixed(1);
        document.getElementById('hCost').textContent = Math.round((c || 0) / 1000) + 'k';
        document.getElementById('hRev').textContent  = Math.round((rev || 0) / 1000) + 'k';
    }
}

// ── PUN MANUAL FETCH (per-area) ───────────────────────────────────────────
async function fetchPUNManual(areaId) {
    const a = areas.find(x => x.id === areaId);
    if (!a) return;
    a.punFetching = true;
    a.punBadgeText = 'Recupero PUN…'; a.punBadgeClass = 'pun-loading';
    renderPrezziSection();
    try {
        const regione = a.detected?.regione || '';
        const { pun, zoneLabel, fallback } = await window.fetchPUNForZone(regione);
        a.energyPrice    = pun;
        a.punBadgeText   = fallback
            ? `⚠️ Fallback [${zoneLabel}]: ${pun.toFixed(4)} €/kWh`
            : `✓ PUN day-ahead [${zoneLabel}]: ${pun.toFixed(4)} €/kWh`;
        a.punBadgeClass  = fallback ? 'pun-fallback' : 'pun-live';
        recalc();
    } catch {
        a.punBadgeText  = '⚠️ Errore recupero PUN';
        a.punBadgeClass = 'pun-fallback';
    }
    a.punFetching = false;
    renderPrezziSection();
}

// ── PREZZI SECTION (per-area, JS-rendered) ────────────────────────────────
function renderPrezziSection() {
    const el = document.getElementById('pPrezziBody');
    if (!el) return;
    if (!areas.length) {
        el.innerHTML = '<div class="pai-empty">Seleziona un\'area per inserire i prezzi</div>';
        return;
    }
    const a = areas[panelAreaIdx];
    const cabinRow = a.kwp >= 100 ? `
    <div class="field-row">
        <div class="field"><label>Cabina MT (€)</label>
            <input type="number" value="${a.priceCabin}" min="0" step="1000"
                onchange="updateAreaField(${a.id},'priceCabin',this.value)" />
        </div>
    </div>` : '';
    el.innerHTML = `
    <div class="field-row">
        <div class="field"><label>Pannello (€/pz)</label>
            <input type="number" value="${a.pricePanel}" min="0" step="1"
                onchange="updateAreaField(${a.id},'pricePanel',this.value)" />
        </div>
        <div class="field"><label>Inverter (€/kWp)</label>
            <input type="number" value="${a.priceInverter}" min="0" step="10"
                onchange="updateAreaField(${a.id},'priceInverter',this.value)" />
        </div>
    </div>
    <div class="field-row">
        <div class="field"><label>Struttura (€)</label>
            <input type="number" value="${a.priceStruct}" min="0" step="1000"
                onchange="updateAreaField(${a.id},'priceStruct',this.value)" />
        </div>
        <div class="field"><label>Installazione (€)</label>
            <input type="number" value="${a.priceInstall}" min="0" step="1000"
                onchange="updateAreaField(${a.id},'priceInstall',this.value)" />
        </div>
    </div>
    <div class="field">
        <label>Energia venduta (€/kWh)</label>
        <div class="pun-row">
            <input type="number" value="${a.energyPrice || ''}" step="0.001" min="0.001" max="0.50"
                placeholder="—" onchange="updateAreaField(${a.id},'energyPrice',this.value)" />
            <button class="pun-btn" onclick="fetchPUNManual(${a.id})" ${a.punFetching ? 'disabled' : ''}
                title="Recupera PUN day-ahead ENTSO-E">PUN</button>
        </div>
        ${a.punBadgeText ? `<div class="pun-badge ${a.punBadgeClass}">${a.punBadgeText}</div>` : ''}
    </div>
    ${cabinRow}`;
}

// ── ADDRESS SEARCH ────────────────────────────────────────────────────────
async function searchAddress() {
    const input = document.getElementById('addrInput');
    const q = input.value.trim(); if (!q) return;
    const btn = document.getElementById('addrBtn');
    const origHTML = btn.innerHTML;
    btn.innerHTML = '⏳'; btn.disabled = true;
    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&accept-language=it`, { headers: { 'User-Agent': 'SolarMapPro/1.0' } });
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (!data.length) { notify('⚠', 'Indirizzo non trovato'); return; }
        const { lat, lon, display_name } = data[0];
        map.setView([parseFloat(lat), parseFloat(lon)], 17);
        notify('📍', display_name.split(',').slice(0, 2).join(',').trim());
    } catch { notify('⚠', 'Errore ricerca indirizzo'); }
    finally { btn.innerHTML = origHTML; btn.disabled = false; }
}

// ── UTILS ─────────────────────────────────────────────────────────────────
function fmt(n) { return Number(n).toLocaleString('it-IT'); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function notify(ico, txt) {
    document.getElementById('nIco').textContent = ico;
    document.getElementById('nTxt').textContent = txt;
    const el = document.getElementById('notif');
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3500);
}

// ── PANEL DRAWING ─────────────────────────────────────────────────────────
const _panelRenderer = L.canvas({ padding: 0.5 });

function updateDrawPanelsBtn() {
    const btn = document.getElementById('drawPanelsBtn');
    if (!btn) return;
    btn.disabled = !areas.length;
}

function clearAreaPanels(a) {
    a.panelLayers.forEach(l => map.removeLayer(l));
    a.panelLayers = [];
    a.panelsFromDraw = false;
    if (a.cabinLayer)  { map.removeLayer(a.cabinLayer);  a.cabinLayer  = null; }
    if (a.cabinHandle) { map.removeLayer(a.cabinHandle); a.cabinHandle = null; }
}

function drawPanels() {
    if (!areas.length) return;
    const a = areas[panelAreaIdx];
    if (!a) return;

    const pw     = parseFloat(document.getElementById('panelW').value);
    const ph     = parseFloat(document.getElementById('panelH').value);
    const margin = a.margin ?? window.solarToolsConfig.MARGINS[a.type] ?? 1;
    const isRoof  = window.solarToolsConfig.isRoof;
    const roofType = isRoof ? (a.roofType || 'piano') : null;
    const isFalda  = roofType === 'falda' || roofType === 'curvo';

    // ── Layout parameters (per-area, with type defaults)
    const _def          = window.solarToolsConfig.AREA_DEFAULTS[a.type] || window.solarToolsConfig.AREA_DEFAULTS[window.solarToolsConfig.curType];
    const rowsPerString  = Math.max(1, a.rowsPerString   ?? _def.rowsPerString);
    const stringsPerBlock = Math.max(1, a.stringsPerBlock ?? _def.stringsPerBlock);
    const stringGap      = a.stringGap ?? _def.stringGap;
    const blockGap       = a.blockGap  ?? _def.blockGap;

    // ── Rotation angle (CW from North, degrees → radians)
    // parcheggio: follows azimut so panels align with parking bays
    // falda/curvo: +90° from azimut so fill runs perpendicular to ridge
    // all others: 0° (N-S fill)
    let thetaDeg = 0;
    if (window.solarToolsConfig.curType === 'parcheggio') thetaDeg = a.azimut ?? 0;
    if (isFalda) thetaDeg = (a.azimut ?? 0) + 90;
    const theta = thetaDeg * Math.PI / 180;
    const cosT  = Math.cos(theta), sinT = Math.sin(theta);
    // panel frame → world (CW rotation by theta)
    const p2w   = pt => ({ x:  pt.x * cosT + pt.y * sinT,
                            y: -pt.x * sinT + pt.y * cosT });
    // world → panel frame (CCW rotation by theta)
    const w2p   = pt => ({ x:  pt.x * cosT - pt.y * sinT,
                            y:  pt.x * sinT + pt.y * cosT });

    // ── Local metric coordinate helpers (equirectangular)
    const R      = 6371000;
    const ctr    = a.layer.getBounds().getCenter();
    const cosLat = Math.cos(ctr.lat * Math.PI / 180);
    const toM    = ll => ({ x: (ll.lng - ctr.lng) * Math.PI / 180 * R * cosLat,
                             y: (ll.lat - ctr.lat) * Math.PI / 180 * R });
    const fromM  = pt => [ctr.lat + pt.y / R * 180 / Math.PI,
                           ctr.lng + pt.x / (R * cosLat) * 180 / Math.PI];

    const polyM  = a.layer.getLatLngs().flat(Infinity).map(toM);

    // Bounding box in the rotated panel frame
    const polyR  = polyM.map(w2p);
    const xs     = polyR.map(p => p.x), ys = polyR.map(p => p.y);
    const minX   = Math.min(...xs), maxX = Math.max(...xs);
    const minY   = Math.min(...ys), maxY = Math.max(...ys);
    const ridgeY = (minY + maxY) / 2;   // used for falda/curvo center-outward fill

    clearAreaPanels(a);

    // Cabin footprint in panel frame — set below if cabin is installed
    let cabinRect = null;

    // Returns true if a panel cell [x0, x0+pw] × [py, py+ph] overlaps the cabin footprint
    const hitsCabin = (x0, py) =>
        cabinRect !== null &&
        x0 < cabinRect.x1 && x0 + pw > cabinRect.x0 &&
        py < cabinRect.y1 && py + ph > cabinRect.y0;

    // Place all rows of one string starting at stringY.
    // All rows in a column must fit inside the inset and clear the cabin.
    const placeString = stringY => {
        for (let x0 = minX + margin; x0 + pw <= maxX - margin; x0 += pw) {
            const rowCorners = [];
            let blocked = false;
            for (let r = 0; r < rowsPerString; r++) {
                const ry = stringY + r * ph;
                if (hitsCabin(x0, ry)) { blocked = true; break; }
                rowCorners.push(
                    [{ x: x0, y: ry }, { x: x0+pw, y: ry }, { x: x0+pw, y: ry+ph }, { x: x0, y: ry+ph }].map(p2w)
                );
            }
            if (blocked) continue;
            if (!rowCorners.every(corners => corners.every(c => _ptInInset(c, polyM, margin)))) continue;
            for (const corners of rowCorners) {
                a.panelLayers.push(L.polygon(corners.map(fromM), {
                    color: '#7db8e8', fillColor: '#1e3a5f',
                    weight: 0.5, fillOpacity: 0.85,
                    renderer: _panelRenderer
                }).addTo(map));
            }
        }
    };

    // ── Cabin: 10 m × 2.5 m rectangle kept inside the polygon border buffer.
    // On first draw: scans for valid position (south zone → north zone → fallback).
    // On subsequent draws: reuses a.cabinLatLngs so user drags are preserved.
    const panelMinY = minY + margin;
    if (a.cabinInstalled && !isRoof) {
        const cabW = 10.0, cabH = 2.5, cabEdge = 1.0;

        // Draw cabin from lat/lng array, compute panel-frame exclusion rect, enable drag.
        const placeCabin = latLngs => {
            if (a.cabinLayer) map.removeLayer(a.cabinLayer);
            a.cabinLayer = L.polygon(latLngs, {
                color: '#dc2626', fillColor: '#fee2e2',
                weight: 2, fillOpacity: 0.8
            }).addTo(map);
            a.cabinLayer.bindTooltip('⚡ Cabina MT', { direction: 'center', className: 'cabin-tip' });
            makeCabinInteractive(a);
            const pts = latLngs.map(ll => w2p(toM({ lat: ll[0], lng: ll[1] })));
            const xs  = pts.map(p => p.x), ys = pts.map(p => p.y);
            cabinRect = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
        };

        if (a.cabinLatLngs) {
            placeCabin(a.cabinLatLngs);
        } else {
            const cabX0 = (minX + maxX) / 2 - cabW / 2;
            const cabFit = scanY => {
                const corners = [
                    { x: cabX0,        y: scanY        },
                    { x: cabX0 + cabW, y: scanY        },
                    { x: cabX0 + cabW, y: scanY + cabH },
                    { x: cabX0,        y: scanY + cabH }
                ];
                return corners.every(c => _ptInInset(p2w(c), polyM, cabEdge));
            };
            let foundCabY = null;
            // Phase 1 — south buffer zone (cabin entirely below panel area)
            for (let y = minY + cabEdge; y + cabH <= panelMinY && !foundCabY; y += 0.25)
                if (cabFit(y)) foundCabY = y;
            // Phase 2 — north buffer zone (above last possible panel row)
            if (!foundCabY)
                for (let y = maxY - cabEdge - cabH; y >= maxY - margin && !foundCabY; y -= 0.25)
                    if (cabFit(y)) foundCabY = y;
            // Phase 3 — fallback: any valid inset position
            if (!foundCabY)
                for (let y = minY + cabEdge; y + cabH + cabEdge <= maxY && !foundCabY; y += 0.25)
                    if (cabFit(y)) foundCabY = y;

            if (foundCabY !== null) {
                const latLngs = [
                    { x: cabX0,        y: foundCabY        },
                    { x: cabX0 + cabW, y: foundCabY        },
                    { x: cabX0 + cabW, y: foundCabY + cabH },
                    { x: cabX0,        y: foundCabY + cabH }
                ].map(p2w).map(fromM);
                a.cabinLatLngs = latLngs;
                placeCabin(latLngs);
            }
        }
    }

    // ── Block layout: strings stacked inside blocks, blocks tiled north→south
    // stringH = rowsPerString × panelH   (rows are adjacent, no gap)
    // blockH  = stringsPerBlock × stringH + (stringsPerBlock-1) × stringGap
    // cycle   = blockH + blockGap
    const stringH = rowsPerString * ph;
    const blockH  = stringsPerBlock * stringH + Math.max(0, stringsPerBlock - 1) * stringGap;
    const cycle   = blockH + blockGap;

    const placeBlock = y0 => {
        for (let s = 0; s < stringsPerBlock; s++) {
            placeString(y0 + s * (stringH + stringGap));
        }
    };

    if (isFalda) {
        // curvo is always 2-sided; falda uses a.falde (1 or 2)
        const falde = roofType === 'curvo' ? 2 : (a.falde || 1);

        if (falde >= 2) {
            // 2-falda / curvo: fill from ridge center outward to both eaves
            for (let y0 = ridgeY; y0 + blockH <= maxY - margin; y0 += cycle) {
                placeBlock(y0);
            }
            for (let y0 = ridgeY - blockH; y0 >= minY + margin; y0 -= cycle) {
                placeBlock(y0);
            }
        } else {
            // 1-falda (mono-pitch): edge-to-edge fill, rotated to follow perimeter.
            // theta is already set to azimut+90 so Y runs across the slope.
            let refY = null;
            for (let y0 = maxY - margin - blockH; y0 >= panelMinY; y0 -= cycle) {
                refY = y0;
                placeBlock(y0);
            }
            if (refY === null && panelMinY + blockH <= maxY - margin) {
                refY = panelMinY;
                placeBlock(panelMinY);
            }
            if (refY !== null && refY > panelMinY + blockH + blockGap) {
                placeBlock(panelMinY);
            }
        }
    } else {
        // Standard fill north→south: south-border edits add/remove at bottom without shifting grid
        let southBlockY0 = null;
        for (let y0 = maxY - margin - blockH; y0 >= panelMinY; y0 -= cycle) {
            southBlockY0 = y0;
            placeBlock(y0);
        }
        if (southBlockY0 === null && panelMinY + blockH <= maxY - margin) {
            southBlockY0 = panelMinY;
            placeBlock(panelMinY);
        }
        // South fill: close gap left between panelMinY and southernmost block
        if (southBlockY0 !== null && southBlockY0 > panelMinY + blockH + blockGap) {
            placeBlock(panelMinY);
        }
    }

    a.panels        = a.panelLayers.length;
    a.panelsFromDraw = true;
    recalc();
    renderPannelloSection();
    notify('⬛', `${fmt(a.panels)} pannelli disegnati`);
}

// ── geometry helpers ──────────────────────────────────────────────────────
function _ptInPoly(pt, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const { x: xi, y: yi } = poly[i], { x: xj, y: yj } = poly[j];
        if ((yi > pt.y) !== (yj > pt.y) && pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)
            inside = !inside;
    }
    return inside;
}

function _distToSeg(pt, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(pt.x - a.x, pt.y - a.y);
    const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2));
    return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy));
}

function _ptInInset(pt, poly, margin) {
    if (!_ptInPoly(pt, poly)) return false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        if (_distToSeg(pt, poly[j], poly[i]) < margin) return false;
    }
    return true;
}


// ── PDF EXPORT ────────────────────────────────────────────────────────────
async function downloadPDF() {
    if (!areas.length) { notify('⚠', 'Nessuna area da esportare'); return; }
    if (!window.jspdf)  { notify('⚠', 'Libreria PDF non caricata'); return; }

    const btn = document.getElementById('btnDownloadPDF');
    const origHTML = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

    const savedCenter = map.getCenter(), savedZoom = map.getZoom(), wasOpen = pOpen;
    const origTile = ['sat', 'str', 'cat'].find(t =>
        document.getElementById('t' + t.charAt(0).toUpperCase() + t.slice(1))?.classList.contains('on')
    ) || 'str';
    const chromEls = ['hdr1', 'hdr2', 'dStop', 'notif', 'hud']
        .map(id => document.getElementById(id)).filter(Boolean);

    notify('⬇', 'Generazione PDF in corso…');

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const W = 210, H = 297, M = 14, CW = W - 2 * M;
        const fmtN = n => Number(n).toLocaleString('it-IT');
        const fmtE = n => '€ ' + fmtN(Math.round(n));
        const trunc = (s, n) => String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s);

        const hdrBar = (title, right) => {
            doc.setFillColor(30, 58, 95); doc.rect(0, 0, W, 12, 'F');
            doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
            doc.text(title, M, 8.5);
            if (right) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(right, W - M, 8.5, { align: 'right' }); }
        };
        const secTitle = (label, y) => {
            doc.setFillColor(241, 245, 249); doc.rect(M, y, CW, 6, 'F');
            doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(120, 120, 120);
            doc.text(label.toUpperCase(), M + 2, y + 4.2);
            return y + 8;
        };
        const row = (label, val, y, shade) => {
            if (shade) { doc.setFillColor(248, 250, 252); doc.rect(M, y - 3.5, CW, 5.5, 'F'); }
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
            doc.text(label, M + 2, y);
            doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 58, 95);
            doc.text(String(val), W - M - 2, y, { align: 'right' });
            return y + 5.5;
        };

        // ── Page 1: global summary ─────────────────────────────────────
        hdrBar('HelioH₂ SolarMap Pro', 'Analisi Fotovoltaica');
        let y = 20;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150, 150, 150);
        doc.text('Generato il ' + new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }), M, y);
        y += 9;

        const drawnA = areas.filter(a => a.panelsFromDraw);
        const totM2  = areas.reduce((s, a) => s + a.areaM2, 0);
        const totP   = drawnA.reduce((s, a) => s + a.panels, 0);
        const totKwp = drawnA.reduce((s, a) => s + a.kwp, 0);
        const totKwh = drawnA.reduce((s, a) => s + a.mwh * 1000, 0);
        const totCst = drawnA.reduce((s, a) => s + (a._costBase || 0), 0);
        const totRev = drawnA.reduce((s, a) => s + (a._revenue  || 0), 0);
        const pb0    = totRev > 0 ? Math.ceil(totCst / (totRev * 0.75)) + ' anni' : '—';

        y = secTitle('Riepilogo complessivo', y);
        [
            ['Superficie totale',       fmtN(totM2) + ' m²'],
            ['Pannelli',                fmtN(totP) + ' pz'],
            ['Potenza impianto',        totKwp.toFixed(1) + ' kWp'],
            ['Produzione annua',        fmtN(Math.round(totKwh)) + ' kWh/anno'],
            ['Costo impianto',          fmtE(totCst)],
            ['Costo specifico',         totKwp > 0 ? Math.round(totCst / totKwp) + ' €/kWp' : '—'],
            ['Ricavi potenziali / anno', fmtE(totRev)],
            ['Payback stimato',         pb0],
            ['Numero aree',             String(areas.length)],
        ].forEach((r, i) => { y = row(r[0], r[1], y, i % 2 === 0); });
        y += 6;

        // Area list table
        y = secTitle('Elenco aree', y);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(150, 150, 150);
        doc.text('Area', M + 2, y); doc.text('Tipo', M + 72, y);
        doc.text('m²', M + 116, y, { align: 'right' });
        doc.text('Pannelli', M + 143, y, { align: 'right' });
        doc.text('kWp', W - M - 2, y, { align: 'right' });
        y += 2; doc.setDrawColor(220, 220, 220); doc.line(M, y, W - M, y); y += 4;
        areas.forEach((a, i) => {
            if (i % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(M, y - 3.5, CW, 5.5, 'F'); }
            doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(30, 58, 95);
            doc.text(trunc(a.name, 32), M + 2, y);
            doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120);
            doc.text(window.solarToolsConfig.NORME[a.type]?.label || a.type, M + 72, y);
            doc.text(fmtN(a.areaM2), M + 116, y, { align: 'right' });
            doc.text(a.panelsFromDraw ? fmtN(a.panels) : '—', M + 143, y, { align: 'right' });
            doc.text(a.panelsFromDraw ? a.kwp.toFixed(1) : '—', W - M - 2, y, { align: 'right' });
            y += 5.5;
        });

        // ── Area pages ─────────────────────────────────────────────────
        if (wasOpen) togglePanel(false);
        setTile('sat');
        chromEls.forEach(el => el.style.opacity = '0');

        for (let i = 0; i < areas.length; i++) {
            const a = areas[i];
            doc.addPage();
            hdrBar(trunc(a.name, 42), (i + 1) + ' / ' + areas.length);
            y = 20;

            const loc = a.detected;
            const locStr = loc?.comune
                ? loc.comune + (loc.provincia ? ' (' + loc.provincia + ')' : '')
                : '';
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(120, 120, 120);
            doc.text((window.solarToolsConfig.NORME[a.type]?.label || a.type) + (locStr ? '  ·  ' + locStr : ''), M, y);
            y += 8;

            // Screenshot
            map.fitBounds(a.layer.getBounds(), { padding: [50, 50], animate: false });
            await new Promise(r => setTimeout(r, 1800));
            try {
                const c = await html2canvas(document.getElementById('map'), {
                    useCORS: true, allowTaint: false, logging: false, scale: 1.5
                });
                doc.addImage(c.toDataURL('image/jpeg', 0.85), 'JPEG', M, y, CW, 78);
                y += 84;
            } catch(_) {
                doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180, 180, 180);
                doc.text('Screenshot non disponibile', M + CW / 2, y + 8, { align: 'center' });
                y += 18;
            }

            // Geometry
            const marg   = a.margin ?? window.solarToolsConfig.MARGINS[a.type] ?? 1;
            const usable = calcUsableArea(a.areaM2, a.perimeter || 0, marg);
            const azDeg  = Math.round(a.azimut || 0);
            y = secTitle('Geometria', y);
            [
                ['Superficie totale', fmtN(a.areaM2) + ' m²'],
                ['Superficie utile',  fmtN(usable) + ' m²'],
                ['Perimetro',         Math.round(a.perimeter || 0) + ' m'],
                ['Azimut',            bearingLabel(azDeg) + ' ' + azDeg + '°'],
                ['Margine di bordo',  marg + ' m'],
            ].forEach((r, j) => { y = row(r[0], r[1], y, j % 2 === 0); });
            y += 4;

            // Impianto
            y = secTitle('Impianto', y);
            const irrLbl = a.pvgisYield ? a.pvgisYield + ' kWh/kWp (PVGIS)' : irr + ' kWh/kWp (default)';
            [
                ['Pannelli',         a.panelsFromDraw ? fmtN(a.panels) + ' pz' : 'Non disegnati'],
                ['Potenza',          a.panelsFromDraw ? a.kwp.toFixed(1) + ' kWp' : '—'],
                ['Produzione annua', a.panelsFromDraw ? fmtN(Math.round(a.mwh * 1000)) + ' kWh' : '—'],
                ['Irradiazione',     irrLbl],
                ['Connessione rete', a.kwp >= 100 ? 'MT (Media Tensione)' : 'BT (Bassa Tensione)'],
            ].forEach((r, j) => { y = row(r[0], r[1], y, j % 2 === 0); });
            y += 4;

            // Economico (only when prices are set)
            if (a.panelsFromDraw && (a.pricePanel || a.priceInverter || a.energyPrice || a.priceStruct || a.priceInstall)) {
                const cst = a._costBase || 0, rev = a._revenue || 0;
                const pbA = rev > 0 ? Math.ceil(cst / (rev * 0.75)) + ' anni' : '—';
                y = secTitle('Economico', y);
                [
                    ['Pannello (€/pz)',          a.pricePanel    ? a.pricePanel + ' €'    : '—'],
                    ['Inverter (€/kWp)',          a.priceInverter ? a.priceInverter + ' €' : '—'],
                    ['Struttura',                      a.priceStruct   ? fmtE(a.priceStruct)         : '—'],
                    ['Installazione',                  a.priceInstall  ? fmtE(a.priceInstall)        : '—'],
                    ['Costo totale',                   fmtE(cst)],
                    ['Costo specifico',                a.kwp > 0 ? Math.round(cst / a.kwp) + ' €/kWp' : '—'],
                    ['Energia venduta',                a.energyPrice ? a.energyPrice.toFixed(4) + ' €/kWh' : '—'],
                    ['Ricavi potenziali / anno',       fmtE(rev)],
                    ['Payback stimato',                pbA],
                ].forEach((r, j) => { y = row(r[0], r[1], y, j % 2 === 0); });
            }
        }

        // Page numbers (all pages)
        const nPg = 1 + areas.length;
        for (let p = 1; p <= nPg; p++) {
            doc.setPage(p);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(180, 180, 180);
            doc.text('HelioH₂ SolarMap Pro  ·  pagina ' + p + ' di ' + nPg, W / 2, H - 6, { align: 'center' });
        }

        const d = new Date();
        doc.save('HelioH2-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.pdf');
        notify('✓', 'PDF salvato');

    } catch(err) {
        console.error('[PDF]', err);
        notify('⚠', 'Errore generazione PDF');
    } finally {
        chromEls.forEach(el => el.style.opacity = '');
        setTile(origTile);
        map.setView(savedCenter, savedZoom, { animate: false });
        if (wasOpen) togglePanel(true);
        if (btn) { btn.disabled = false; btn.innerHTML = origHTML; }
    }
}

document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (e.key === 'Escape') { stopDraw(); }
    if (!inField && (e.key === 'p' || e.key === 'P')) togglePanel();
    if (e.key === 'ArrowLeft'  && pOpen && areas.length) prevArea();
    if (e.key === 'ArrowRight' && pOpen && areas.length) nextArea();
});

// ── CORNER HANDLES VISIBILITY ──────────────────────────────────────
let handleVisible = true;

function toggleCornerHandles(hide) {
    handleVisible = !hide;
    areas.forEach(a => {
        if (a.layer?.editing?._verticesMarkers) {
            a.layer.editing._verticesMarkers.forEach(m => {
                m.setOpacity(handleVisible ? 1 : 0);
                if (!handleVisible) m.dragging.disable();
                if (handleVisible) m.dragging.enable();
            });
        }
        if (a.layer?.editing?._midMarkersCache) {
            Object.values(a.layer.editing._midMarkersCache).forEach(markers => {
                markers.forEach(m => m.setOpacity(handleVisible ? 1 : 0));
            });
        }
        if (a.cabinHandle) {
            a.cabinHandle.setOpacity(handleVisible ? 1 : 0);
            if (!handleVisible) a.cabinHandle.dragging.disable();
            if (handleVisible) a.cabinHandle.dragging.enable();
        }
    });
}

// ── SAVE/LOAD PROJECT ──────────────────────────────────────────────
function saveProject() {
    if (!areas.length) {
        notify('⚠', 'Nessun progetto da salvare');
        return;
    }

    const project = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        toolType: window.solarToolsConfig.curType,
        panelSettings: {
            wp: +document.getElementById('panelWp').value,
            w: +document.getElementById('panelW').value,
            h: +document.getElementById('panelH').value
        },
        areas: areas.map(a => ({
            name: a.name,
            type: a.type,
            azimut: a.azimut,
            corners: a.corners,
            panels: a.panels,
            kwp: a.kwp,
            kwh: a.kwh,
            rowsPerString: a.rowsPerString,
            stringsPerBlock: a.stringsPerBlock,
            stringGap: a.stringGap,
            blockGap: a.blockGap,
            margin: a.margin,
            prezzo: a.prezzo,
            prezzoKwp: a.prezzoKwp,
            prezzoKwh: a.prezzoKwh,
            revenue: a.revenue
        }))
    };

    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solartools-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    notify('✓', 'Progetto salvato');
}

function loadProject(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const project = JSON.parse(e.target.result);

            if (project.version !== '1.0') {
                notify('⚠', 'Formato file non supportato');
                return;
            }

            if (project.toolType !== window.solarToolsConfig.curType) {
                notify('⚠', 'File di tipo diverso (' + project.toolType + ')');
                return;
            }

            clearAll();

            document.getElementById('panelWp').value = project.panelSettings.wp;
            document.getElementById('panelW').value = project.panelSettings.w;
            document.getElementById('panelH').value = project.panelSettings.h;

            project.areas.forEach(aData => {
                const area = {
                    name: aData.name,
                    type: aData.type,
                    azimut: aData.azimut,
                    corners: aData.corners,
                    panels: aData.panels,
                    kwp: aData.kwp,
                    kwh: aData.kwh,
                    rowsPerString: aData.rowsPerString,
                    stringsPerBlock: aData.stringsPerBlock,
                    stringGap: aData.stringGap,
                    blockGap: aData.blockGap,
                    margin: aData.margin,
                    prezzo: aData.prezzo,
                    prezzoKwp: aData.prezzoKwp,
                    prezzoKwh: aData.prezzoKwh,
                    revenue: aData.revenue,
                    layer: null,
                    panelLayers: [],
                    cabinLayer: null,
                    cabinHandle: null,
                    panelsFromDraw: false
                };

                const latLngs = area.corners.map(([lat, lng]) => L.latLng(lat, lng));
                const polygon = L.polygon(latLngs, { color: window.solarToolsConfig.CLRS[area.type] || '#F5A623' });
                polygon.addTo(drawn);
                area.layer = polygon;

                area.layer.editing.enable();
                areas.push(area);

                enableCabinRotation(area);
            });

            updateAll();
            notify('✓', 'Progetto caricato');
        } catch (err) {
            console.error('Load error:', err);
            notify('⚠', 'Errore caricamento file');
        }
    };
    reader.readAsText(file);

    document.getElementById('fileLoader').value = '';
}

recalc();
