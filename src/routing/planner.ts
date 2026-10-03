import type { BusStep, Place, RouteOption, RouteResponse, RouteStep, StopCall, WalkStep } from '../interfaces/Route';
import { estimateWalk, haversine, URBAN_DETOUR_FACTOR } from '../lib/geo';
import { notFound } from '../lib/http-error';
import { formatTime } from '../lib/time';
import type { NetworkStop, TransitNetwork } from '../network/network';
import { LatLon, roadPath } from './geometry';
import { Journey, raptor, StopAccess } from './raptor';

export interface PlanRequest {
    from: { stopId?: string; lat?: number; lon?: number; name?: string };
    to: { stopId?: string; lat?: number; lon?: number; name?: string };
    /** Minutes since midnight. */
    departure: number;
    /** When set, itineraries arriving before this time (minutes), leaving as late as possible. */
    arriveBy?: number;
    /** Only stops accessible to wheelchairs. */
    wheelchair?: boolean;
    maxWalkingDistance: number;
    maxTransfers: number;
    excludedLines: string[];
    maxResults: number;
    includeGeometry: boolean;
}

/** Score penalty of a transfer, in minutes. */
const TRANSFER_PENALTY = 10;
/** A walk-only itinerary is suggested up to this distance (meters). */
const MAX_DIRECT_WALK = 2000;
/** Number of successive searches used to find later alternatives. */
const MAX_SEARCHES = 8;
/** Arrive-by searches: how far back (minutes) and how often departures are tried. */
const ARRIVE_BY_WINDOW = 180;
const ARRIVE_BY_STEP = 4;

export function resolvePlace(network: TransitNetwork, location: PlanRequest['from']): Place {
    if (location.stopId) {
        const stop = network.getStop(location.stopId);
        if (!stop) throw notFound(`Stop not found: ${location.stopId}`);
        return { lat: stop.lat, lon: stop.lon, name: stop.name, stopId: stop.id };
    }
    return { lat: location.lat!, lon: location.lon!, name: location.name };
}

/**
 * Stops reachable on foot from a place, with the estimated walk. When the place
 * is a stop, the other stop points of the same name across the street count as
 * the same place: picking "Seyne Centre" must not make the user miss a bus
 * leaving from the opposite side.
 */
export function accessStops(network: TransitNetwork, place: Place, maxWalkingDistance: number, wheelchair = false): StopAccess[] {
    const origin = place.stopId ? network.getStop(place.stopId) : undefined;
    const sameArea = new Set(origin ? network.stopArea(origin).map(s => s.index) : []);
    return network
        .nearbyStops(place.lat, place.lon, maxWalkingDistance / URBAN_DETOUR_FACTOR)
        .filter(({ stop }) => !wheelchair || stop.accessible)
        .map(({ stop }) => {
            if (sameArea.has(stop.index)) return { stop: stop.index, duration: 0, distance: 0 };
            const walk = estimateWalk(place.lat, place.lon, stop.lat, stop.lon);
            return { stop: stop.index, ...walk };
        })
        .filter(a => a.distance <= maxWalkingDistance);
}

function journeyKey(journey: Journey): string {
    return journey.legs
        .map(leg => {
            switch (leg.type) {
                case 'ride':
                    return `${leg.trip.id}@${leg.boardPos}-${leg.alightPos}`;
                case 'transfer':
                    return `w${leg.from}-${leg.to}`;
                case 'access':
                    return `a${leg.to}`;
                case 'egress':
                    return `e${leg.from}`;
            }
        })
        .join('|');
}

/** Keeps journeys not dominated on (later departure, earlier arrival, fewer transfers). */
function paretoFilter(journeys: Journey[]): Journey[] {
    return journeys.filter(
        (j, i) =>
            !journeys.some(
                (o, k) =>
                    k !== i &&
                    o.departure >= j.departure &&
                    o.arrival <= j.arrival &&
                    o.transfers <= j.transfers &&
                    (o.departure > j.departure || o.arrival < j.arrival || o.transfers < j.transfers || k < i),
            ),
    );
}

function stopPlace(stop: NetworkStop): Place {
    return { lat: stop.lat, lon: stop.lon, name: stop.name, stopId: stop.id };
}

