import type { Direction, RawLineFile, RawStop } from '../interfaces/BusData';
import { estimateWalk, haversine } from '../lib/geo';
import { normalizeText } from '../lib/text';
import { MINUTES_PER_DAY, parseTime } from '../lib/time';
import { compareLineIds, getLineColor } from './line-colors';
import { buildTripsFromColumns, buildTripsFromRows, mirrorTrip, TimetableRow, TripDraft } from './trip-builder';

export interface NetworkStop {
    index: number;
    id: string;
    name: string;
    city: string | null;
    lat: number;
    lon: number;
    accessible: boolean;
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
    estimated: boolean;
    stops: number[];
    /** Absolute minutes since midnight of the service day, non-decreasing. */
    times: number[];
}

/** Trips of a line sharing the exact same stop sequence (a RAPTOR "route"). */
export interface Pattern {
    index: number;
    line: string;
    direction: Direction;
    estimated: boolean;
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
    estimated: boolean;
    /** Ordered stops of the timetable (stop indices). */
    stops: number[];
    trips: Trip[];
}

export interface NetworkLine {
    id: string;
    name: string;
    lineId: string | null;
    color: string;
    notes: string[];
    cachedAt: string | null;
    /** Scraped in the legacy format (trips rebuilt by alignment, one direction). */
    legacy: boolean;
    directions: LineDirection[];
}

export interface NetworkOptions {
    /** Mirror the scraped direction of a line when the other one is missing. */
    estimateMissingDirections?: boolean;
    /** Max straight-line distance between two stops for a walking transfer, in meters. */
    maxTransferDistance?: number;
}

export interface DepartureAtStop {
    trip: Trip;
    /** Minutes, may be negative or exceed 24:00 relative to the query day. */
    time: number;
}

const OPPOSITE: Record<Direction, Direction> = { OUTWARD: 'INWARD', INWARD: 'OUTWARD' };

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

function normalizeDirection(value: string | null | undefined): Direction {
    return value?.toUpperCase() === 'INWARD' ? 'INWARD' : 'OUTWARD';
}

/**
 * In-memory model of the network built from the timetable files: stops,
 * lines, trips, RAPTOR patterns and walking transfers. Immutable once built.
 */
export class TransitNetwork {
    readonly stops: NetworkStop[] = [];
    readonly lines = new Map<string, NetworkLine>();
    readonly patterns: Pattern[] = [];
    /** For each stop, the patterns serving it and the stop position in the pattern. */
    readonly stopPatterns: { pattern: number; position: number }[][] = [];
    readonly footpaths: Footpath[][] = [];
    readonly warnings: string[] = [];
    readonly loadedAt = new Date();

    private readonly stopIndex = new Map<string, number>();
    private readonly linesByStop: Set<string>[] = [];
    private readonly options: Required<NetworkOptions>;

    constructor(files: RawLineFile[], options: NetworkOptions = {}) {
        this.options = {
            estimateMissingDirections: options.estimateMissingDirections ?? true,
            maxTransferDistance: options.maxTransferDistance ?? 300,
        };

        const sorted = [...files].sort((a, b) => compareLineIds(a.bus_id, b.bus_id));
        for (const file of sorted) this.addLine(file);

        this.stops.forEach((stop, i) => {
            stop.lines = [...this.linesByStop[i]].sort(compareLineIds);
        });
        this.buildPatterns();
        this.buildFootpaths();
    }

    get tripCount(): number {
        return this.patterns.reduce((sum, p) => sum + p.trips.length, 0);
    }

    getStop(id: string): NetworkStop | undefined {
        const index = this.stopIndex.get(id);
        return index === undefined ? undefined : this.stops[index];
    }

