'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   HelioH₂ — zone-analysis.js
   Fetches and classifies OSM/Nominatim data for a bounding box.

   Public API:
     fetchOverpass(S, W, N, E)   → Promise<object>   raw Overpass JSON
     fetchNominatim(lat, lng)     → Promise<object>   raw Nominatim JSON
     classifyElements(elements)   → { type, confidence }
     extractComune(data)          → { comune, provincia, regione }

   extractComune calls window.setPUNZone (pun-fetch.js) as a side-effect.
   ═══════════════════════════════════════════════════════════════════════════ */

window.fetchOverpass = async function (S, W, N, E) {
    const q = `[out:json][timeout:15];(way["landuse"](${S},${W},${N},${E});way["building"](${S},${W},${N},${E});relation["landuse"](${S},${W},${N},${E}););out tags;`;
    const r = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`);
    if (!r.ok) throw new Error('Overpass ' + r.status);
    return r.json();
};

window.fetchNominatim = async function (lat, lng) {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=it`, { headers: { 'User-Agent': 'SolarMapPro/1.0' } });
    if (!r.ok) throw new Error('Nominatim ' + r.status);
    return r.json();
};

window.classifyElements = function (elements) {
    const LU = { farmland: 'agricultural', meadow: 'agricultural', orchard: 'agricultural', vineyard: 'agricultural', greenhouse_horticulture: 'agricultural', farm: 'agricultural', farmyard: 'agricultural', allotments: 'agricultural', industrial: 'industrial', commercial: 'industrial', retail: 'industrial', residential: 'industrial' };
    const BL = { warehouse: 'capannone', industrial: 'capannone', factory: 'capannone', hangar: 'capannone', manufacture: 'capannone', commercial: 'capannone', retail: 'capannone', office: 'capannone', supermarket: 'capannone', hotel: 'capannone', house: 'capannone', detached: 'capannone', apartments: 'capannone', residential: 'capannone', terrace: 'capannone', yes: 'capannone', parking: 'parcheggio' };
    const s = { agricultural: 0, industrial: 0, capannone: 0, parcheggio: 0 };
    for (const el of elements) { const t = el.tags || {}; if (t.landuse && LU[t.landuse]) s[LU[t.landuse]] += 2; if (t.building && BL[t.building]) s[BL[t.building]] += 1; }
    const total = Object.values(s).reduce((a, b) => a + b, 0);
    if (total === 0) return { type: null, confidence: 0 };
    const [best] = Object.entries(s).sort((a, b) => b[1] - a[1]);
    return { type: best[1] > 0 ? best[0] : null, confidence: best[1] / total };
};

window.extractComune = function (data) {
    if (!data || data.error) return { comune: '', provincia: '', regione: '' };
    const a = data.address || {};
    const regione = a.state || '';
    if (regione && typeof window.setPUNZone === 'function') window.setPUNZone(regione);
    return { comune: a.city || a.town || a.village || a.municipality || '', provincia: a.county || a.state_district || '', regione };
};
