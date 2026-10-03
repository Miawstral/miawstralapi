import { describe, expect, it } from 'vitest';
import { cityOfStop } from '../src/gtfs/cities';
import { parseCsv } from '../src/gtfs/csv';
import { activeServices, parseGtfsTime } from '../src/gtfs/feed';
import { sourceForDate } from '../src/gtfs/source';
import { TransitNetwork } from '../src/network/network';
import { sliceShape } from '../src/network/shapes';
import { delaysAlongTrip } from '../src/realtime/realtime.service';
import { serviceDateNow, serviceTimeToEpoch } from '../src/lib/time';
import { fixtureFeed } from './helpers';

describe('csv', () => {
    it('reads quotes, escaped quotes, CRLF and BOM', () => {
        const rows: Record<string, string>[] = [];
        parseCsv('﻿a,b,c\r\n1,"x, ""y""",\r\n2,z,3\n', r => rows.push(r));
        expect(rows).toEqual([
            { a: '1', b: 'x, "y"', c: '' },
            { a: '2', b: 'z', c: '3' },
        ]);
    });
});

describe('gtfs feed', () => {
    const feed = fixtureFeed();

    it('parses routes, stops, trips and shapes', () => {
        expect(feed.routes.get('M8')).toMatchObject({ shortName: '8M', mode: 'boat', color: '#9aaad7', textColor: '#000000' });
        expect(feed.stops.get('SECHAR')).toMatchObject({ name: 'Charlie', wheelchair: false });
        expect(feed.trips.get('T4')!.departures).toEqual([24 * 3600 + 5 * 60, 24 * 3600 + 9 * 60, 24 * 3600 + 14 * 60]);
        expect(feed.shapes.get('S1')!.points).toHaveLength(5);
        expect(feed.feedInfo).toMatchObject({ version: 'test-1', startDate: '20261001', endDate: '20261130' });
        expect(parseGtfsTime('25:10:30')).toBe(25 * 3600 + 10 * 60 + 30);
    });

    it('applies the calendar and its exceptions', () => {
        expect([...activeServices(feed, '2026-10-05')]).toEqual(['WEEK']); // Monday
        expect([...activeServices(feed, '2026-10-10')]).toEqual(['SAT']); // Saturday
        expect([...activeServices(feed, '2026-11-11')]).toEqual(['SAT']); // holiday: Saturday service
        expect([...activeServices(feed, '2026-12-07')]).toEqual([]); // out of the calendar
    });

    it('builds the network of a day', () => {
        const network = new TransitNetwork(sourceForDate(feed, '2026-10-05'));
        expect([...network.lines.keys()]).toEqual(['1', '8M']);
        expect(network.getLine('1')!.directions.map(d => [d.direction, d.headsign, d.trips.length])).toEqual([
            ['OUTWARD', 'Charlie', 3],
            ['INWARD', 'Alpha', 1],
        ]);
        expect(network.getStop('TOALPH')!.city).toBe('Toulon');
        expect(network.trips.get('T4')!.times[0]).toBe(24 * 60 + 5);

        const saturday = new TransitNetwork(sourceForDate(feed, '2026-10-10'));
        expect([...saturday.trips.keys()]).toEqual(['T5']);
    });

    it('derives the city from the stop id', () => {
        expect(cityOfStop('SECENN')).toBe('La Seyne-sur-Mer');
        expect(cityOfStop('XX1234')).toBeNull();
    });
});

describe('shapes', () => {
    it('slices a shape between two distances', () => {
        const shape = fixtureFeed().shapes.get('S1')!;
        const points = sliceShape(shape, 0.2, 1.0);
        expect(points[0][1]).toBeCloseTo(5.9025, 4);
        expect(points[points.length - 1][1]).toBeCloseTo(5.9125, 4);
        expect(points).toHaveLength(4); // start, 2 shape points, end
        expect(sliceShape(shape, 1, 1)).toEqual([]);
    });
});

describe('real-time', () => {
    it('propagates delays along the trip', () => {
        const update = {
            tripId: 't',
            cancelled: false,
            timestamp: null,
            updates: [
                { stopId: 'B', stopSequence: null, arrivalDelay: 60, departureDelay: 90, arrivalTime: null, departureTime: null, skipped: false },
                { stopId: 'D', stopSequence: null, arrivalDelay: null, departureDelay: null, arrivalTime: null, departureTime: null, skipped: true },
            ],
        };
        expect(delaysAlongTrip(update, ['A', 'B', 'C', 'D', 'E'])).toEqual([
            { delay: null, skipped: false },
            { delay: 90, skipped: false },
            { delay: 90, skipped: false },
            { delay: 90, skipped: true },
            { delay: 90, skipped: false },
        ]);
    });
});

describe('service time', () => {
    it('ends the service day at 3:00', () => {
        expect(serviceDateNow('Europe/Paris', new Date('2026-10-03T14:30:00Z'))).toEqual({ date: '2026-10-03', minutes: 16 * 60 + 30 });
        // 00:30 in Paris on the 4th belongs to the service of the 3rd (24:30).
        expect(serviceDateNow('Europe/Paris', new Date('2026-10-03T22:30:00Z'))).toEqual({ date: '2026-10-03', minutes: 24 * 60 + 30 });
    });

    it('converts service times to Unix time', () => {
        expect(serviceTimeToEpoch('2026-10-03', 8 * 3600, 'Europe/Paris')).toBe(Date.parse('2026-10-03T06:00:00Z') / 1000);
        expect(serviceTimeToEpoch('2026-12-03', 8 * 3600, 'Europe/Paris')).toBe(Date.parse('2026-12-03T07:00:00Z') / 1000);
    });
});
