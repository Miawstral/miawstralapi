import type { Location, StopSummary } from '@/types';

/** What the user picked for an end of the journey: a stop, or a raw point (map click, geolocation). */
export type PlaceSelection =
    | { kind: 'stop'; stop: StopSummary }
    | { kind: 'point'; lat: number; lon: number; label: string };

/** State of an origin/destination field: the typed text and the resolved selection (if any). */
export interface PlaceField {
    text: string;
    place: PlaceSelection | null;
}

export const EMPTY_FIELD: PlaceField = { text: '', place: null };

export const MAP_POINT_LABEL = 'Point sur la carte';
export const MY_POSITION_LABEL = 'Ma position';

export function stopLatLng(stop: StopSummary): [number, number] | null {
    const lat = Number.parseFloat(stop.latitude);
    const lon = Number.parseFloat(stop.longitude);
    return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
}

export function placeLabel(place: PlaceSelection): string {
    return place.kind === 'stop' ? place.stop.name : place.label;
}

export function placeLatLng(place: PlaceSelection): [number, number] | null {
    return place.kind === 'stop' ? stopLatLng(place.stop) : [place.lat, place.lon];
}

export function fieldFromPlace(place: PlaceSelection): PlaceField {
    return { text: placeLabel(place), place };
}

export function stopPlace(stop: StopSummary): PlaceSelection {
    return { kind: 'stop', stop };
}

export function pointPlace(lat: number, lon: number, label = MAP_POINT_LABEL): PlaceSelection {
    return { kind: 'point', lat, lon, label };
}

/** Body of `from` / `to` for POST /api/routes/calculate. */
export function toLocation(place: PlaceSelection): Location {
    if (place.kind === 'stop') return { stopId: place.stop.stopPointId };
    return { lat: place.lat, lon: place.lon, name: place.label };
}

export function samePlace(a: PlaceSelection | null, b: PlaceSelection | null): boolean {
    if (!a || !b) return false;
    if (a.kind === 'stop' && b.kind === 'stop') return a.stop.stopPointId === b.stop.stopPointId;
    if (a.kind === 'point' && b.kind === 'point') {
        return Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lon - b.lon) < 1e-5;
    }
    return false;
}
