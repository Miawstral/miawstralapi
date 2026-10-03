import type { Departure, StopDetails, StopSummary } from '../../interfaces/BusData';
import { notFound } from '../../lib/http-error';
import { formatTime } from '../../lib/time';
import type { NetworkStop, TransitNetwork } from '../../network/network';
import { expectedTime, tripDelays, tripUpdatesOrNull } from '../../realtime/enrich';

export function toStopSummary(stop: NetworkStop, distance?: number): StopSummary {
    return {
        stopPointId: stop.id,
        name: stop.name,
        city: stop.city,
        latitude: String(stop.lat),
        longitude: String(stop.lon),
        accessible: stop.accessible,
        lines: stop.lines,
        ...(distance === undefined ? {} : { distance: Math.round(distance) }),
    };
}

function requireStop(network: TransitNetwork, id: string): NetworkStop {
    const stop = network.getStop(id);
    if (!stop) throw notFound(`Stop not found: ${id}`);
    return stop;
}

export function listStops(network: TransitNetwork): StopSummary[] {
    return network.stops.map(s => toStopSummary(s));
}

export function searchStops(network: TransitNetwork, query: string, limit: number): StopSummary[] {
    return network.searchStops(query, limit).map(s => toStopSummary(s));
}

export function nearbyStops(network: TransitNetwork, lat: number, lon: number, radius: number, limit: number): StopSummary[] {
    return network
        .nearbyStops(lat, lon, radius)
        .slice(0, limit)
        .map(({ stop, distance }) => toStopSummary(stop, distance));
}

/** Stop with every line/direction serving it and the passing times. */
export function getStopDetails(network: TransitNetwork, id: string): StopDetails {
    const stop = requireStop(network, id);
    const passingLines: StopDetails['passingLines'] = [];
    for (const lineId of stop.lines) {
        const line = network.lines.get(lineId)!;
        for (const dir of line.directions) {
            const times = new Set<number>();
            for (const trip of dir.trips) {
                trip.stops.forEach((s, pos) => {
                    if (s === stop.index && pos < trip.stops.length - 1) times.add(trip.times[pos]);
                });
            }
            if (times.size === 0) continue;
            passingLines.push({
                bus_id: line.id,
                lineName: line.name,
                color: line.color,
                textColor: line.textColor,
                mode: line.mode,
                direction: dir.direction,
                headsign: dir.headsign,
                times: [...times].sort((a, b) => a - b).map(formatTime),
            });
        }
    }
    return { ...toStopSummary(stop), passingLines };
}

/**
 * Next departures, with real-time predictions. Departures of every stop point
 * of the place (both sides of the street) are included when `area` is set.
 */
export async function getDepartures(network: TransitNetwork, id: string, after: number, limit: number, area = false) {
    const stop = requireStop(network, id);
    const stops = area ? network.stopArea(stop) : [stop];
    const updates = await tripUpdatesOrNull();
    // Late vehicles scheduled a bit earlier may still be to come.
    const LOOKBACK = 15;
    const candidates = stops.flatMap(s => network.departures(s.index, after - LOOKBACK, limit * 3 + 10));

    const departures = candidates
        .map(({ trip, position, time }) => {
            const line = network.lines.get(trip.line)!;
            const delays = tripDelays(network, updates, trip);
            const delay = delays?.stops[position].delay ?? null;
            const skipped = delays?.stops[position].skipped ?? false;
            const expected = time + (delay ?? 0) / 60;
            const departure: Departure = {
                tripId: trip.id,
                line: line.id,
                lineName: line.name,
                color: line.color,
                textColor: line.textColor,
                mode: line.mode,
                direction: trip.direction,
                headsign: trip.headsign,
                time: formatTime(time),
                realtime: delay === null ? null : { time: expectedTime(time, delay), delay },
                cancelled: (delays?.cancelled ?? false) || skipped,
            };
            return { departure, expected, stopId: network.stops[trip.stops[position]].id };
        })
        .filter(d => d.expected >= after)
        .sort((a, b) => a.expected - b.expected)
        .slice(0, limit);

    return {
        stop: toStopSummary(stop),
        serviceDate: network.serviceDate,
        time: formatTime(after),
        realtime: updates !== null,
        departures: departures.map(d => ({ ...d.departure, stopPointId: d.stopId })),
    };
}
