# HelioH₂ SolarTools

Unified platform for photovoltaic system design and analysis with three specialized tools.

## Structure

```
/t/solartools/
├── index.html                    ← Main entry point (tool selector)
├── groundplants/                 ← Ground-mounted systems
│   ├── index.html
│   ├── estimatore.js            (agricultural type)
│   └── estimatore.css
├── rooftop/                      ← Roof-mounted systems (B2B)
│   ├── index.html
│   ├── estimatore.js            (capannone type)
│   └── estimatore.css
└── parking/                      ← Parking canopy systems
    ├── index.html
    ├── estimatore.js            (parcheggio type)
    └── estimatore.css
```

## Tools Overview

### 1. Ground Plants (🌾)
**Path:** `t/solartools/groundplants/index.html`

Ground-mounted photovoltaic systems for:
- **Agricultural land** with agrivoltaic support
- **Industrial zones** with CER (Renewable Energy Community) options
- Direct self-consumption and group consumption models
- CER compliance verification
- PVGIS radiation calculation

**Key Features:**
- Margin-based usable area calculation (5m for agricultural)
- Agricultural layout defaults (2 rows/string, 1 string/block, 5m block gap)
- CER requirement notification
- Agrivoltaic configuration support (≥70% cultivable area)

### 2. Rooftop B2B (🏭)
**Path:** `t/solartools/rooftop/index.html`

Roof-mounted systems for industrial and commercial buildings:
- Flat, curved, and sloped roofs (falda)
- Warehouse/commercial building integration
- MT/BT grid connection
- Optional transformer cabin (ground placement only)

**Key Features:**
- Roof type selector (piano/curvo/falda)
- Falda direction support with ridge-center fill
- Optional MT transformer cabin (not on roof)
- Rooftop-specific layout (1 row/string, 1 string/block)
- Structural load verification requirements

### 3. Parking Solutions (🅿)
**Path:** `t/solartools/parking/index.html`

Solar canopy systems for parking areas:
- Double functionality: energy production + vehicle shading
- D.Lgs. 77/2021 compliance for parking > 150 spaces
- Optimal panel alignment with parking bays (azimuth-following)
- Ground-mounted transformer cabin support

**Key Features:**
- Azimuth-aligned panel rotation (follows parking orientation)
- Ground-based transformer cabin (required for MT)
- Parking-specific layout (2 rows/string, 2 strings/block, 1m string gap, 5m block gap)
- Optional parking lot analysis
- Multi-functionality documentation for permitting

## Shared Components

All tools share:
- Leaflet map interface (satellite/OSM/cadastral views)
- Overpass OSM analysis for automatic zone detection
- Nominatim geocoding for location identification
- PVGIS yield calculation via cloud API
- PUN electricity price integration (day-ahead prices)
- Cost analysis with payback calculation
- PDF export with area-by-area breakdown
- Battery and cabin storage modeling
- Drawing tools: rectangle, polygon, measurement

## Entry Point

Users access the system via:
```
/t/solartools/index.html
```

This provides a visual selector with brief descriptions of each tool and direct navigation buttons.

## File Sizes

- `groundplants/estimatore.js`: ~63KB (agricultural-only logic)
- `rooftop/estimatore.js`: ~70KB (capannone + roof handling)
- `parking/estimatore.js`: ~64KB (parcheggio + azimuth rotation)
- Each folder includes: `estimatore.css` (~26KB), `index.html` (~12KB)

## Key Differences Between Tools

| Feature | Ground Plants | Rooftop B2B | Parking |
|---------|---------------|-------------|---------|
| Primary Type | Agricultural | Capannone | Parcheggio |
| Roof Logic | ✗ | ✓ (falda/curvo) | ✗ |
| Azimuth Rotation | ✗ | ✗ | ✓ |
| CER Support | ✓ | ✗ | ✗ |
| Margin Default | 5m | 1m | 1.5m |
| Cabin Optional | No (required if MT) | Yes | No (required if MT) |
| Layout Rows | 2 | 1 | 2 |
| Layout Blocks | 1 string/block | 1 string/block | 2 strings/block |

## Configuration

To add or modify zone types, edit the NORME constants in each tool's `estimatore.js`:

```javascript
const NORME = {
    [zoneType]: {
        icon: '🏗',
        label: 'Zone Label',
        cer: boolean,
        items: ['regulation 1', 'regulation 2', ...],
        cerNote: 'Optional CER note'
    }
};
```

## Future Enhancements

- Battery integration for all tools
- Time-of-use pricing models
- Financing/leasing calculators
- Integration with energy market APIs
- Mobile app version
- Real-time weather data integration
