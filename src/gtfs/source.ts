import type { Direction } from '../interfaces/BusData';
import type { NetworkSource, SourceLine, SourceTrip } from '../network/network';
import { cityOfStop } from './cities';
import { activeServices, type GtfsFeed } from './feed';

/**
 * Network source of one service day: the trips running that day (calendar +
 * exceptions), their stops, routes and shapes.
 */
export function sourceForDate(feed: GtfsFeed, date: string): NetworkSource {
    const services = activeServices(feed, date);
    const linesByRoute = new Map<string, SourceLine>();
    const usedIds = new Set<string>();

    // Public line id = route_short_name ("87", "8M", "U"), the route_id when ambiguous.
    const shortNames = new Map<string, number>();
    for (const route of feed.routes.values()) shortNames.set(route.shortName, (shortNames.get(route.shortName) ?? 0) + 1);

    for (const trip of feed.trips.values()) {
        if (!services.has(trip.serviceId)) continue;
        const route = feed.routes.get(trip.routeId);
        if (!route) continue;

        let line = linesByRoute.get(route.id);
        if (!line) {
            line = {
                id: (shortNames.get(route.shortName) ?? 0) > 1 ? route.id : route.shortName,
                routeId: route.id,
                name: route.longName.replace(/\s+/g, ' ').trim() || route.shortName,
                color: route.color,
                textColor: route.textColor,
                mode: route.mode,
                sortOrder: route.sortOrder,
                trips: [],
            };
            linesByRoute.set(route.id, line);
        }

        const sourceTrip: SourceTrip = {
            id: trip.id,
            direction: (trip.directionId === 1 ? 'INWARD' : 'OUTWARD') as Direction,
            // Some exports carry bus display codes ("994 Je ne suis pas en service"): use the terminus instead.
            headsign:
                trip.headsign && !/pas en service|^\d{3,}\s/i.test(trip.headsign)
                    ? trip.headsign
                    : (feed.stops.get(trip.stopIds[trip.stopIds.length - 1])?.name ?? trip.headsign),
            stops: trip.stopIds,
            times: trip.departures.map(s => Math.floor(s / 60)),
            shapeId: trip.shapeId,
            distances: trip.distances,
        };
        line.trips.push(sourceTrip);
        trip.stopIds.forEach(id => usedIds.add(id));
    }

    return {
        serviceDate: date,
        feedVersion: feed.feedInfo.version,
        // Every stop is kept (the map shows them), served or not on that day.
        stops: [...feed.stops.values()].map(s => ({
            id: s.id,
            name: s.name,
            city: cityOfStop(s.id),
            lat: s.lat,
            lon: s.lon,
            accessible: s.wheelchair,
        })),
        lines: [...linesByRoute.values()],
        shapes: feed.shapes,
    };
}
