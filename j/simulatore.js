/* ═══════════════════════════════════════════════════════════════════════════
   HelioH₂ — simulatore.js
   Estimator logic for Soluzioni Indipendenti + Soluzioni Integrate
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

/* ─── HARDCODED ASSUMPTIONS (Gabriel modifica qui) ───────────────────────── */
const CONFIG = {
    WATTS_PER_M2_IND: 100000 / 1500,  // W/m² — densità impianto a terra (Indipendente)
    WATTS_PER_M2_INT: 100000 / 1700,  // W/m² — densità impianto su tetto (Integrata) — tipicamente più bassa
    CAPEX_PER_KW_INDIPENDENTE: 1250,   // €/kW — standalone
    CAPEX_PER_KW_PROPRIETA: 1650,   // €/kW — integrato, proprietà totale
    IND_MIN_SUPERFICIE_M2: 3500,        // m² — superficie minima accettata per Soluzioni Indipendenti
    INT_MIN_KWP_INSTALLATI: 20,        // m² — superficie minima accettata per Soluzioni Indipendenti
    F1_WEIGHT: 1.00,   // ore di punta — copertura solare 100%
    F2_WEIGHT: 0.75,   // ore intermedie — 75%
    F3_WEIGHT: 0.50,   // ore fuori punta — 50%
    ROYALTY_DISCOUNT: 0.30,   // sconto energia azienda in scenario Risparmio
    ROYALTY: 0.20,   // sconto energia azienda in scenario Rendita
    GEOCODE_FALLBACK_LAT: 45.07,  // Moncalieri/Torino — fallback
    GEOCODE_FALLBACK_LON: 7.69,
    PVGIS_FALLBACK_KWH_PER_KWP: 1250,  // kWh/kWp/anno — stima conservativa nord Italia se PVGIS non risponde
    PVGIS_TILT_ANGLE: 20,   // ° — inclinazione pannelli (0=orizzontale, 90=verticale; ottimale nord Italia ~30-35°)
    PVGIS_LOSS_PERCENT: 14,     // % perdite sistema
    PVGIS_CACHE_DAYS: 30,     // giorni validità cache
    PUN_DEFAULT_KWH: 0.11,  // €/kWh — fallback se ENTSO-E non risponde
};

/* ─── STATE ───────────────────────────────────────────────────────────────── */
let currentTool = null;

// Risultati calcolati (per email pre-fill)
let indResults = {};
let intResults = {};

/* ─── INIT ────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const tool = params.get('t');
    if (tool === 'solind' || tool === 'solint') {
        switchTool(tool);
    }

    // Form submissions
    document.getElementById('form-indipendente').addEventListener('submit', handleIndipendente);
    document.getElementById('form-integrata').addEventListener('submit', handleIntegrata);

    // Init range callouts
    document.querySelectorAll('input[type="range"]').forEach(el => {
        const labelId = el.nextElementSibling?.id;
        if (labelId) updateRangeCallout(el, labelId, '%');
    });
});

/* ─── TOOL SWITCHER ───────────────────────────────────────────────────────── */
function switchTool(tool) {
    currentTool = tool;

    // Update URL without reload
    const url = new URL(window.location);
    url.searchParams.set('t', tool);
    window.history.replaceState({}, '', url);

    // Tab states
    document.getElementById('tab-indipendente').setAttribute('aria-selected', tool === 'solind' ? 'true' : 'false');
    document.getElementById('tab-integrata').setAttribute('aria-selected', tool === 'solint' ? 'true' : 'false');
    document.getElementById('tab-indipendente').classList.toggle('active', tool === 'solind');
    document.getElementById('tab-integrata').classList.toggle('active', tool === 'solint');

    // Panel visibility
    document.getElementById('panel-default').hidden = true;
    document.getElementById('panel-indipendente').hidden = (tool !== 'solind');
    document.getElementById('panel-integrata').hidden = (tool !== 'solint');

    // Scroll to estimator area
    //document.getElementById('estimator-area').scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Swap hero image
    const hero = document.getElementById('hero-simulatore');
    hero.classList.remove('hero-indipendente', 'hero-integrata');
    if (tool === 'solind') hero.classList.add('hero-indipendente');
    if (tool === 'solint') hero.classList.add('hero-integrata');
}

