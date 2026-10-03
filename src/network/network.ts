import type { Direction } from '../interfaces/BusData';
import { estimateWalk, haversine } from '../lib/geo';
import { normalizeText } from '../lib/text';
import { MINUTES_PER_DAY } from '../lib/time';
import type { TransitMode } from '../gtfs/feed';
import { compareLineIds } from './line-colors';

/**
 * In-memory model of the network for one service day: stops, lines, trips,
 * RAPTOR patterns and walking transfers. Built from a `NetworkSource` (see
 * gtfs/source.ts) and immutable afterwards.
 */

export interface SourceStop {
    id: string;
    name: string;
    city: string | null;
    lat: number;
    lon: number;
    accessible: boolean;
}

export interface SourceTrip {
    id: string;
    direction: Direction;
    headsign: string;
    stops: string[];
    /** Minutes after midnight of the service day, non-decreasing. */
    times: number[];
    shapeId: string | null;
    /** Distance along the shape of each stop, when known. */
    distances: number[] | null;
}

export interface SourceLine {
    id: string;
    routeId: string;
    name: string;
    color: string;
    textColor: string;
    mode: TransitMode;
    sortOrder: number;
    trips: SourceTrip[];
}

export interface Shape {
    points: [number, number][];
    distances: number[];
}

export interface NetworkSource {
    /** YYYY-MM-DD. */
    serviceDate: string;
    stops: SourceStop[];
    lines: SourceLine[];
    shapes: Map<string, Shape>;
    feedVersion: string | null;
}

export interface NetworkStop extends SourceStop {
    index: number;
    /** Lines serving the stop, sorted. */
    lines: string[];
    /** Normalized name for search. */
    searchKey: string;
}

export interface Trip {
    id: string;
    line: string;
    direction: Direction;
    headsign: string;
    stops: number[];
    times: number[];
    shapeId: string | null;
    distances: number[] | null;
}

/** Trips of a line sharing the exact same stop sequence (a RAPTOR "route"). */
export interface Pattern {
    index: number;
    line: string;
    direction: Direction;
    stops: number[];
    /** Sorted by departure from the first stop. */
    trips: Trip[];
    /** True when no trip overtakes another one: allows binary search. */
    fifo: boolean;
}

export interface Footpath {
    to: number;
    /** Minutes. */
    duration: number;
    /** Meters. */
    distance: number;
}

export interface LineDirection {
    direction: Direction;
    headsign: string;
    /** Stops of the longest pattern of this direction. */
    stops: number[];
    trips: Trip[];
}

export interface NetworkLine {
    id: string;
    routeId: string;
    name: string;
    color: string;
    textColor: string;
    mode: TransitMode;
    sortOrder: number;
    directions: LineDirection[];
}

export interface NetworkOptions {
    /** Max straight-line distance between two stops for a walking transfer, in meters. */
    maxTransferDistance?: number;
}

export interface DepartureAtStop {
    trip: Trip;
    position: number;
    /** Minutes, relative to the service day (may exceed 24:00). */
    time: number;
}

function mostFrequent(values: string[]): string {
    const counts = new Map<string, number>();
    let best = '';
    for (const value of values) {
        const count = (counts.get(value) ?? 0) + 1;
        counts.set(value, count);
        if (count > (counts.get(best) ?? 0)) best = value;
    }
    return best;
}

export class TransitNetwork {
    readonly serviceDate: string;
    readonly feedVersion: string | null;
    readonly stops: NetworkStop[] = [];
    readonly lines = new Map<string, NetworkLine>();
    readonly patterns: Pattern[] = [];
    /** For each stop, the patterns serving it and the stop position in the pattern. */
    readonly stopPatterns: { pattern: number; position: number }[][] = [];
    readonly footpaths: Footpath[][] = [];
    readonly trips = new Map<string, Trip>();
    readonly shapes: Map<string, Shape>;
    readonly loadedAt = new Date();

    private readonly stopIndex = new Map<string, number>();
    private readonly lineByRoute = new Map<string, NetworkLine>();

    constructor(source: NetworkSource, options: NetworkOptions = {}) {
        this.serviceDate = source.serviceDate;
        this.feedVersion = source.feedVersion;
        this.shapes = source.shapes;

        for (const stop of source.stops) {
            this.stopIndex.set(stop.id, this.stops.length);
            this.stops.push({ ...stop, index: this.stops.length, lines: [], searchKey: normalizeText(stop.name) });
            this.footpaths.push([]);
            this.stopPatterns.push([]);
        }

        const linesByStop = this.stops.map(() => new Set<string>());
        const sorted = [...source.lines].sort((a, b) => a.sortOrder - b.sortOrder || compareLineIds(a.id, b.id));
        for (const sourceLine of sorted) {
            const trips: Trip[] = [];
            for (const t of sourceLine.trips) {
                const stops = t.stops.map(id => this.stopIndex.get(id));
                if (stops.some(s => s === undefined)) continue;
                const trip: Trip = { ...t, line: sourceLine.id, stops: stops as number[] };
                trips.push(trip);
                this.trips.set(trip.id, trip);
                trip.stops.forEach(s => linesByStop[s].add(sourceLine.id));
            }
            if (trips.length === 0) continue;

            const directions = (['OUTWARD', 'INWARD'] as Direction[]).flatMap((direction): LineDirection[] => {
                const own = trips.filter(t => t.direction === direction);
                if (own.length === 0) return [];
                const longest = own.reduce((a, b) => (b.stops.length > a.stops.length ? b : a));
                return [{ direction, headsign: mostFrequent(own.map(t => t.headsign)), stops: longest.stops, trips: own }];
            });
            const { trips: _, ...rest } = sourceLine;
            const line: NetworkLine = { ...rest, directions };
            this.lines.set(line.id, line);
            this.lineByRoute.set(line.routeId, line);
        }

        this.stops.forEach((stop, i) => {
            stop.lines = [...linesByStop[i]].sort(compareLineIds);
        });
        this.buildPatterns();
        this.buildFootpaths(options.maxTransferDistance ?? 300);
    }

