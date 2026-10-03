import type { StopSummary } from '@/types';

/** Lower-case, accent-free, punctuation-free version of a string ("Liberté-Gare" → "liberte gare"). */
export function normalizeText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

export interface IndexedStop {
    stop: StopSummary;
    name: string;
    city: string;
    words: string[];
}

const lineCollator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

/** Natural sort of line identifiers ("2" < "10" < "U"). */
export function sortLines(lines: string[]): string[] {
    return [...lines].sort(lineCollator.compare);
}

const SAME_PLACE_METERS = 200;

function distanceMeters(a: StopSummary, b: StopSummary): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const [lat1, lon1, lat2, lon2] = [a.latitude, a.longitude, b.latitude, b.longitude].map(Number);
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/**
 * Search index of the places. Stop points sharing a name and a city a few
 * meters apart (one per side of the road) are one suggestion: the router
 * treats them as the same place. The suggestion keeps the stop served by the
 * most lines and lists the lines of all of them.
 */
export function indexStops(stops: StopSummary[]): IndexedStop[] {
    const groups = new Map<string, StopSummary[][]>();
    for (const stop of stops) {
        const key = `${normalizeText(stop.name)}|${normalizeText(stop.city ?? '')}`;
        const clusters = groups.get(key) ?? [];
        const cluster = clusters.find(c => distanceMeters(c[0], stop) <= SAME_PLACE_METERS);
        if (cluster) cluster.push(stop);
        else clusters.push([stop]);
        groups.set(key, clusters);
    }

    return [...groups.values()].flat().map(cluster => {
        const main = [...cluster].sort((a, b) => (b.lines?.length ?? 0) - (a.lines?.length ?? 0))[0];
        const lines = sortLines([...new Set(cluster.flatMap(s => s.lines ?? []))]);
        const stop: StopSummary = { ...main, lines, accessible: cluster.some(s => s.accessible) };
        const name = normalizeText(stop.name);
        return { stop, name, city: normalizeText(stop.city ?? ''), words: name.split(' ') };
    });
}

function scoreStop(entry: IndexedStop, query: string, tokens: string[]): number | null {
    if (entry.name === query) return 0;
    if (entry.name.startsWith(query)) return 1;
    if (entry.words.some((word) => word.startsWith(query))) return 2;
    if (entry.name.includes(query)) return 3;
    // Every token must appear in the name or in the city ("seyne centre", "liberte toulon").
    const haystack = `${entry.name} ${entry.city}`;
    if (tokens.every((token) => haystack.includes(token))) return 4;
    return null;
}

/** Accent-insensitive stop search, best matches first. */
export function searchIndexedStops(index: IndexedStop[], rawQuery: string, limit = 8): StopSummary[] {
    const query = normalizeText(rawQuery);
    if (!query) return [];
    const tokens = query.split(' ');

    const matches: { entry: IndexedStop; score: number }[] = [];
    for (const entry of index) {
        const score = scoreStop(entry, query, tokens);
        if (score !== null) matches.push({ entry, score });
    }

    matches.sort(
        (a, b) =>
            a.score - b.score ||
            a.entry.name.length - b.entry.name.length ||
            a.entry.name.localeCompare(b.entry.name, 'fr') ||
            (b.entry.stop.lines?.length ?? 0) - (a.entry.stop.lines?.length ?? 0),
    );
    return matches.slice(0, limit).map((m) => m.entry.stop);
}

/** Stop whose normalized name equals the query, if any (used when the user typed without picking). */
export function findExactStop(index: IndexedStop[], rawQuery: string): StopSummary | null {
    const query = normalizeText(rawQuery);
    if (!query) return null;
    return index.find((entry) => entry.name === query)?.stop ?? null;
}
