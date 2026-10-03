import type { RawLineFileV2, RawStop } from '../src/interfaces/BusData';
import { TransitNetwork } from '../src/network/network';

/** Stop on a ~1 km grid around Toulon: x/y in kilometers. */
export function stop(id: string, x: number, y: number, times: (string | null)[]): RawStop {
    return {
        name: id,
        city: 'Toulon',
        latitude: String(43.1 + y / 111),
        longitude: String(5.9 + x / 81),
        stopPointId: id,
        accessible: true,
        times,
    };
}

export function line(busId: string, stops: RawStop[], inward?: RawStop[]): RawLineFileV2 {
    return {
        version: 2,
        bus_id: busId,
        lineName: `Line ${busId}`,
        lineId: `TEST:${busId}`,
        notes: [],
        cachedAt: '2026-01-01T00:00:00.000Z',
        directions: [
            { direction: 'OUTWARD', stops },
            ...(inward ? [{ direction: 'INWARD' as const, stops: inward }] : []),
        ],
    };
}

export function network(lines: RawLineFileV2[], estimateMissingDirections = false): TransitNetwork {
    return new TransitNetwork(lines, { estimateMissingDirections });
}

export const minutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};