    get tripCount(): number {
        return this.trips.size;
    }

    getStop(id: string): NetworkStop | undefined {
        // Ids of the 1.x API were prefixed ("MISTRAL:SECENN").
        const index = this.stopIndex.get(id) ?? this.stopIndex.get(id.replace(/^MISTRAL:/, ''));
        return index === undefined ? undefined : this.stops[index];
    }

    getLine(id: string): NetworkLine | undefined {
        return this.lines.get(id) ?? this.lines.get(id.toUpperCase()) ?? this.lineByRoute.get(id);
    }

    lineOfRoute(routeId: string): NetworkLine | undefined {
        return this.lineByRoute.get(routeId);
    }

    /** Accent-insensitive search on stop names; prefix matches first. */
    searchStops(query: string, limit = 20): NetworkStop[] {
        const q = normalizeText(query);
        if (!q) return [];
        const scored: { stop: NetworkStop; score: number }[] = [];
        for (const stop of this.stops) {
            const key = stop.searchKey;
            let score: number;
            if (key === q) score = 0;
            else if (key.startsWith(q)) score = 1;
            else if (key.includes(` ${q}`)) score = 2;
            else if (key.includes(q)) score = 3;
            else if (stop.id.toLowerCase().includes(q)) score = 4;
            else continue;
            scored.push({ stop, score });
        }
        scored.sort((a, b) => a.score - b.score || a.stop.name.localeCompare(b.stop.name, 'fr'));
        return scored.slice(0, limit).map(s => s.stop);
    }

    /** Stops within `radius` meters (straight line), nearest first. */
    nearbyStops(lat: number, lon: number, radius: number): { stop: NetworkStop; distance: number }[] {
        const result: { stop: NetworkStop; distance: number }[] = [];
        for (const stop of this.stops) {
            const distance = haversine(lat, lon, stop.lat, stop.lon);
            if (distance <= radius) result.push({ stop, distance });
        }
        return result.sort((a, b) => a.distance - b.distance);
    }

    /**
     * The stop and the other stop points of the same place: same name and city,
     * a few dozen meters apart (typically both sides of a street).
     */
    stopArea(stop: NetworkStop, maxDistance = 150): NetworkStop[] {
        return this.stops.filter(
            s =>
                s === stop ||
                (s.searchKey === stop.searchKey && s.city === stop.city && haversine(s.lat, s.lon, stop.lat, stop.lon) <= maxDistance),
        );
    }

    /** Departures from a stop after `after` (minutes), the terminus excluded. */
    departures(stopIndex: number, after: number, limit = 10): DepartureAtStop[] {
        const result: DepartureAtStop[] = [];
        for (const { pattern, position } of this.stopPatterns[stopIndex] ?? []) {
            const p = this.patterns[pattern];
            if (position === p.stops.length - 1) continue;
            for (const trip of p.trips) {
                for (const shift of [0, -MINUTES_PER_DAY]) {
                    const time = trip.times[position] + shift;
                    if (time >= after) result.push({ trip, position, time });
                }
            }
        }
        result.sort((a, b) => a.time - b.time || compareLineIds(a.trip.line, b.trip.line));
        return result.slice(0, limit);
    }

    // -----------------------------------------------------------------------

    private buildPatterns(): void {
        const byKey = new Map<string, Pattern>();
        for (const line of this.lines.values()) {
            for (const dir of line.directions) {
                for (const trip of dir.trips) {
                    const key = `${line.id}|${dir.direction}|${trip.stops.join(',')}`;
                    let pattern = byKey.get(key);
                    if (!pattern) {
                        pattern = { index: this.patterns.length, line: line.id, direction: dir.direction, stops: trip.stops, trips: [], fifo: true };
                        byKey.set(key, pattern);
                        this.patterns.push(pattern);
                    }
                    pattern.trips.push(trip);
                }
            }
        }
        for (const pattern of this.patterns) {
            pattern.trips.sort((a, b) => a.times[0] - b.times[0]);
            pattern.fifo = pattern.trips.every((trip, i) => i === 0 || trip.times.every((t, pos) => t >= pattern.trips[i - 1].times[pos]));
            pattern.stops.forEach((stop, position) => this.stopPatterns[stop].push({ pattern: pattern.index, position }));
        }
    }

    private buildFootpaths(max: number): void {
        // Only stops actually served get transfers; a latitude-sorted sweep keeps it fast.
        const served = this.stops.filter(s => s.lines.length > 0).sort((a, b) => a.lat - b.lat);
        const maxDeg = max / 111_000;
        for (let i = 0; i < served.length; i++) {
            const a = served[i];
            const maxLonDeg = maxDeg / Math.cos((a.lat * Math.PI) / 180);
            for (let j = i + 1; j < served.length && served[j].lat - a.lat <= maxDeg; j++) {
                const b = served[j];
                if (Math.abs(a.lon - b.lon) > maxLonDeg || haversine(a.lat, a.lon, b.lat, b.lon) > max) continue;
                const { distance, duration } = estimateWalk(a.lat, a.lon, b.lat, b.lon);
                this.footpaths[a.index].push({ to: b.index, duration, distance });
                this.footpaths[b.index].push({ to: a.index, duration, distance });
            }
        }
    }
}