function walkStep(from: Place, to: Place, departure: number, duration: number, distance: number): WalkStep {
    return {
        type: 'walk',
        from,
        to,
        departureTime: formatTime(departure),
        arrivalTime: formatTime(departure + duration),
        duration,
        distance,
        geometry: [
            [from.lat, from.lon],
            [to.lat, to.lon],
        ],
    };
}

function toRouteOption(network: TransitNetwork, journey: Journey, from: Place, to: Place): RouteOption {
    const steps: RouteStep[] = [];

    for (const leg of journey.legs) {
        if (leg.type === 'access') {
            if (leg.arrival === leg.departure && leg.distance === 0) continue;
            steps.push(walkStep(from, stopPlace(network.stops[leg.to]), leg.departure, leg.arrival - leg.departure, leg.distance));
        } else if (leg.type === 'egress') {
            if (leg.arrival === leg.departure && leg.distance === 0) continue;
            steps.push(walkStep(stopPlace(network.stops[leg.from]), to, leg.departure, leg.arrival - leg.departure, leg.distance));
        } else if (leg.type === 'transfer') {
            steps.push(
                walkStep(
                    stopPlace(network.stops[leg.from]),
                    stopPlace(network.stops[leg.to]),
                    leg.departure,
                    leg.arrival - leg.departure,
                    leg.distance,
                ),
            );
        } else {
            const { trip, boardPos, alightPos } = leg;
            const line = network.lines.get(trip.line)!;
            const calls = trip.stops.slice(boardPos, alightPos + 1).map((stopIndex, i): StopCall => {
                const stop = network.stops[stopIndex];
                return { stopId: stop.id, name: stop.name, lat: stop.lat, lon: stop.lon, time: formatTime(trip.times[boardPos + i]) };
            });
            let distance = 0;
            for (let i = 1; i < calls.length; i++) {
                distance += haversine(calls[i - 1].lat, calls[i - 1].lon, calls[i].lat, calls[i].lon);
            }
            const first = calls[0];
            const last = calls[calls.length - 1];
            const step: BusStep = {
                type: 'bus',
                line: line.id,
                lineName: line.name,
                color: line.color,
                headsign: trip.headsign,
                from: { stopId: first.stopId, name: first.name, lat: first.lat, lon: first.lon },
                to: { stopId: last.stopId, name: last.name, lat: last.lat, lon: last.lon },
                departureTime: formatTime(leg.departure),
                arrivalTime: formatTime(leg.arrival),
                stopsCount: alightPos - boardPos,
                intermediateStops: calls.slice(1, -1),
                duration: leg.arrival - leg.departure,
                distance: Math.round(distance),
                estimated: trip.estimated,
                geometry: calls.map(c => [c.lat, c.lon]),
            };
            steps.push(step);
        }
    }

    const duration = journey.arrival - journey.departure;
    return {
        departureTime: formatTime(journey.departure),
        arrivalTime: formatTime(journey.arrival),
        duration,
        transfers: journey.transfers,
        walkingDistance: steps.reduce((sum, s) => sum + (s.type === 'walk' ? s.distance : 0), 0),
        estimated: steps.some(s => s.type === 'bus' && s.estimated),
        steps,
        score: duration + TRANSFER_PENALTY * journey.transfers,
    };
}

function walkOnlyOption(from: Place, to: Place, departure: number): RouteOption {
    const { distance, duration } = estimateWalk(from.lat, from.lon, to.lat, to.lon);
    return {
        departureTime: formatTime(departure),
        arrivalTime: formatTime(departure + duration),
        duration,
        transfers: 0,
        walkingDistance: distance,
        estimated: false,
        steps: [walkStep(from, to, departure, duration, distance)],
        score: duration,
    };
}

/** Replaces straight lines by OSRM street paths when available. */
async function addGeometry(routes: RouteOption[]): Promise<void> {
    const tasks: Promise<void>[] = [];
    for (const route of routes) {
        for (const step of route.steps) {
            const points = (step.geometry ?? []) as LatLon[];
            const profile = step.type === 'walk' ? 'foot' : 'car';
            tasks.push(
                roadPath(profile, points).then(path => {
                    if (!path) return;
                    step.geometry = path.geometry;
                    step.distance = path.distance;
                }),
            );
        }
    }
    await Promise.all(tasks);
    for (const route of routes) {
        route.walkingDistance = route.steps.reduce((sum, s) => sum + (s.type === 'walk' ? s.distance : 0), 0);
    }
}

