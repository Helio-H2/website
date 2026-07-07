/* ═══════════════════════════════════════════════════════════════════════════
   HelioH₂ — ade-fetch.js
   Builds the Leaflet layer group for the Agenzia delle Entrate Catasto WMS.

   Problem: AdE WMS 1.3.0 supports EPSG:4258 (ETRS89) but NOT EPSG:3857.
   Leaflet only swaps bbox axes to lat,lon order when crs === L.CRS.EPSG4326
   (identity check), so a plain object copy breaks the swap → wrong axis order
   → HTTP 500 from the WMS server.

   Fix: subclass L.TileLayer.WMS using L.CRS.EPSG4326 so Leaflet performs the
   correct lat,lon swap, then replace the CRS code in the generated URL string
   before the tile request is sent.

   Call window.createCatastoLayer() after Leaflet has loaded.
   Returns a L.LayerGroup (OSM base + AdE WMS overlay, transparent).
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

window.createCatastoLayer = function () {
    const AdELayer = L.TileLayer.WMS.extend({
        getTileUrl: function (coords) {
            return L.TileLayer.WMS.prototype.getTileUrl.call(this, coords)
                .replace(/crs=EPSG%3A4326/i, 'crs=EPSG%3A4258');
        }
    });

    return L.layerGroup([
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OSM contributors',
            maxNativeZoom: 19, maxZoom: 22
        }),
        new AdELayer(
            'https://wms.cartografia.agenziaentrate.gov.it/inspire/wms/ows01.php?language=ita',
            {
                layers:        'CP.CadastralZoning,CP.CadastralParcel,fabbricati,strade,acque',
                format:        'image/png',
                transparent:   true,
                version:       '1.3.0',
                crs:           L.CRS.EPSG4326,   // triggers correct lat,lon axis swap
                maxNativeZoom: 19, maxZoom: 22,
                attribution:   '© Agenzia delle Entrate CC BY 4.0'
            }
        )
    ]);
};
