import { MINUTES_PER_DAY } from '../lib/time';

/**
 * Turns "stop × time" timetable grids into trips (the ordered stop times of
 * one vehicle run).
 *
 * The Réseau Mistral timetable pages are grids: one row per stop, one column
 * per trip, "-" when a trip skips the stop. Recent scrapes keep those holes as
 * `null` so columns are trips (`buildTripsFromColumns`). Legacy files dropped
 * the holes, so the column a time belongs to has to be recovered
 * (`buildTripsFromRows`).
 */

/** Times before this hour at the start of a trip belong to the previous service day. */
export const SERVICE_DAY_START = 3 * 60;

export interface TimetableRow {
    /** Index of the stop in the network, or null when the row cannot be used. */
    stop: number | null;
    /** Minutes since midnight, `null` for a skipped stop (aligned grids only). */
    times: (number | null)[];
}

export interface TripDraft {
    stops: number[];
    /** Absolute minutes, non-decreasing (may exceed 24:00 after midnight). */
    times: number[];
}

/** Brings `time` to the first value ≥ `reference - 12h` so it follows `reference` across midnight. */
function unwrapAfter(time: number, reference: number): number {
    let t = time;
    while (t < reference - MINUTES_PER_DAY / 2) t += MINUTES_PER_DAY;
    return t;
}

function startOfTrip(time: number): number {
    return time < SERVICE_DAY_START ? time + MINUTES_PER_DAY : time;
}

/** Aligned grid: column `j` of every row is the same trip. */
export function buildTripsFromColumns(rows: TimetableRow[]): TripDraft[] {
    const columns = Math.max(0, ...rows.map(r => r.times.length));
    const trips: TripDraft[] = [];

    for (let col = 0; col < columns; col++) {
        const trip: TripDraft = { stops: [], times: [] };
        for (const row of rows) {
            const time = row.times[col];
            if (row.stop === null || time === null || time === undefined) continue;
            const previous = trip.times[trip.times.length - 1];
            const absolute = previous === undefined ? startOfTrip(time) : unwrapAfter(time, previous);
            if (previous !== undefined && absolute < previous) continue; // inconsistent cell
            trip.stops.push(row.stop);
            trip.times.push(absolute);
        }
        if (trip.stops.length >= 2) trips.push(trip);
    }
    return trips;
}

// ---------------------------------------------------------------------------
// Legacy grids
// ---------------------------------------------------------------------------

/**
 * Cost of starting a new trip instead of continuing an existing one. Equal to
 * the longest hop allowed between consecutive rows, so a plausible hop is
 * always preferred, while a trip that ended many rows ago is not resumed.
 */
const NEW_TRIP_COST = 30;
/** Cost per row a trip skips before being continued. */
const SKIPPED_ROW_COST = 0.5;

/** Longest plausible time between two consecutive served stops of a trip. */
function maxGap(skippedRows: number): number {
    return Math.min(30 + 3 * skippedRows, 60);
}

interface OpenTrip {
    draft: TripDraft;
    lastTime: number;
    lastRow: number;
}

/**
 * Legacy grid: each row only lists the times of the trips serving that stop,
 * still in column order. Trips are rebuilt row by row with an order-preserving
 * alignment (edit-distance style dynamic programming) between the open trips
 * and the times of the row: continuing a trip costs the elapsed minutes,
 * starting a new one costs NEW_TRIP_COST.
 */
export function buildTripsFromRows(rows: TimetableRow[]): TripDraft[] {
    let open: OpenTrip[] = [];

    rows.forEach((row, rowIndex) => {
        const stop = row.stop;
        if (stop === null) return;
        const times = row.times.filter((t): t is number => t !== null);
        const m = times.length;
        const c = open.length;

        // cost[i][j]: best cost after aligning the first i times with the first j trips.
        const cost: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(c + 1).fill(Infinity));
        const move: ('skip' | 'new' | 'match')[][] = Array.from({ length: m + 1 }, () => new Array(c + 1));
        cost[0][0] = 0;

        for (let i = 0; i <= m; i++) {
            for (let j = 0; j <= c; j++) {
                const current = cost[i][j];
                if (current === Infinity) continue;
                if (j < c && current < cost[i][j + 1]) {
                    cost[i][j + 1] = current;
                    move[i][j + 1] = 'skip';
                }
                if (i < m && current + NEW_TRIP_COST < cost[i + 1][j]) {
                    cost[i + 1][j] = current + NEW_TRIP_COST;
                    move[i + 1][j] = 'new';
                }
                if (i < m && j < c) {
                    const trip = open[j];
                    const elapsed = unwrapAfter(times[i], trip.lastTime) - trip.lastTime;
                    const skipped = rowIndex - trip.lastRow - 1;
                    if (elapsed >= 0 && elapsed <= maxGap(skipped)) {
                        const total = current + elapsed + SKIPPED_ROW_COST * skipped;
                        if (total < cost[i + 1][j + 1]) {
                            cost[i + 1][j + 1] = total;
                            move[i + 1][j + 1] = 'match';
                        }
                    }
                }
            }
        }

        // Backtrack to rebuild the ordered list of open trips.
        const next: OpenTrip[] = [];
        let i = m;
        let j = c;
        while (i > 0 || j > 0) {
            const step = move[i][j];
            if (step === 'skip') {
                next.push(open[j - 1]);
                j--;
            } else if (step === 'new') {
                const time = startOfTrip(times[i - 1]);
                next.push({ draft: { stops: [stop], times: [time] }, lastTime: time, lastRow: rowIndex });
                i--;
            } else {
                const trip = open[j - 1];
                const time = unwrapAfter(times[i - 1], trip.lastTime);
                trip.draft.stops.push(stop);
                trip.draft.times.push(time);
                trip.lastTime = time;
                trip.lastRow = rowIndex;
                next.push(trip);
                i--;
                j--;
            }
        }
        open = next.reverse();
    });

    return open.map(t => t.draft).filter(t => t.stops.length >= 2);
}

/**
 * Builds the opposite direction of a line from the scraped one when it is
 * missing: same stops in reverse order, same running times, and the same
 * departure times from the other terminus. This is an estimate.
 */
export function mirrorTrip(trip: TripDraft): TripDraft {
    const n = trip.stops.length;
    const stops = [...trip.stops].reverse();
    const times = [trip.times[0]];
    for (let i = 1; i < n; i++) {
        times.push(times[i - 1] + (trip.times[n - i] - trip.times[n - i - 1]));
    }
    return { stops, times };
}
