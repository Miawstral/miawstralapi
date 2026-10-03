import { isValidTime } from './format';
import { pointPlace, stopPlace, type PlaceSelection } from './places';
import type { StopSummary } from '@/types';

/**
 * The search lives in the URL (?from=MISTRAL:SECENN&to=43.1,5.9&t=08:00) so
 * that itineraries can be shared and survive a reload.
 */
function encodePlace(place: PlaceSelection): string {
    return place.kind === 'stop' ? place.stop.stopPointId : `${place.lat.toFixed(5)},${place.lon.toFixed(5)}`;
}

function decodePlace(value: string | null, stops: Map<string, StopSummary>): PlaceSelection | null {
    if (!value) return null;
    const point = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(value);
    if (point) return pointPlace(Number(point[1]), Number(point[2]));
    const stop = stops.get(value);
    return stop ? stopPlace(stop) : null;
}

export interface UrlSearch {
    from: PlaceSelection | null;
    to: PlaceSelection | null;
    time: string | null;
}

export function readUrlSearch(stops: StopSummary[]): UrlSearch {
    const params = new URLSearchParams(window.location.search);
    const byId = new Map(stops.map(s => [s.stopPointId, s]));
    const time = params.get('t');
    return {
        from: decodePlace(params.get('from'), byId),
        to: decodePlace(params.get('to'), byId),
        time: time && isValidTime(time) ? time : null,
    };
}

export function writeUrlSearch(from: PlaceSelection, to: PlaceSelection, time: string | null): void {
    const params = new URLSearchParams({ from: encodePlace(from), to: encodePlace(to) });
    if (time) params.set('t', time);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
}
