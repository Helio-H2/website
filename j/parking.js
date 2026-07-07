// ── PARKING SOLAR TOOL – Type-specific wrapper ─────────────────────────────
// This file MUST load BEFORE solartools.js
// Sets up window.solarToolsConfig with parking-specific values

// ── NORME ─────────────────────────────────────────────────────────────────
const NORME = {
    parcheggio: {
        icon: '🅿', label: 'Parcheggio', cer: false,
        items: ['Pensilina fotovoltaica su parcheggio scoperto', 'D.Lgs. 199/2021 — impianti su aree di sosta', 'Obbligo di pensilina fotovoltaica per parcheggi > 150 posti (D.L. 77/2021)', 'Autorizzazione: PAS o procedura unica a seconda della potenza', 'Doppia funzione: produzione energia + copertura veicoli', 'IVA 10%, deducibile'], cerNote: null
    },
};

// ── ZONE TYPE ─────────────────────────────────────────────────────────────
const CLRS = { parcheggio: '#C39BD3' };
const LBLS = { parcheggio: 'Parcheggio' };
const MARGINS  = { parcheggio: 1.5 };
const AREA_DEFAULTS = {
    parcheggio:   { rowsPerString: 2, stringsPerBlock: 2, stringGap: 1, blockGap: 5 },
};

// ── SHARED STATE ──────────────────────────────────────────────────────────
let areas = [], curType = 'parcheggio', irr = 1250;
let panelAreaIdx = 0, pOpen = false;

// ── SETUP CONFIG OBJECT ────────────────────────────────────────────────────
// This is read by solartools.js to fetch type-specific values
window.solarToolsConfig = {
    NORME,
    curType,
    CLRS,
    LBLS,
    MARGINS,
    AREA_DEFAULTS,
    isRoof: false,  // parking is ground-level pensilina
};
