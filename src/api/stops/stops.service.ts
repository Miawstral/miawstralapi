import type { Departure, StopDetails, StopSummary } from '../../interfaces/BusData';
import { notFound } from '../../lib/http-error';
import { formatTime } from '../../lib/time';
import type { NetworkStop, TransitNetwork } from '../../network/network';

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
                direction: dir.direction,
                headsign: dir.headsign,
                estimated: dir.estimated,
                times: [...times].sort((a, b) => a - b).map(formatTime),
            });
        }
    }
    return { ...toStopSummary(stop), passingLines };
}

export function getDepartures(network: TransitNetwork, id: string, after: number, limit: number) {
    const stop = requireStop(network, id);
    const departures: Departure[] = network.departures(stop.index, after, limit).map(({ trip, time }) => {
        const line = network.lines.get(trip.line)!;
        return {
            line: line.id,
            lineName: line.name,
            color: line.color,
            direction: trip.direction,
            headsign: trip.headsign,
            time: formatTime(time),
            estimated: trip.estimated,
        };
    });
    return { stop: toStopSummary(stop), time: formatTime(after), departures };
}
