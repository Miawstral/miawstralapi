import type { Shape } from './network';

type LatLon = [number, number];

/** Index of the last shape point whose distance is ≤ `d`. */
function pointAt(distances: number[], d: number): number {
    let lo = 0;
    let hi = distances.length - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (distances[mid] <= d) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}

function interpolate(shape: Shape, d: number): LatLon {
    const i = pointAt(shape.distances, d);
    const j = Math.min(i + 1, shape.points.length - 1);
    const span = shape.distances[j] - shape.distances[i];
    const t = span > 0 ? Math.min(1, Math.max(0, (d - shape.distances[i]) / span)) : 0;
    const [a, b] = [shape.points[i], shape.points[j]];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Part of a shape between two distances along it (shape_dist_traveled). */
export function sliceShape(shape: Shape, from: number, to: number): LatLon[] {
    if (shape.points.length < 2 || !(to > from)) return [];
    const start = pointAt(shape.distances, from);
    const end = pointAt(shape.distances, to);
    const points: LatLon[] = [interpolate(shape, from)];
    for (let i = start + 1; i <= end; i++) points.push(shape.points[i]);
    points.push(interpolate(shape, to));
    return points;
}
