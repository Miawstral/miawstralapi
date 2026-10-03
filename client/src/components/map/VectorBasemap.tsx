import { useEffect } from 'react';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useMap } from 'react-leaflet';

// MapLibre computes its worker URL at runtime, which bundlers cannot follow: give it the one built by Vite.
setWorkerUrl(workerUrl);

/** OpenFreeMap: free vector tiles, no API key. Positron is a quiet, monochrome style. */
const STYLES = {
    light: 'https://tiles.openfreemap.org/styles/positron',
    dark: 'https://tiles.openfreemap.org/styles/dark',
};

const ATTRIBUTION =
    '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

/** MapLibre GL basemap rendered under the Leaflet layers. */
export function VectorBasemap({ dark }: { dark: boolean }) {
    const map = useMap();

    useEffect(() => {
        const layer = maplibreGL({ style: dark ? STYLES.dark : STYLES.light, attributionControl: false });
        layer.addTo(map);
        map.attributionControl?.addAttribution(ATTRIBUTION);
        return () => {
            layer.remove();
            map.attributionControl?.removeAttribution(ATTRIBUTION);
        };
    }, [map, dark]);

    return null;
}
