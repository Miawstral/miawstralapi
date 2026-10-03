import { describe, expect, it } from 'vitest';
import { buildTripsFromColumns, buildTripsFromRows, mirrorTrip, TimetableRow } from '../src/network/trip-builder';
import { minutes } from './helpers';

const row = (stop: number | null, times: (string | null)[]): TimetableRow => ({
    stop,
    times: times.map(t => (t === null ? null : minutes(t))),
});

describe('buildTripsFromColumns', () => {
    it('reads one trip per column and skips holes', () => {
        const trips = buildTripsFromColumns([
            row(0, ['7:00', '7:30']),
            row(1, ['7:05', null]),
            row(2, ['7:10', '7:40']),
        ]);
        expect(trips).toEqual([
            { stops: [0, 1, 2], times: [420, 425, 430] },
            { stops: [0, 2], times: [450, 460] },
        ]);
    });

    it('unwraps trips running past midnight', () => {
        const [trip] = buildTripsFromColumns([row(0, ['23:55']), row(1, ['0:05'])]);
        expect(trip.times).toEqual([1435, 1445]);
    });

    it('treats early-morning starts as the end of the previous service day', () => {
        const [trip] = buildTripsFromColumns([row(0, ['0:15']), row(1, ['0:20'])]);
        expect(trip.times).toEqual([1455, 1460]);
    });

    it('ignores unusable rows and single-stop columns', () => {
        const trips = buildTripsFromColumns([row(0, ['7:00', '8:00']), row(null, ['7:02', null]), row(1, ['7:05', null])]);
        expect(trips).toEqual([{ stops: [0, 1], times: [420, 425] }]);
    });
});

describe('buildTripsFromRows (legacy grids without holes)', () => {
    it('keeps simple grids aligned', () => {
        const trips = buildTripsFromRows([row(0, ['7:00', '7:30']), row(1, ['7:05', '7:35']), row(2, ['7:10', '7:40'])]);
        expect(trips).toEqual([
            { stops: [0, 1, 2], times: [420, 425, 430] },
            { stops: [0, 1, 2], times: [450, 455, 460] },
        ]);
    });

    it('re-aligns rows where some trips skip the stop', () => {
        // Column 2 (7:30) does not serve stop 1: the legacy file lost the "-".
        const trips = buildTripsFromRows([
            row(0, ['7:00', '7:30', '8:00']),
            row(1, ['7:04', '8:04']),
            row(2, ['7:08', '7:33', '8:08']),
        ]);
        expect(trips).toEqual([
            { stops: [0, 1, 2], times: [420, 424, 428] },
            { stops: [0, 2], times: [450, 453] },
            { stops: [0, 1, 2], times: [480, 484, 488] },
        ]);
    });

    it('handles a branch only served by one trip', () => {
        // Line 103 pattern: a school trip starts on a branch and joins the trunk.
        const trips = buildTripsFromRows([
            row(0, ['7:30']),
            row(1, ['7:33']),
            row(2, ['6:55', '7:36', '8:20']),
            row(3, ['6:56', '7:37', '8:22']),
        ]);
        expect(trips).toEqual([
            { stops: [2, 3], times: [415, 416] },
            { stops: [0, 1, 2, 3], times: [450, 453, 456, 457] },
            { stops: [2, 3], times: [500, 502] },
        ]);
    });

    it('allows long hops such as motorway sections', () => {
        const trips = buildTripsFromRows([row(0, ['7:17', '11:20']), row(1, ['7:38', '11:41'])]);
        expect(trips).toHaveLength(2);
    });

    it('never goes back in time', () => {
        const trips = buildTripsFromRows([row(0, ['7:00']), row(1, ['6:50'])]);
        expect(trips).toEqual([]);
    });
});

describe('mirrorTrip', () => {
    it('reverses stops and running times', () => {
        expect(mirrorTrip({ stops: [0, 1, 2], times: [420, 422, 430] })).toEqual({ stops: [2, 1, 0], times: [420, 428, 430] });
    });
});
