// ── ROOFTOP SOLAR TOOL – Type-specific wrapper ─────────────────────────────
// This file MUST load BEFORE solartools.js
// Sets up window.solarToolsConfig with rooftop-specific values

// ── NORME ─────────────────────────────────────────────────────────────────
const NORME = {
    capannone: {
        icon: '🏭', label: 'Capannone', cer: false,
        items: ['Impianto su tetto capannone industriale/commerciale', 'Nessuna CER richiesta per autoconsumo diretto', 'Incentivi GSE: tariffa incentivante fino a 120 €/MWh', 'Autorizzazione: PAS (Procedura Abilitativa Semplificata)', 'IVA 10%, deducibile come bene strumentale', 'Verifica portata strutturale copertura prima dell\'installazione'], cerNote: null
    },
};

// ── ZONE TYPE ─────────────────────────────────────────────────────────────
const CLRS = { capannone: '#A8FF78' };
const LBLS = { capannone: 'Capannone' };
const MARGINS  = { capannone: 1.0 };
const AREA_DEFAULTS = {
    capannone:    { rowsPerString: 1, stringsPerBlock: 1, stringGap: 0, blockGap: 0 },
};

// ── SHARED STATE ──────────────────────────────────────────────────────────
let areas = [], curType = 'capannone', irr = 1250;
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
    isRoof: true,  // rooftop is a roof installation with roof-type options
};
