'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   HelioH₂ — pvgis-fetch.js
   Fetches annual solar production data from PVGIS via the Lambda proxy.

   Public API:
     fetchPVGIS(lat, lon, peakpowerKWp, options) → Promise<number>
       Returns annual kWh production for the given peak power.
       options: { loss, angle, aspect, timeout, fallbackKWhPerKWp }

   Both estimatore.js and simulatore.js use this module.
   ═══════════════════════════════════════════════════════════════════════════ */

const PVGIS_PROXY = 'https://2zwsnpimkl5chewtv5gqkxq3mm0kkvqh.lambda-url.eu-south-1.on.aws/';

const PVGIS_DEFAULTS = {
    loss:              14,
    angle:             30,
    aspect:            0,
    timeout:           10000,
    cacheDays:         30,
    fallbackKWhPerKWp: 1200,
};

/**
 * Fetch annual kWh production from PVGIS.
 *
 * @param {number|string} lat
 * @param {number|string} lon
 * @param {number|string} peakpowerKWp  — installed peak power in kWp
 * @param {object}        options       — override any PVGIS_DEFAULTS key
 * @returns {Promise<{ annualkWh: number, fallback: boolean }>}
 */
window.fetchPVGIS = async function (lat, lon, peakpowerKWp, options = {}) {
    lat          = parseFloat(lat);
    lon          = parseFloat(lon);
    peakpowerKWp = parseFloat(peakpowerKWp);

    const cfg = { ...PVGIS_DEFAULTS, ...options };

    const cacheKey = `pvgis_${lat.toFixed(2)}_${lon.toFixed(2)}_${peakpowerKWp.toFixed(2)}_${cfg.angle}_${cfg.aspect}`;
    const cached = loadCache(cacheKey, cfg.cacheDays);
    if (cached !== null) return cached;

    const params = new URLSearchParams({
        lat:          lat,
        lon:          lon,
        peakpower:    peakpowerKWp,
        loss:         cfg.loss,
        angle:        cfg.angle,
        aspect:       cfg.aspect,
        outputformat: 'json',
    });

    const ctrl    = new AbortController();
    const timer   = setTimeout(() => ctrl.abort(), cfg.timeout);

    try {
        const resp = await fetch(`${PVGIS_PROXY}?${params}`, { signal: ctrl.signal });
        if (!resp.ok) throw new Error(`PVGIS HTTP ${resp.status}`);
        const data = await resp.json();
        if (data.status === 'error') throw new Error(`PVGIS: ${data.message}`);

        let annualkWh = data?.outputs?.totals?.fixed?.E_y ?? null;
        if (annualkWh === null && data?.outputs?.monthly?.length) {
            annualkWh = data.outputs.monthly.reduce((s, m) => s + (m.E_m || 0), 0);
        }
        if (!annualkWh || annualkWh <= 0) throw new Error('PVGIS: dati non disponibili');

        const result = { annualkWh: Math.round(annualkWh), fallback: false };
        saveCache(cacheKey, result);
        return result;

    } catch (err) {
        console.warn('[PVGIS] Fetch fallito, uso stima media:', err.message);
        return { annualkWh: Math.round(peakpowerKWp * cfg.fallbackKWhPerKWp), fallback: true };
    } finally {
        clearTimeout(timer);
    }
};

/* ─── CACHE ──────────────────────────────────────────────────────────────── */
function saveCache(key, value) {
    try { localStorage.setItem(key, JSON.stringify({ ...value, timestamp: Date.now() })); } catch (e) {}
}

function loadCache(key, cacheDays) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if ((Date.now() - parsed.timestamp) / 86400000 > cacheDays) return null;
        return parsed;
    } catch (e) { return null; }
}