    getLine(id: string): NetworkLine | undefined {
        return this.lines.get(id) ?? this.lines.get(id.toUpperCase());
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

    /**
     * The stop and the other stop points of the same place: same name and city,
     * a few dozen meters apart (typically both sides of a street).
     */
    stopArea(stop: NetworkStop, maxDistance = 150): NetworkStop[] {
        return this.stops.filter(
            s =>
                s === stop ||
                (s.searchKey === stop.searchKey &&
                    s.city === stop.city &&
                    haversine(s.lat, s.lon, stop.lat, stop.lon) <= maxDistance),
        );
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
     * Next departures from a stop after `after` (minutes). Trips running after
     * midnight are also matched at their time of day.
     */
    departures(stopIndex: number, after: number, limit = 10): DepartureAtStop[] {
        const result: DepartureAtStop[] = [];
        for (const { pattern, position } of this.stopPatterns[stopIndex] ?? []) {
            const p = this.patterns[pattern];
            if (position === p.stops.length - 1) continue; // terminus: nobody boards there
            for (const trip of p.trips) {
                for (const shift of [0, -MINUTES_PER_DAY]) {
                    const time = trip.times[position] + shift;
                    if (time >= after) result.push({ trip, time });
                }
            }
        }
        result.sort((a, b) => a.time - b.time || compareLineIds(a.trip.line, b.trip.line));
        return result.slice(0, limit);
    }

    // -----------------------------------------------------------------------
    // Construction
    // -----------------------------------------------------------------------

    private addStop(raw: RawStop, line: string): number | null {
        const id = raw.stopPointId;
        const lat = Number.parseFloat(raw.latitude ?? '');
        const lon = Number.parseFloat(raw.longitude ?? '');
        if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;

        let index = this.stopIndex.get(id);
        if (index === undefined) {
            index = this.stops.length;
            this.stops.push({
                index,
                id,
                name: raw.name,
                city: raw.city,
                lat,
                lon,
                accessible: raw.accessible,
                lines: [],
                searchKey: normalizeText(raw.name),
            });
            this.stopIndex.set(id, index);
            this.linesByStop.push(new Set());
            this.footpaths.push([]);
            this.stopPatterns.push([]);
        }
        this.linesByStop[index].add(line);
        return index;
    }

    private addLine(file: RawLineFile): void {
        const id = String(file.bus_id);
        const isAligned = 'version' in file && file.version === 2;
        const rawDirections = 'directions' in file
            ? file.directions
            : [{ direction: normalizeDirection(file.direction), stops: file.stops }];

        const line: NetworkLine = {
            id,
            name: file.lineName ?? `Ligne ${id}`,
            lineId: file.lineId,
            color: getLineColor(id),
            notes: file.notes ?? [],
            cachedAt: file.cachedAt ?? null,
            legacy: !isAligned,
            directions: [],
        };

        for (const raw of rawDirections) {
            const rows: TimetableRow[] = raw.stops.map(stop => ({
                stop: this.addStop(stop, id),
                times: stop.times.map(t => parseTime(t)),
            }));
            const skipped = raw.stops.length - rows.filter(r => r.stop !== null).length;
            if (skipped > 0) this.warnings.push(`Line ${id} ${raw.direction}: ${skipped} stop(s) without id or coordinates ignored`);

            const drafts = isAligned ? buildTripsFromColumns(rows) : buildTripsFromRows(rows);
            if (drafts.length === 0) {
                this.warnings.push(`Line ${id} ${raw.direction}: no usable trip`);
                continue;
            }
            const stops = rows.map(r => r.stop).filter((s): s is number => s !== null);
            line.directions.push(this.makeDirection(id, raw.direction, false, stops, drafts));
        }

        // Legacy files only hold one direction. In current files a single direction is a loop line.
        if (this.options.estimateMissingDirections && !isAligned && line.directions.length === 1) {
            const scraped = line.directions[0];
            const drafts = scraped.trips.map(t => mirrorTrip({ stops: t.stops, times: t.times }));
            line.directions.push(
                this.makeDirection(id, OPPOSITE[scraped.direction], true, [...scraped.stops].reverse(), drafts),
            );
        }

        if (line.directions.length > 0) this.lines.set(id, line);
        else this.warnings.push(`Line ${id}: ignored, no usable timetable`);
    }

    private makeDirection(
        line: string,
        direction: Direction,
        estimated: boolean,
        stops: number[],
        drafts: TripDraft[],
    ): LineDirection {
        const prefix = `${line}:${direction[0]}`;
        const trips = drafts
            .sort((a, b) => a.times[0] - b.times[0])
            .map((draft, i): Trip => ({
                id: `${prefix}:${i}`,
                line,
                direction,
                headsign: this.stops[draft.stops[draft.stops.length - 1]].name,
                estimated,
                stops: draft.stops,
                times: draft.times,
            }));
        return { direction, headsign: mostFrequent(trips.map(t => t.headsign)), estimated, stops, trips };
    }

    private buildPatterns(): void {
        const byKey = new Map<string, Pattern>();
        for (const line of this.lines.values()) {
            for (const dir of line.directions) {
                for (const trip of dir.trips) {
                    const key = `${line.id}|${dir.direction}|${trip.stops.join(',')}`;
                    let pattern = byKey.get(key);
                    if (!pattern) {
                        pattern = {
                            index: this.patterns.length,
                            line: line.id,
                            direction: dir.direction,
                            estimated: dir.estimated,
                            stops: trip.stops,
                            trips: [],
                            fifo: true,
                        };
                        byKey.set(key, pattern);
                        this.patterns.push(pattern);
                    }
                    pattern.trips.push(trip);
                }
            }
        }

        for (const pattern of this.patterns) {
            pattern.trips.sort((a, b) => a.times[0] - b.times[0]);
            pattern.fifo = pattern.trips.every((trip, i) =>
                i === 0 || trip.times.every((t, pos) => t >= pattern.trips[i - 1].times[pos]),
            );
            pattern.stops.forEach((stop, position) => {
                this.stopPatterns[stop].push({ pattern: pattern.index, position });
            });
        }
    }

    private buildFootpaths(): void {
        const max = this.options.maxTransferDistance;
        // Cheap bounding box filter before the haversine: 1° of latitude ≈ 111 km.
        const maxDeg = max / 111_000;
        for (let i = 0; i < this.stops.length; i++) {
            const a = this.stops[i];
            const maxLonDeg = maxDeg / Math.cos((a.lat * Math.PI) / 180);
            for (let j = i + 1; j < this.stops.length; j++) {
                const b = this.stops[j];
                if (Math.abs(a.lat - b.lat) > maxDeg || Math.abs(a.lon - b.lon) > maxLonDeg) continue;
                if (haversine(a.lat, a.lon, b.lat, b.lon) > max) continue;
                const { distance, duration } = estimateWalk(a.lat, a.lon, b.lat, b.lon);
                this.footpaths[i].push({ to: j, duration, distance });
                this.footpaths[j].push({ to: i, duration, distance });
            }
        }
    }
}
