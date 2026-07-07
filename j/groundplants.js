// ── GROUNDPLANTS SOLAR TOOL – Type-specific wrapper ─────────────────────────
// This file MUST load BEFORE solartools.js
// Sets up window.solarToolsConfig with groundplants-specific values

// ── NORME ─────────────────────────────────────────────────────────────────
const NORME = {
    agricultural: {
        icon: '🌾', label: 'Agricolo', cer: true,
        items: ['Impianti a terra soggetti a vincoli PRG comunali', 'D.Lgs. 199/2021, art. 6 e 8', 'Agrivoltaico ammesso se ≥ 70% del suolo resta coltivabile', 'Pannelli > 2,1 m consentono coltivazione sottostante', 'Procedura unica MASE + Regione', 'Verifica vincoli paesaggistici e PRG del Comune'],
        cerNote: 'Per impianti a terra in zona agricola è necessario aderire a una CER oppure configurare un impianto agrivoltaico (D.Lgs. 199/2021). Senza CER o agrivoltaico l\'impianto può non essere autorizzabile.'
    },
};

// ── ZONE TYPE ─────────────────────────────────────────────────────────────
const CLRS = { agricultural: '#F5A623' };
const LBLS = { agricultural: 'Agricolo' };
const MARGINS  = { agricultural: 5.0 };
const AREA_DEFAULTS = {
    agricultural: { rowsPerString: 2, stringsPerBlock: 1, stringGap: 0, blockGap: 5 },
};

// ── SHARED STATE ──────────────────────────────────────────────────────────
let areas = [], curType = 'agricultural', irr = 1250;
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
    isRoof: false,  // groundplants is a ground-level installation
};
