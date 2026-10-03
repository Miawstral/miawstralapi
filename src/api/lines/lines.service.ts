import type { LineDetails, LineDirectionSummary, LineShape, LineSummary } from '../../interfaces/BusData';
import { notFound } from '../../lib/http-error';
import { normalizeText } from '../../lib/text';
import { formatTime } from '../../lib/time';
import type { LineDirection, NetworkLine, TransitNetwork } from '../../network/network';

function directionSummary(dir: LineDirection): LineDirectionSummary {
    return { direction: dir.direction, headsign: dir.headsign, trips: dir.trips.length };
}

function toLineSummary(line: NetworkLine): LineSummary {
    return {
        bus_id: line.id,
        lineName: line.name,
        lineId: line.routeId,
        color: line.color,
        textColor: line.textColor,
        mode: line.mode,
        directions: line.directions.map(directionSummary),
    };
}

function requireLine(network: TransitNetwork, id: string): NetworkLine {
    const line = network.getLine(id);
    if (!line) throw notFound(`Line not found: ${id}`);
    return line;
}

export function listLines(network: TransitNetwork): LineSummary[] {
    return [...network.lines.values()].map(toLineSummary);
}

export function searchLines(network: TransitNetwork, query: string): LineSummary[] {
    const q = normalizeText(query);
    return [...network.lines.values()]
        .filter(line => normalizeText(line.id) === q || normalizeText(line.name).includes(q))
        .map(toLineSummary);
}

export function getLineDetails(network: TransitNetwork, id: string): LineDetails {
    const line = requireLine(network, id);
    const { directions: _, ...summary } = toLineSummary(line);
    return {
        ...summary,
        serviceDate: network.serviceDate,
        directions: line.directions.map(dir => ({
            ...directionSummary(dir),
            stops: dir.stops.map(index => {
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

/** Map path of each direction: the most used official shape. */
export function getLineShape(network: TransitNetwork, id: string): LineShape {
    const line = requireLine(network, id);
    return {
        bus_id: line.id,
        color: line.color,
        directions: line.directions.map(dir => {
            const counts = new Map<string, number>();
            for (const trip of dir.trips) if (trip.shapeId) counts.set(trip.shapeId, (counts.get(trip.shapeId) ?? 0) + 1);
            const shapeId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
            const shape = shapeId ? network.shapes.get(shapeId) : undefined;
            const stops = dir.stops.map(i => network.stops[i]);
            return {
                direction: dir.direction,
                headsign: dir.headsign,
                coordinates: shape ? shape.points : stops.map(s => [s.lat, s.lon] as [number, number]),
                stops: stops.map(s => ({ stopPointId: s.id, name: s.name, lat: s.lat, lon: s.lon })),
            };
        }),
    };
}
