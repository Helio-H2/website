/* ═══════════════════════════════════════════════════════════════════════════
   HelioH₂ — pun-fetch.js
   Fetches day-ahead PUN (Prezzo Unico Nazionale) from ENTSO-E for the
   bidding zone matching the area drawn on the map.

   Call window.setPUNZone(nominatimStateName) from estimatore.js whenever
   a new area is geocoded — the script re-fetches and updates the badge.

   Italian bidding zones (ENTSO-E A44):
     NORD  10Y1001A1001A73I  — VDA, PIE, LIG, LOM, VEN, TAA, FVG, EMR
     CNOR  10Y1001A1001A70O  — TOS, MAR
     CSUD  10Y1001A1001A71M  — LAZ, UMB, MOL, ABR, CAM
     SUD   10Y1001A1001A788  — PUG, BAS, CAL, SIC
     SARD  10Y1001A1001A74G  — SAR
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

const PUN_CONFIG = {
    TOKEN: '061d77c5-a320-4590-af14-4024ed55a265',
    DOC_TYPE: 'A44',
    CACHE_PREFIX: 'helioh2_pun_',
    CACHE_HOURS: 24,
    FALLBACK: 0.11,
    // Fields to update — first one found in the DOM wins; estimatore uses energyPrice
    FIELD_IDS: ['ind-prezzo-cessione', 'energyPrice'],
    BADGE_ID: 'pun-badge',
};

/* ─── ZONE DEFINITIONS ───────────────────────────────────────────────────── */
const PUN_ZONES = {
    NORD: { eic: '10Y1001A1001A73I', label: 'Nord' },
    CNOR: { eic: '10Y1001A1001A70O', label: 'Centro-Nord' },
    CSUD: { eic: '10Y1001A1001A71M', label: 'Centro-Sud' },
    SUD:  { eic: '10Y1001A1001A788', label: 'Sud' },
    SARD: { eic: '10Y1001A1001A74G', label: 'Sardegna' },
};

// Nominatim address.state → zone key (Italian + English names)
const REGION_TO_ZONE = {
    // Italian names
    "Aosta Valley":                         'NORD',
    'Piedmont':                             'NORD',
    'Lombardy':                             'NORD',
    'Veneto':                               'NORD',
    'Trentino – Alto Adige/Südtirol':       'NORD',
    'Friuli – Venezia Giulia':              'NORD',
    'Emilia-Romagna':                       'NORD',
    'Tuscany':                              'CNOR',
    'Marche':                               'CNOR',
    'Lazio':                                'CSUD',
    'Umbria':                               'CSUD',
    'Molise':                               'CSUD',
    'Abruzzo':                              'CSUD',
    'Campania':                             'CSUD',
    'Apulia':                               'SUD',
    'Basilicata':                           'SUD',
    'Calabria':                             'SUD',
    'Sicily':                               'SUD',
    'Sardinia':                             'SARD',
    "Valle d'Aosta":                        'NORD',
    'Piemonte':                             'NORD',
    'Lombardia':                            'NORD',
    'Veneto':                               'NORD',
    'Trentino – Alto Adige/Südtirol':       'NORD',
    'Friuli – Venezia Giulia':              'NORD',
    'Emilia-Romagna':                       'NORD',
    'Toscana':                              'CNOR',
    'Marche':                               'CNOR',
    'Lazio':                                'CSUD',
    'Umbria':                               'CSUD',
    'Molise':                               'CSUD',
    'Abruzzo':                              'CSUD',
    'Campania':                             'CSUD',
    'Puglia':                               'SUD',
    'Basilicata':                           'SUD',
    'Calabria':                             'SUD',
    'Sicilia':                              'SUD',
    'Sardegna':                             'SARD'
};

let activeZoneKey = 'NORD';

/* ─── PUBLIC API ─────────────────────────────────────────────────────────── */

/**
 * Fetch PUN for a given Nominatim region name (on-demand, for use on submit).
 * Returns { pun, zoneLabel, fallback }
 */
