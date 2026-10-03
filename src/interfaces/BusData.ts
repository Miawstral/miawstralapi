/**
 * On-disk formats of the timetable files stored in DATA_DIR, and the
 * stop/line shapes returned by the public API.
 */

export type Direction = 'OUTWARD' | 'INWARD';

/** A stop row of a scraped timetable. */
export interface RawStop {
    name: string;
    city: string | null;
    latitude: string | null;
    longitude: string | null;
    stopPointId: string | null;
    accessible: boolean;
    /**
     * Passing times ("H:MM").
     * - v2 files: one entry per trip column, `null` when the trip skips the stop.
     * - v1 (legacy) files: only the served times, column alignment is lost.
     */
    times: (string | null)[];
}

/** Legacy format: one direction per file, times without placeholders. */
export interface RawLineFileV1 {
    version?: 1;
    bus_id: string;
    lineName: string | null;
    direction: string | null;
    lineId: string | null;
    stops: RawStop[];
    notes: string[];
    cachedAt?: string;
}

export interface RawDirection {
    direction: Direction;
    stops: RawStop[];
}

/** Current format: both directions, trip columns preserved. */
export interface RawLineFileV2 {
    version: 2;
    bus_id: string;
    lineName: string | null;
    lineId: string | null;
    notes: string[];
    cachedAt: string;
    /** Day of the scraped timetable (YYYY-MM-DD). */
    serviceDate?: string;
    directions: RawDirection[];
}

export type RawLineFile = RawLineFileV1 | RawLineFileV2;

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

export interface StopSummary {
    stopPointId: string;
    name: string;
    city: string | null;
    latitude: string;
    longitude: string;
    accessible: boolean;
    /** Lines serving this stop (bus_id). */
    lines: string[];
    /** Only set by /api/stops/nearby, in meters. */
    distance?: number;
}

export interface StopDetails extends StopSummary {
    passingLines: {
        bus_id: string;
        lineName: string;
        color: string;
        direction: Direction;
        headsign: string;
        estimated: boolean;
        /** Chronological passing times at this stop. */
        times: string[];
    }[];
}

export interface Departure {
    line: string;
    lineName: string;
    color: string;
    direction: Direction;
    headsign: string;
    time: string;
    estimated: boolean;
}

export interface LineDirectionSummary {
    direction: Direction;
    /** Name of the terminus. */
    headsign: string;
    /** True when no timetable was scraped for this direction and it was mirrored from the other one. */
    estimated: boolean;
    trips: number;
}

export interface LineSummary {
    bus_id: string;
    lineName: string;
    lineId: string | null;
    color: string;
    directions: LineDirectionSummary[];
}

export interface LineStop extends Omit<StopSummary, 'lines' | 'distance'> {
    /** Times at which a trip of this direction serves the stop, chronological. */
    times: string[];
}

export interface LineDetails extends Omit<LineSummary, 'directions'> {
    notes: string[];
    cachedAt: string | null;
    directions: (LineDirectionSummary & { stops: LineStop[] })[];
}
