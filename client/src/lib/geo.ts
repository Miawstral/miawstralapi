import type { BusStep, RouteOption, RouteStep, WalkStep } from '@/types';

export type LatLngTuple = [number, number];

/** Toulon city centre. */
export const TOULON_CENTER: LatLngTuple = [43.124, 5.928];

const isFiniteLatLng = (p: LatLngTuple) => Number.isFinite(p[0]) && Number.isFinite(p[1]);

function validGeometry(geometry: [number, number][] | undefined): LatLngTuple[] | null {
    if (!geometry || geometry.length < 2) return null;
    const points = geometry.filter(isFiniteLatLng);
    return points.length >= 2 ? points : null;
}

/** Polyline of a bus leg: street geometry when available, otherwise straight lines between served stops. */
export function busLegPositions(step: BusStep): LatLngTuple[] {
    return (
        validGeometry(step.geometry) ??
        [step.from, ...(step.intermediateStops ?? []), step.to]
            .map((s): LatLngTuple => [s.lat, s.lon])
            .filter(isFiniteLatLng)
    );
}

export function walkLegPositions(step: WalkStep): LatLngTuple[] {
    return (
        validGeometry(step.geometry) ??
        ([
            [step.from.lat, step.from.lon],
            [step.to.lat, step.to.lon],
        ] satisfies LatLngTuple[]).filter(isFiniteLatLng)
    );
}

export function legPositions(step: RouteStep): LatLngTuple[] {
    return step.type === 'bus' ? busLegPositions(step) : walkLegPositions(step);
}

/** Every point of a route, for fitting the map view. */
export function routePositions(route: RouteOption): LatLngTuple[] {
    return route.steps.flatMap(legPositions);
}
