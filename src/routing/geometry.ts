import { config } from '../config';
import { createLogger } from '../lib/logger';

const log = createLogger('osrm');

export type LatLon = [number, number];
export type OsrmProfile = 'foot' | 'car';

export interface RoadPath {
    geometry: LatLon[];
    /** Meters. */
    distance: number;
}

const CACHE_SIZE = 2000;
const cache = new Map<string, Promise<RoadPath | null>>();
let disabledUntil = 0;

function remember(key: string, value: Promise<RoadPath | null>): void {
    if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
    cache.set(key, value);
}

async function request(profile: OsrmProfile, points: LatLon[]): Promise<RoadPath | null> {
    const coordinates = points.map(([lat, lon]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(';');
    const base = profile === 'foot' ? config.osrm.footUrl : config.osrm.carUrl;
    const url = `${base}/route/v1/${profile === 'foot' ? 'foot' : 'driving'}/${coordinates}?overview=full&geometries=geojson`;
    const response = await fetch(url, { signal: AbortSignal.timeout(config.osrm.timeoutMs) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as {
        code: string;
        routes?: { distance: number; geometry: { coordinates: [number, number][] } }[];
    };
    const route = body.routes?.[0];
    if (body.code !== 'Ok' || !route) return null;
    return {
        geometry: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
        distance: Math.round(route.distance),
    };
}

/**
 * Street-level path through `points` from OSRM, or null when OSRM is disabled,
 * unreachable (it is then skipped for OSRM_COOLDOWN_MS) or finds no route.
 */
export function roadPath(profile: OsrmProfile, points: LatLon[]): Promise<RoadPath | null> {
    const base = profile === 'foot' ? config.osrm.footUrl : config.osrm.carUrl;
    if (!config.osrm.enabled || !base || points.length < 2 || Date.now() < disabledUntil) return Promise.resolve(null);

    const key = `${profile}|${points.map(p => p.join(',')).join(';')}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const pending = request(profile, points).catch((error: Error) => {
        disabledUntil = Date.now() + config.osrm.cooldownMs;
        log.warn(`OSRM unavailable (${error.message}), straight lines used for ${config.osrm.cooldownMs / 1000}s`);
        cache.delete(key);
        return null;
    });
    remember(key, pending);
    return pending;
}

export function resetGeometryCache(): void {
    cache.clear();
    disabledUntil = 0;
}