window.fetchPUNForZone = async function (stateName) {
    const key = resolveZoneKey(stateName);
    const zone = PUN_ZONES[key];
    const cached = loadCache(key);
    if (cached !== null && cached.pun > 0) return { pun: cached.pun, zoneLabel: zone.label, fallback: false };
    try {
        const { pun, date } = await queryENTSOE(zone.eic);
        saveCache(key, pun, date);
        return { pun, zoneLabel: zone.label, fallback: false };
    } catch (err) {
        console.warn('[PUN] fetchPUNForZone fallito:', err.message);
        const fallback = (typeof CONFIG !== 'undefined' && CONFIG.PUN_DEFAULT_KWH)
            ? CONFIG.PUN_DEFAULT_KWH : PUN_CONFIG.FALLBACK;
        return { pun: fallback, zoneLabel: zone.label, fallback: true };
    }
};

window.setPUNZone = function (stateName) {
    if (!stateName) return;
    const key = resolveZoneKey(stateName);
    if (key === activeZoneKey) return;
    activeZoneKey = key;
    fetchPUN();
};

function resolveZoneKey(stateName) {
    if (!stateName) return 'NORD';
    // Exact match first
    if (REGION_TO_ZONE[stateName]) return REGION_TO_ZONE[stateName];
    // Partial match (handles slight variations from Nominatim)
    const lower = stateName.toLowerCase();
    for (const [name, zone] of Object.entries(REGION_TO_ZONE)) {
        if (lower.includes(name.toLowerCase()) || name.toLowerCase().includes(lower)) return zone;
    }
    return 'NORD';
}

/* ─── ENTRY POINT ────────────────────────────────────────────────────────── */
// Auto-fetch removed — user triggers PUN via the "PUN" button.
// Zone tracking via window.setPUNZone() still works (called by analyzeArea).

function getPUNField() {
    for (const id of PUN_CONFIG.FIELD_IDS) {
        const el = document.getElementById(id);
        if (el) return el;
    }
    return null;
}

function applyDefault() {
    const field = getPUNField();
    if (!field || field.value) return;
    const defaultVal = (typeof CONFIG !== 'undefined' && CONFIG.PUN_DEFAULT_KWH)
        ? CONFIG.PUN_DEFAULT_KWH
        : PUN_CONFIG.FALLBACK;
    field.value = defaultVal.toFixed(4);
    field.placeholder = defaultVal.toFixed(4);
    const badge = document.getElementById(PUN_CONFIG.BADGE_ID);
    if (badge) {
        badge.textContent = `⏳ Rilevamento zona… (valore temporaneo: €${defaultVal.toFixed(3)}/kWh)`;
        badge.className = 'pun-badge pun-loading';
    }
}

async function fetchPUN() {
    const zone = PUN_ZONES[activeZoneKey];

    // 1. Try zone-specific cache
    const cached = loadCache(activeZoneKey);
    if (cached !== null && cached.pun > 0) {
        applyPrice(cached.pun, cached.date, zone, true);
        return;
    }

    // 2. Call ENTSO-E
    try {
        const { pun, date } = await queryENTSOE(zone.eic);
        saveCache(activeZoneKey, pun, date);
        applyPrice(pun, date, zone, false);
    } catch (err) {
        console.warn('[PUN] Fetch fallito:', err.message);
        const fallback = (typeof CONFIG !== 'undefined' && CONFIG.PUN_DEFAULT_KWH)
            ? CONFIG.PUN_DEFAULT_KWH
            : PUN_CONFIG.FALLBACK;
        applyPrice(fallback, null, zone, false, true);
    }
}

