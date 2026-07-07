'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   HelioH₂ — address-fetch.js
   Nominatim address autocomplete for input fields.

   Usage: call initAddressAutocomplete(fields) with an array of
   { input: 'element-id', results: 'results-container-id' }
   or call it with no arguments to use the default simulatore fields.
   ═══════════════════════════════════════════════════════════════════════════ */

const ADDRESS_TYPE_BADGES = {
    city:    { bg: '#4CAF50', label: 'Città' },
    town:    { bg: '#2196F3', label: 'Town' },
    village: { bg: '#FF9800', label: 'Villaggio' },
    road:    { bg: '#757575', label: 'Strada' },
    default: { bg: '#9E9E9E', label: 'Luogo' },
};

let _currentResults = [];

function _getBestResult(results) {
    return results.find(r => r.addresstype === 'city')
        || results.find(r => r.class === 'boundary' && r.type === 'administrative')
        || results.find(r => r.boundingbox?.length === 4)
        || results[0];
}

function _badge(addresstype) {
    const b = ADDRESS_TYPE_BADGES[addresstype] || ADDRESS_TYPE_BADGES.default;
    return `<span style="background:${b.bg};color:white;padding:2px 6px;border-radius:3px;font-size:11px;margin-left:8px;">${b.label}</span>`;
}

function _displayResults(results, container, input) {
    if (!results.length) { container.innerHTML = ''; return; }

    const best = _getBestResult(results);
    const bestIdx = results.indexOf(best);
    const name = best.name || best.display_name.split(',')[0];

    container.innerHTML = `<div class="autocomplete-item" data-index="${bestIdx}">
        <strong>${name}</strong> ${_badge(best.addresstype)}<br>
        <span style="color:#999;font-size:12px;">${best.display_name}</span>
    </div>`;

    container.querySelector('.autocomplete-item').addEventListener('click', () => {
        const result = _currentResults[bestIdx];
        if (!result) return;
        input.value = result.display_name;
        container.innerHTML = '';
        input.dataset.result = JSON.stringify({
            name:        result.display_name,
            lat:         result.lat,
            lon:         result.lon,
            boundingbox: result.boundingbox,
            addresstype: result.addresstype,
            regione:     result.address?.state || '',
        });
        _currentResults = [];
    });
}

function _debounce(fn, delay) {
    let t;
    return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), delay); };
}

function initAddressAutocomplete(fields) {
    if (!fields) {
        fields = [
            { input: 'ind-citta', results: 'ind-citta-results' },
            { input: 'int-citta', results: 'int-citta-results' },
        ];
    }

    fields.forEach(({ input: inputId, results: resultsId }) => {
        const input = document.getElementById(inputId);
        const container = document.getElementById(resultsId);
        if (!input || !container) return;

        input.addEventListener('input', _debounce(async (e) => {
            const query = e.target.value.trim();
            if (query.length < 4) { container.innerHTML = ''; _currentResults = []; return; }

            try {
                const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=it&format=json&limit=5&addressdetails=1&accept-language=it`;
                const res = await fetch(url, { headers: { 'Accept-Language': 'it' } });
                _currentResults = await res.json();
                _displayResults(_currentResults, container, input);
            } catch (err) {
                console.error('[AddressFetch] Autocomplete error:', err);
                container.innerHTML = '';
            }
        }, 700));
    });
}

document.addEventListener('DOMContentLoaded', () => initAddressAutocomplete());