/* ─── CONSUMPTION MODE TOGGLE (Integrata) ─────────────────────────────────── */
function toggleConsumptionMode(mode) {
    const totBlock = document.getElementById('consumo-totale-block');
    const f123Block = document.getElementById('consumo-f1f2f3-block');
    const totInput = document.getElementById('int-consumo-tot');

    if (mode === 'totale') {
        totBlock.hidden = false;
        f123Block.hidden = true;
        totInput.required = true;
        ['int-f1', 'int-f2', 'int-f3'].forEach(id => {
            document.getElementById(id).required = false;
        });
    } else {
        totBlock.hidden = true;
        f123Block.hidden = false;
        totInput.required = false;
        // F1/F2/F3 non sono strettamente required ma almeno uno deve avere valore > 0
    }
}

/* ═══════════════════════════════════════════════════════════════════════════
   GEOCODING (Nominatim / OpenStreetMap + Autocomplete integration)
   ═══════════════════════════════════════════════════════════════════════════ */
async function geocodeAddress(address, inputElement = null) {
    // Priority 1: Check if address was selected from autocomplete with result data
    if (inputElement && inputElement.dataset.result) {
        try {
            const autocompleteResult = JSON.parse(inputElement.dataset.result);
            const regione = autocompleteResult.regione || autocompleteResult.state || '';
            if (regione && typeof window.setPUNZone === 'function') window.setPUNZone(regione);
            return {
                lat: autocompleteResult.lat,
                lon: autocompleteResult.lon,
                displayName: autocompleteResult.name,
                boundingbox: autocompleteResult.boundingbox,
                addresstype: autocompleteResult.addresstype,
                regione,
                fallback: false,
                source: 'autocomplete',
            };
        } catch (e) {
            console.warn('[Simulatore] Errore parsing autocomplete result:', e);
        }
    }

    // Priority 2: Cache lookup
    const cacheKey = `geo_${address.trim().toLowerCase()}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (parsed.regione && typeof window.setPUNZone === 'function') window.setPUNZone(parsed.regione);
            return parsed;
        } catch (e) { }
    }

    // Priority 3: Nominatim API call
    try {
        const encoded = encodeURIComponent(address);
        const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&accept-language=it&addressdetails=1`;
        const resp = await fetch(url, { headers: { 'Accept-Language': 'it' } });
        const data = await resp.json();

        if (data && data.length > 0) {
            const addr = data[0].address || {};
            const regione = addr.state || '';
            if (regione && typeof window.setPUNZone === 'function') window.setPUNZone(regione);
            const result = {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon),
                displayName: data[0].display_name.split(',').slice(0, 2).join(', '),
                boundingbox: data[0].boundingbox,
                regione,
                fallback: false,
                source: 'nominatim',
            };
            localStorage.setItem(cacheKey, JSON.stringify(result));
            return result;
        }
    } catch (err) {
        console.warn('[Simulatore] Geocoding fallito, uso default Moncalieri:', err);
    }

    // Fallback: coordinate default
    return {
        lat: CONFIG.GEOCODE_FALLBACK_LAT,
        lon: CONFIG.GEOCODE_FALLBACK_LON,
        displayName: address,
        regione: '',
        fallback: true,
        source: 'default',
    };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PVGIS API — delegated to pvgis-fetch.js
   ═══════════════════════════════════════════════════════════════════════════ */
async function getPVGISData(lat, lon, kWp) {
    const { annualkWh, fallback } = await window.fetchPVGIS(lat, lon, kWp, {
        loss:              CONFIG.PVGIS_LOSS_PERCENT,
        angle:             CONFIG.PVGIS_TILT_ANGLE,
        cacheDays:         CONFIG.PVGIS_CACHE_DAYS,
        fallbackKWhPerKWp: CONFIG.PVGIS_FALLBACK_KWH_PER_KWP,
    });
    return { annualkWhproduction: annualkWh, fallback };
}

/* ═══════════════════════════════════════════════════════════════════════════
   HANDLER: INDIPENDENTE
   ═══════════════════════════════════════════════════════════════════════════ */
