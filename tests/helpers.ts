import fs from 'fs';
import path from 'path';
import { parseGtfsFiles, type GtfsFeed } from '../src/gtfs/feed';
import { parseCsv } from '../src/gtfs/csv';
import type { Direction } from '../src/interfaces/BusData';
import { TransitNetwork, type SourceLine, type SourceStop, type SourceTrip } from '../src/network/network';

export const minutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

/** Stop on a ~1 km grid around Toulon: x/y in kilometers. */
export function stop(id: string, x: number, y: number, accessible = true): SourceStop {
    return { id, name: id, city: 'Toulon', lat: 43.1 + y / 111, lon: 5.9 + x / 81, accessible };
}

export function trip(id: string, stops: string[], times: string[], direction: Direction = 'OUTWARD'): SourceTrip {
    return { id, direction, headsign: stops[stops.length - 1], stops, times: times.map(minutes), shapeId: null, distances: null };
}

export function line(id: string, trips: SourceTrip[]): SourceLine {
    return { id, routeId: `R${id}`, name: `Line ${id}`, color: '#336699', textColor: '#ffffff', mode: 'bus', sortOrder: 0, trips };
}

export function network(stops: SourceStop[], lines: SourceLine[]): TransitNetwork {
    return new TransitNetwork({ serviceDate: '2026-10-05', stops, lines, shapes: new Map(), feedVersion: null });
}

/** The small GTFS of tests/fixtures/gtfs. */
export function fixtureFeed(): GtfsFeed {
    const dir = path.join(__dirname, 'fixtures', 'gtfs');
    return parseGtfsFiles((name, onRow) => {
        const file = path.join(dir, name);
        if (fs.existsSync(file)) parseCsv(fs.readFileSync(file, 'utf-8'), onRow);
    });
}