export async function planJourneys(network: TransitNetwork, request: PlanRequest): Promise<RouteResponse> {
    const started = Date.now();
    const from = resolvePlace(network, request.from);
    const to = resolvePlace(network, request.to);
    const warnings: string[] = [];
    const response = (routes: RouteOption[]): RouteResponse => ({
        from,
        to,
        departureTime: formatTime(request.departure),
        ...(request.arriveBy === undefined ? {} : { arrivalTime: formatTime(request.arriveBy) }),
        routes,
        warnings,
        calculationTime: Date.now() - started,
    });

    if (from.stopId && from.stopId === to.stopId) {
        warnings.push('Le départ et la destination sont identiques.');
        return response([]);
    }

    const access = accessStops(network, from, request.maxWalkingDistance, request.wheelchair);
    const egress = accessStops(network, to, request.maxWalkingDistance, request.wheelchair);
    if (access.length === 0) warnings.push(`Aucun arrêt à moins de ${request.maxWalkingDistance} m du départ.`);
    if (egress.length === 0) warnings.push(`Aucun arrêt à moins de ${request.maxWalkingDistance} m de la destination.`);

    const found = new Map<string, Journey>();
    const remember = (journey: Journey) => {
        const key = journeyKey(journey);
        if (!found.has(key)) found.set(key, journey);
    };
    if (access.length > 0 && egress.length > 0) {
        const query = {
            access,
            egress,
            maxTransfers: request.maxTransfers,
            excludedLines: new Set(request.excludedLines),
            accessibleOnly: request.wheelchair,
        };
        if (request.arriveBy === undefined) {
            let departure = request.departure;
            for (let i = 0; i < MAX_SEARCHES && found.size < request.maxResults * 2; i++) {
                const journeys = raptor(network, { ...query, departure });
                if (journeys.length === 0) break;
                journeys.forEach(remember);
                // Next search: just after the earliest departure found, to get the following trips.
                departure = Math.min(...journeys.map(j => j.departure)) + 1;
            }
        } else {
            // Arrive by: earliest-arrival searches leaving earlier and earlier, keeping the
            // journeys that make it on time. RAPTOR is fast enough to sample every few minutes.
            const target = request.arriveBy;
            for (let departure = target - ARRIVE_BY_STEP; departure >= target - ARRIVE_BY_WINDOW; departure -= ARRIVE_BY_STEP) {
                raptor(network, { ...query, departure }).filter(j => j.arrival <= target).forEach(remember);
                if (found.size >= request.maxResults * 2) break;
            }
        }
    }

    const directWalk = haversine(from.lat, from.lon, to.lat, to.lon) * URBAN_DETOUR_FACTOR;
    const walkDuration = estimateWalk(from.lat, from.lon, to.lat, to.lon).duration;
    const walkOnly = directWalk <= Math.max(MAX_DIRECT_WALK, request.maxWalkingDistance)
        ? walkOnlyOption(from, to, request.arriveBy === undefined ? request.departure : request.arriveBy - walkDuration)
        : null;

    let journeys = paretoFilter([...found.values()]);
    // A bus journey slower than walking the whole way is pointless.
    if (walkOnly) journeys = journeys.filter(j => j.arrival - j.departure < walkOnly.duration);

    const candidates = journeys.map(j => ({ ...j, build: () => toRouteOption(network, j, from, to) }));
    if (walkOnly) {
        const departure = request.arriveBy === undefined ? request.departure : request.arriveBy - walkOnly.duration;
        candidates.push({ legs: [], departure, arrival: departure + walkOnly.duration, transfers: 0, build: () => walkOnly });
    }
    const routes = candidates
        .sort((a, b) =>
            request.arriveBy === undefined
                ? a.arrival - b.arrival || a.transfers - b.transfers || b.departure - a.departure
                : b.departure - a.departure || a.transfers - b.transfers || a.arrival - b.arrival,
        )
        .slice(0, request.maxResults)
        .map(c => c.build());

    if (routes.length === 0 && warnings.length === 0) {
        warnings.push('Aucun itinéraire trouvé pour cet horaire. Essayez une autre heure ou plus de correspondances.');
    }
    if (routes.some(r => r.estimated)) {
        warnings.push(
            'Certains horaires sont estimés : le sens retour de ces lignes n’a pas encore été récupéré et a été déduit du sens aller.',
        );
    }

    if (request.includeGeometry) await addGeometry(routes);
    return response(routes);
}
