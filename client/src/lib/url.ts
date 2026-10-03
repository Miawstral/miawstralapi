import { isValidTime } from './format';
import { pointPlace, stopPlace, type PlaceSelection } from './places';
import type { StopSummary } from '@/types';

/**
 * Every view lives in the URL so that it can be shared and survives a reload:
 *   ?from=SECENN&to=43.1,5.9&t=08:00&d=2026-10-05&arrive=1   itinerary
 *   ?stop=TOLIBI                                          departures
 *   ?line=87                                              line
 *   ?explore=TOLIBI&max=30                                isochrone
 *   ?alerts=1                                             traffic info
 */
export function encodePlace(place: PlaceSelection): string {
    return place.kind === 'stop' ? place.stop.stopPointId : `${place.lat.toFixed(5)},${place.lon.toFixed(5)}`;
}

export function decodePlace(value: string | null, stops: Map<string, StopSummary>): PlaceSelection | null {
    if (!value) return null;
    const point = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(value);
    if (point) return pointPlace(Number(point[1]), Number(point[2]));
    const stop = stops.get(value) ?? stops.get(value.replace(/^MISTRAL:/, ''));
    return stop ? stopPlace(stop) : null;
}

export function readParams(): URLSearchParams {
    return new URLSearchParams(window.location.search);
}

export const validTime = (value: string | null) => (value && isValidTime(value) ? value : null);
export const validDate = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

/** Replaces the query string (no history entry). */
export function writeParams(params: Record<string, string | null | undefined>): void {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    const query = search.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, '', url);
}
