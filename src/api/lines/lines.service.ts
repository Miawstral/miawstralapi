import type { LineDetails, LineDirectionSummary, LineSummary } from '../../interfaces/BusData';
import { notFound } from '../../lib/http-error';
import { normalizeText } from '../../lib/text';
import { formatTime } from '../../lib/time';
import type { LineDirection, NetworkLine, TransitNetwork } from '../../network/network';

function directionSummary(dir: LineDirection): LineDirectionSummary {
    return { direction: dir.direction, headsign: dir.headsign, estimated: dir.estimated, trips: dir.trips.length };
}

function toLineSummary(line: NetworkLine): LineSummary {
    return {
        bus_id: line.id,
        lineName: line.name,
        lineId: line.lineId,
        color: line.color,
        directions: line.directions.map(directionSummary),
    };
}

export function listLines(network: TransitNetwork): LineSummary[] {
    return [...network.lines.values()].map(toLineSummary);
}

export function searchLines(network: TransitNetwork, query: string): LineSummary[] {
    const q = normalizeText(query);
    return [...network.lines.values()]
        .filter(line => line.id.toLowerCase() === q || normalizeText(line.name).includes(q))
        .map(toLineSummary);
}

export function getLineDetails(network: TransitNetwork, id: string): LineDetails {
    const line = network.getLine(id);
    if (!line) throw notFound(`Line not found: ${id}`);

    const { directions: _, ...summary } = toLineSummary(line);
    return {
        ...summary,
        notes: line.notes,
        cachedAt: line.cachedAt,
        directions: line.directions.map(dir => ({
            ...directionSummary(dir),
            stops: [...new Set(dir.stops)].map(index => {
                const stop = network.stops[index];
                const times = new Set<number>();
                for (const trip of dir.trips) {
                    trip.stops.forEach((s, pos) => {
                        if (s === index) times.add(trip.times[pos]);
                    });
                }
                return {
                    stopPointId: stop.id,
                    name: stop.name,
                    city: stop.city,
                    latitude: String(stop.lat),
                    longitude: String(stop.lon),
                    accessible: stop.accessible,
                    times: [...times].sort((a, b) => a - b).map(formatTime),
                };
            }),
        })),
    };
}
