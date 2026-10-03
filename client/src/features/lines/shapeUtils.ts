import type { LatLngTuple } from 'leaflet';

type ShapeStop = { lat: number; lon: number };

/** Beyond this distance from the official path, a stop is considered not covered by it. */
const OFF_PATH_METERS = 100;

/** Distance in meters from a point to a segment (equirectangular approximation, fine at city scale). */
function distanceToSegment(p: LatLngTuple, a: LatLngTuple, b: LatLngTuple): number {
    const kLat = 111_320;
    const kLon = 111_320 * Math.cos((p[0] * Math.PI) / 180);
    const [px, py] = [p[1] * kLon, p[0] * kLat];
    const [ax, ay] = [a[1] * kLon, a[0] * kLat];
    const [bx, by] = [b[1] * kLon, b[0] * kLat];
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distanceToPath(point: LatLngTuple, path: LatLngTuple[]): number {
    if (path.length === 0) return Infinity;
    if (path.length === 1) return distanceToSegment(point, path[0], path[0]);
    let best = Infinity;
    for (let i = 1; i < path.length; i++) best = Math.min(best, distanceToSegment(point, path[i - 1], path[i]));
    return best;
}

/**
 * Stop-to-stop connectors for the parts of a direction its official path does
 * not cover (the feed sometimes gives the path of a short-turn or of one
 * variant only): the line then still reads as continuous on the map.
 */
export function uncoveredConnectors(path: LatLngTuple[], stops: ShapeStop[]): LatLngTuple[][] {
    const points = stops.map((s): LatLngTuple => [s.lat, s.lon]);
    const off = points.map(point => distanceToPath(point, path) > OFF_PATH_METERS);
    const connectors: LatLngTuple[][] = [];
    let current: LatLngTuple[] | null = null;
    for (let i = 0; i < points.length - 1; i++) {
        if (off[i] || off[i + 1]) {
            if (!current) {
                current = [points[i]];
                connectors.push(current);
            }
            current.push(points[i + 1]);
        } else {
            current = null;
        }
    }
    return connectors;
}