/* ─── ENTSO-E QUERY ──────────────────────────────────────────────────────── */
async function queryENTSOE(eic) {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const start = formatENTSOEDate(yesterday) + '0000';
    const end   = formatENTSOEDate(now) + '2300';

    const url = new URL('https://j5noo7hydmmdw2yu3wycwkaqbi0mwdly.lambda-url.eu-south-1.on.aws/');
    url.searchParams.set('securityToken', PUN_CONFIG.TOKEN);
    url.searchParams.set('documentType',  PUN_CONFIG.DOC_TYPE);
    url.searchParams.set('in_Domain',  eic);
    url.searchParams.set('out_Domain', eic);
    url.searchParams.set('periodStart', start);
    url.searchParams.set('periodEnd',   end);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
        const resp = await fetch(url.toString(), { signal: ctrl.signal });
        if (!resp.ok) throw new Error(`ENTSO-E HTTP ${resp.status}`);
        const xml = await resp.text();
        return parseENTSOEXML(xml);
    } finally {
        clearTimeout(timer);
    }
}

/* ─── XML PARSER ─────────────────────────────────────────────────────────── */
function parseENTSOEXML(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');

    // Check for ENTSO-E error response
    const reason = doc.getElementsByTagName('Reason')[0];
    if (reason) {
        const code = reason.getElementsByTagName('code')[0]?.textContent;
        const text = reason.getElementsByTagName('text')[0]?.textContent;
        throw new Error(`ENTSO-E ${code}: ${text}`);
    }

    // getElementsByTagName handles the dot in <price.amount> correctly
    const points = doc.getElementsByTagName('price.amount');
    if (!points.length) throw new Error('Nessun dato di prezzo nella risposta ENTSO-E');

    const prices = Array.from(points)
        .map(p => parseFloat(p.textContent))
        .filter(v => !isNaN(v));
    const avg = prices.reduce((s, v) => s + v, 0) / prices.length;

    // ENTSO-E returns €/MWh → convert to €/kWh
    const punKWh = avg / 1000;

    const periodStart = doc.getElementsByTagName('start')[0];
    const dateLabel = periodStart ? formatDateLabel(periodStart.textContent) : 'ieri';

    return { pun: parseFloat(punKWh.toFixed(4)), date: dateLabel };
}

/* ─── APPLY TO FIELD ─────────────────────────────────────────────────────── */
function applyPrice(pun, date, zone, fromCache, isFallback = false) {
    const field = getPUNField();
    const badge = document.getElementById(PUN_CONFIG.BADGE_ID);

    if (field) {
        field.value = pun.toFixed(4);
        field.placeholder = pun.toFixed(4);
        field.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (!badge) return;

    const zoneTag = zone ? ` [${zone.label}]` : '';

    if (isFallback) {
        badge.textContent = `⚠️ Valore di default${zoneTag} (${pun.toFixed(3)} €/kWh) — ENTSO-E non raggiungibile`;
        badge.className = 'pun-badge pun-fallback';
    } else if (fromCache) {
        badge.textContent = `✓ PUN${zoneTag}: ${pun.toFixed(4)} €/kWh (${date} — da cache)`;
        badge.className = 'pun-badge pun-cached';
    } else {
        badge.textContent = `✓ PUN day-ahead${zoneTag}: ${pun.toFixed(4)} €/kWh (media ${date})`;
        badge.className = 'pun-badge pun-live';
    }
}

/* ─── CACHE ──────────────────────────────────────────────────────────────── */
function saveCache(zoneKey, pun, date) {
    try {
        localStorage.setItem(PUN_CONFIG.CACHE_PREFIX + zoneKey, JSON.stringify({
            pun, date, timestamp: Date.now(),
        }));
    } catch (e) { }
}

function loadCache(zoneKey) {
    try {
        const raw = localStorage.getItem(PUN_CONFIG.CACHE_PREFIX + zoneKey);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        if ((Date.now() - cached.timestamp) / 3600000 > PUN_CONFIG.CACHE_HOURS) return null;
        return cached;
    } catch (e) {
        return null;
    }
}

/* ─── DATE HELPERS ───────────────────────────────────────────────────────── */
function formatENTSOEDate(d) {
    const y  = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}${mo}${dd}`;
}

function formatDateLabel(isoString) {
    try {
        return new Date(isoString).toLocaleDateString('it-IT', {
            day: '2-digit', month: '2-digit', year: 'numeric',
        });
    } catch (e) {
        return isoString;
    }
}