async function handleIndipendente(e) {
    e.preventDefault();
    const form = e.target;

    const citta = form.querySelector('#ind-citta').value.trim();
    const superficie = parseFloat(form.querySelector('#ind-superficie').value);
    const affittoPercent = parseFloat(document.getElementById('ind-affitto-slider').value);
    const errEl = document.getElementById('ind-error');

    errEl.hidden = true;
    if (!citta || isNaN(superficie) || isNaN(affittoPercent)) {
        showError(errEl, 'Compila tutti i campi obbligatori prima di calcolare.');
        return;
    }
    if (superficie < CONFIG.IND_MIN_SUPERFICIE_M2) {
        showError(errEl, `La superficie minima accettata è ${CONFIG.IND_MIN_SUPERFICIE_M2.toLocaleString('it-IT')} m². Se il tuo terreno è di poco inferiore, fai il calcolo con ${CONFIG.IND_MIN_SUPERFICIE_M2.toLocaleString('it-IT')}`); return;
    }

    showLoading('ind', true);
    hideResults('ind');
    document.getElementById('ind-data-cards').hidden = true;

    try {
        const kWp = (superficie * CONFIG.WATTS_PER_M2_IND) / 1000;

        const cittaInput = form.querySelector('#ind-citta');
        const geo = await geocodeAddress(citta, cittaInput);

        const [punResult, pvgis] = await Promise.all([
            window.fetchPUNForZone(geo.regione),
            getPVGISData(geo.lat, geo.lon, kWp),
        ]);

        const prezzoCessione = punResult.pun;
        const annualRevenue = pvgis.annualkWhproduction * prezzoCessione;
        const rentAmount = annualRevenue * (affittoPercent / 100);

        renderDataCards('ind', prezzoCessione, pvgis.annualkWhproduction / kWp, punResult.zoneLabel, pvgis.fallback, punResult.fallback);

        indResults = {
            citta, superficie,
            kWp: Math.round(kWp),
            annualkWh: Math.round(pvgis.annualkWhproduction),
            tariff: prezzoCessione,
            prezzoCessione,
            annualRevenue: Math.round(annualRevenue),
            affittoPercent,
            rentAmount: Math.round(rentAmount),
            geoDisplay: geo.displayName,
            pvgisFallback: pvgis.fallback,
            geoFallback: geo.fallback,
        };

        showLoading('ind', false);
        renderIndResults(indResults, pvgis.fallback, geo.fallback);

    } catch (err) {
        showLoading('ind', false);
        showError(errEl, 'Errore durante il calcolo. Riprova tra pochi istanti.');
        console.error('[Simulatore] Errore calcolo Indipendente:', err);
    }
}

