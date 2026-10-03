import { describe, expect, it } from 'vitest';
import { readLineFiles } from '../src/network/network.store';
import { TransitNetwork } from '../src/network/network';
import { parseTime } from '../src/lib/time';

/** Sanity checks on the timetables shipped in data/. */
describe('shipped data', () => {
    const { files, errors } = readLineFiles();
    const network = new TransitNetwork(files, { estimateMissingDirections: false });

    it('loads every file', () => {
        expect(errors).toEqual([]);
        expect(files.length).toBeGreaterThanOrEqual(40);
        expect(network.lines.size).toBe(files.length);
        expect(network.warnings).toEqual([]);
    });

    it('rebuilds trips covering almost every scraped time', () => {
        let scraped = 0;
        for (const file of files) {
            const directions = 'directions' in file ? file.directions : [{ stops: file.stops }];
            for (const dir of directions) {
                for (const stop of dir.stops) scraped += stop.times.filter(t => parseTime(t) !== null).length;
            }
        }
        const used = network.patterns.reduce((sum, p) => sum + p.trips.reduce((s, t) => s + t.stops.length, 0), 0);
        expect(used / scraped).toBeGreaterThan(0.998);
    });

    it('only produces plausible trips', () => {
        for (const pattern of network.patterns) {
            for (const trip of pattern.trips) {
                for (let i = 1; i < trip.times.length; i++) {
                    const hop = trip.times[i] - trip.times[i - 1];
                    expect(hop, `${trip.id} hop ${i}`).toBeGreaterThanOrEqual(0);
                    expect(hop, `${trip.id} hop ${i}`).toBeLessThanOrEqual(60);
                }
            }
        }
    });

    it('finds as many trips as timetable columns', () => {
        for (const line of network.lines.values()) {
            const file = files.find(f => f.bus_id === line.id)!;
            const stops = 'directions' in file ? file.directions[0].stops : file.stops;
            const columns = Math.max(...stops.map(s => s.times.filter(t => parseTime(t) !== null).length));
            const trips = line.directions[0].trips.length;
            // Branches can make a few more trips than the longest row; loops whose rows do not
            // follow every trip (line 68) can merge one.
            expect(trips, `line ${line.id}`).toBeGreaterThanOrEqual(columns - 1);
            expect(trips, `line ${line.id}`).toBeLessThanOrEqual(Math.ceil(columns * 1.3) + 2);
        }
    });
});
