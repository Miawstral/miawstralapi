import type { PlaceSelection } from './places';
import { placeLabel, samePlace } from './places';

export interface RecentTrip {
    from: PlaceSelection;
    to: PlaceSelection;
}

const KEY = 'miawstral:recents';
const MAX = 5;

/** Last searches, newest first. Storage may be unavailable (private mode): fail silently. */
export function loadRecents(): RecentTrip[] {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
        return Array.isArray(parsed)
            ? parsed.filter((t): t is RecentTrip => Boolean(t?.from?.kind && t?.to?.kind)).slice(0, MAX)
            : [];
    } catch {
        return [];
    }
}

export function saveRecent(trip: RecentTrip): RecentTrip[] {
    const next = [trip, ...loadRecents().filter(t => !(samePlace(t.from, trip.from) && samePlace(t.to, trip.to)))].slice(0, MAX);
    try {
        localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        // ignore
    }
    return next;
}

export const recentLabel = (trip: RecentTrip) => `${placeLabel(trip.from)} → ${placeLabel(trip.to)}`;