function renderIndResults(r, pvgisFallback, geoFallback) {
    document.getElementById('ind-res-citta').textContent = r.geoDisplay;
    document.getElementById('ind-kwp').textContent = fmtNum(r.kWp);
    document.getElementById('ind-kwh').textContent = fmtNum(r.annualkWh);
    document.getElementById('ind-revenue').textContent = fmtEuro(r.annualRevenue);
    document.getElementById('ind-affitto').textContent = fmtEuro(r.rentAmount);

    const badge = document.getElementById('ind-pvgis-badge');
    if (pvgisFallback || geoFallback) {
        badge.textContent = '\u26A0 Dati stimati (media nord Italia). Per dati precisi verifica l\'indirizzo.';
        badge.classList.add('badge-warning');
    } else {
        badge.textContent = '\u2713 Producibilit\u00E0 calcolata su dati PVGIS (JRC \u2013 Commissione Europea)';
        badge.classList.remove('badge-warning');
    }

    document.getElementById('ind-results').hidden = false;
    document.getElementById('ind-placeholder').hidden = true;
    document.getElementById('ind-results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ═══════════════════════════════════════════════════════════════════════════
   HANDLER: INTEGRATA
   ═══════════════════════════════════════════════════════════════════════════ */
async function handleIntegrata(e) {
    e.preventDefault();
    const form = e.target;

    const citta = form.querySelector('#int-citta').value.trim();
    const superficie = parseFloat(form.querySelector('#int-superficie').value);
    const componente = parseFloat(form.querySelector('#int-componente').value);
    const oneri = parseFloat(form.querySelector('#int-oneri').value);
    const totalePercent = parseFloat(document.getElementById('int-consumo-slider').value);
    const consumoType = form.querySelector('input[name="consumo-type"]:checked').value;
    const errEl = document.getElementById('int-error');

    // Consumo solare compatibile
    let consumoSolare = 0;
    let consumoLabel = '';

    if (consumoType === 'totale') {
        const tot = parseFloat(form.querySelector('#int-consumo-tot').value);
        if (isNaN(tot) || tot < 1) {
            showError(errEl, 'Inserisci il consumo annuale totale.');
            return;
        }
        consumoSolare = tot * totalePercent / 100;
        consumoLabel = fmtNum(Math.round(tot));
    } else {
        const f1 = parseFloat(form.querySelector('#int-f1').value) || 0;
        const f2 = parseFloat(form.querySelector('#int-f2').value) || 0;
        const f3 = parseFloat(form.querySelector('#int-f3').value) || 0;
        if (f1 + f2 + f3 === 0) {
            showError(errEl, 'Inserisci almeno un valore tra F1, F2 e F3.');
            return;
        }
        consumoSolare = (f1 * CONFIG.F1_WEIGHT) + (f2 * CONFIG.F2_WEIGHT) + (f3 * CONFIG.F3_WEIGHT);
        consumoLabel = `F1 ${fmtNum(Math.round(f1))} + F2 ${fmtNum(Math.round(f2))} + F3 ${fmtNum(Math.round(f3))} kWh`;
    }

    errEl.hidden = true;

    if (!citta || isNaN(superficie) || isNaN(componente) || isNaN(oneri)) {
        showError(errEl, 'Compila tutti i campi obbligatori prima di calcolare.');
        return;
    }

    showLoading('int', true);
    hideResults('int');
    document.getElementById('int-data-cards').hidden = true;

    try {
        const kWp = (superficie * CONFIG.WATTS_PER_M2_INT) / 1000;
        if (kWp < CONFIG.INT_MIN_KWP_INSTALLATI) {
            showLoading('int', false);
            showError(errEl, `Non installiamo impianti inferiori a ${CONFIG.INT_MIN_KWP_INSTALLATI}kWp`); return;
        }

        const cittaInput = form.querySelector('#int-citta');
        const geo = await geocodeAddress(citta, cittaInput);

        // Fetch PUN and PVGIS in parallel after submit
        const [punResult, pvgis] = await Promise.all([
            window.fetchPUNForZone(geo.regione),
            getPVGISData(geo.lat, geo.lon, kWp),
        ]);

        const prezzoCessione = punResult.pun;
        renderDataCards('int', prezzoCessione, pvgis.annualkWhproduction / kWp, punResult.zoneLabel, pvgis.fallback, punResult.fallback);

        const tariff = componente + oneri;
        const annualkWh = pvgis.annualkWhproduction;

        // ── Scenario 1: PROPRIETÀ ──────────────────────────────────────────
        const b_capex = CONFIG.CAPEX_PER_KW_PROPRIETA;
        const p_capex = kWp * CONFIG.CAPEX_PER_KW_PROPRIETA;
        const p_savings = consumoSolare * tariff;
        const p_revenue = (annualkWh - consumoSolare) * prezzoCessione; // produzione annuale meno l'autoconsumo, per il prezzo zonale


        // ── Scenario 2: RISPARMIO ──────────────────────────────────────────
        const r_discount = CONFIG.ROYALTY_DISCOUNT;
        const r_savings = consumoSolare * tariff * (1 - r_discount) // consumo delle ore solari, per la spesa attuale a cui applicare lo sconto;

        // ── Scenario 3: RENDITA ────────────────────────────────────────────
        const rend_royalty = CONFIG.ROYALTY;
        const rend_revenue = annualkWh * rend_royalty * prezzoCessione;

        intResults = {
            citta,
            superficie,
            consumoLabel,
            consumoSolare: Math.round(consumoSolare),
            kWp: Math.round(kWp),
            annualkWh: Math.round(annualkWh),
            tariff,
            geoDisplay: geo.displayName,
            pvgisFallback: pvgis.fallback,
            geoFallback: geo.fallback,
            // Proprietà
            b_capex: Math.round(b_capex),
            p_capex: Math.round(p_capex),
            p_revenue: Math.round(p_revenue + p_savings),
            // Risparmio
            r_savings: Math.round(r_savings),
            r_discount: r_discount * 100,
            // Rendita
            rend_royalty: rend_royalty * 100,
            rend_revenue: Math.round(rend_revenue),
        };

        showLoading('int', false);
        renderIntResults(intResults, pvgis.fallback, geo.fallback);

    } catch (err) {
        showLoading('int', false);
        showError(errEl, 'Errore durante il calcolo. Riprova tra pochi istanti.');
        console.error('[Simulatore] Errore calcolo Integrata:', err);
    }
}

function renderIntResults(r, pvgisFallback, geoFallback) {
    document.getElementById('int-res-citta').textContent = r.geoDisplay;
    document.getElementById('int-kwp').textContent = fmtNum(r.kWp);
    document.getElementById('int-kwh').textContent = fmtNum(r.annualkWh);

    // Proprietà
    document.getElementById('int-b-capex').textContent = fmtEuro(r.b_capex);
    document.getElementById('int-p-capex').textContent = fmtEuro(r.p_capex);
    document.getElementById('int-p-revenue').textContent = fmtEuro(r.p_revenue) + '/anno';

    // Risparmio
    document.getElementById('int-r-savings').textContent = fmtEuro(r.r_savings) + '/anno';
    document.getElementById('int-scontoRisparmio').textContent = fmtNum(r.r_discount);

    // Rendita — investimento azienda = n.d. (HelioH₂ investe, azienda non spende)    
    document.getElementById('int-rend-revenue').textContent = fmtEuro(r.rend_revenue) + '/anno';
    document.getElementById('int-rentiRendita').textContent = fmtNum(r.rend_royalty);

    const badge = document.getElementById('int-pvgis-badge');
    if (pvgisFallback || geoFallback) {
        badge.textContent = '\u26A0 Dati stimati (media nord Italia). Per dati precisi verifica l\'indirizzo.';
        badge.classList.add('badge-warning');
    } else {
        badge.textContent = '\u2713 Producibilit\u00E0 calcolata su dati PVGIS (JRC \u2013 Commissione Europea)';
        badge.classList.remove('badge-warning');
    }

    document.getElementById('int-results').hidden = false;
    document.getElementById('int-placeholder').hidden = true;
    document.getElementById('int-results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

}

/* ═══════════════════════════════════════════════════════════════════════════
   EMAIL AND WHATSAPP PRE-FILL
   ═══════════════════════════════════════════════════════════════════════════ */
function buildBodyIndipendente(r, nome, tel) {
    return [
        'Ciao,',
        '',
        'Ho completato una stima preliminare con il vostro simulatore.',
        '',
        '--- DATI PRINCIPALI ---',
        `Ubicazione: ${r.geoDisplay}`,
        `Superficie: ${fmtNum(r.superficie)} m²`,
        '',
        '--- RISULTATI ---',
        `Capacità stimata: ${fmtNum(r.kWp)} kWp`,
        `Produzione annuale: ${fmtNum(r.annualkWh)} kWh/anno`,
        `Ricavi annuali (prezzo cessione €${r.prezzoCessione.toFixed(3)}/kWh): €${fmtNum(r.annualRevenue)}`,
        `Affitto annuale stimato (${r.affittoPercent}% del fatturato): €${fmtNum(r.rentAmount)}`,
        '',
        nome ? `Nome: ${nome}` : '',
        tel ? `Telefono: ${tel}` : 'Telefono: (non indicato)',
        '',
        'Grazie,',
    ].filter(l => l !== null).join('\n');
}

function buildBodyIntegrata(r, nome, tel) {
    return [
        'Ciao,',
        '',
        'Ho completato una stima preliminare con il vostro simulatore.',
        '',
        '--- DATI PRINCIPALI ---',
        `Ubicazione: ${r.geoDisplay}`,
        `Superficie: ${fmtNum(r.superficie)} m²`,
        `Consumo solare compatibile stimato: ${fmtNum(r.consumoSolare)} kWh/anno`,
        `(Input: ${r.consumoLabel})`,
        '',
        '--- RISULTATI IMPIANTO ---',
        `Capacità stimata: ${fmtNum(r.kWp)} kWp`,
        `Produzione annuale: ${fmtNum(r.annualkWh)} kWh/anno`,
        '',
        '--- SCENARIO 1: PROPRIETÀ ---',
        `Investimento (Capex): €${fmtNum(r.p_capex)}`,
        `Ricavi annuali: €${fmtNum(r.p_revenue)}/anno`,
        '',
        '--- SCENARIO 2: RISPARMIO ---',
        `Risparmio annuale azienda: €${fmtNum(r.r_savings)}/anno (sconto ${fmtNum(r.r_discount)}%)`,
        '',
        '--- SCENARIO 3: RENDITA ---',
        `Ricavi annuali royalty: €${fmtNum(r.rend_revenue)}/anno (${fmtNum(r.rend_royalty)}% della produzione)`,
        '',
        nome ? `Nome: ${nome}` : '',
        tel ? `Telefono: ${tel}` : 'Telefono: (non indicato)',
        '',
        'Grazie,',
    ].filter(l => l !== null).join('\n');
}

function openEmailIndipendente() {
    const r = indResults;
    if (!r.kWp) { alert('Esegui prima il calcolo della stima.'); return; }
    const nome = document.getElementById('ind-nome').value.trim();
    const tel = document.getElementById('ind-telefono').value.trim();
    const subject = `Stima Solare - Indipendente - ${r.citta} - ${r.kWp}kWp`;
    window.location.href = `mailto:info@helioh2.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildBodyIndipendente(r, nome, tel))}`;
}

function openWhatsappIndipendente() {
    const r = indResults;
    if (!r.kWp) { alert('Esegui prima il calcolo della stima.'); return; }
    window.open(`https://wa.me/393755853424?text=${encodeURIComponent(buildBodyIndipendente(r, '', ''))}`,`_blank`);
}

function openEmailIntegrata() {
    const r = intResults;
    if (!r.kWp) { alert('Esegui prima il calcolo della stima.'); return; }
    const nome = document.getElementById('int-nome').value.trim();
    const tel = document.getElementById('int-telefono').value.trim();
    const subject = `Stima Solare - Integrata - ${r.citta} - ${r.kWp}kWp`;
    window.location.href = `mailto:info@helioh2.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildBodyIntegrata(r, nome, tel))}`;
}

function openWhatsappIntegrata() {
    const r = intResults;
    if (!r.kWp) { alert('Esegui prima il calcolo della stima.'); return; }
    window.open(`https://wa.me/393755853424?text=${encodeURIComponent(buildBodyIntegrata(r, '', ''))}`,`_blank`);
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
function fmtNum(n) {
    return Math.round(n).toLocaleString('it-IT');
}

function fmtEuro(n) {
    return '\u20AC' + Math.round(n).toLocaleString('it-IT');
}

function showError(el, msg) {
    el.textContent = msg;
    el.hidden = false;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showLoading(prefix, show) {
    document.getElementById(`${prefix}-loading`).hidden = !show;
    document.getElementById(`${prefix}-submit`).disabled = show;
    if (show) {
        document.getElementById(`${prefix}-placeholder`).hidden = true;
    }
}

function hideResults(prefix) {
    document.getElementById(`${prefix}-results`).hidden = true;
    const cards = document.getElementById(`${prefix}-data-cards`);
    if (cards) cards.hidden = true;
}

function renderDataCards(prefix, pun, irrPerKwp, zoneLabel, pvgisFallback, punFallback) {
    const el = document.getElementById(`${prefix}-data-cards`);
    if (!el) return;
    pun = parseFloat(pun);
    irrPerKwp = parseFloat(irrPerKwp);
    document.getElementById(`${prefix}-pun-value`).textContent = (punFallback ? '~' : '') + (isNaN(pun) ? '—' : pun.toFixed(4));
    document.getElementById(`${prefix}-irr-value`).textContent = pvgisFallback
        ? `~${Math.round(irrPerKwp)}`
        : Math.round(irrPerKwp);
    document.getElementById(`${prefix}-zone-value`).textContent = zoneLabel || '—';
    el.hidden = false;
}

function updateRangeCallout(input, labelId, suffix = '') {
    const label = document.getElementById(labelId);
    if (!label) return;
    const min = parseFloat(input.min) || 0;
    const max = parseFloat(input.max) || 100;
    const val = parseFloat(input.value) || 0;
    // Fraction along the track (0→1)
    const pct = (val - min) / (max - min);
    // Thumb is ~18px wide; offset corrects so callout stays above thumb center
    const thumbW = 18;
    const offset = thumbW / 2 - (pct * thumbW);
    label.style.left = `calc(${pct * 100}% + ${offset}px)`;
    label.textContent = val + suffix;
}